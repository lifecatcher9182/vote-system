'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ConfirmModal from '@/components/ConfirmModal';
import AlertModal from '@/components/AlertModal';

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  max_selections: number;
  round: number;
  status: string;
  villages?: {
    name: string;
  };
}

interface Candidate {
  id: string;
  name: string;
  election_id: string;
}

interface VoterCode {
  id: string;
  code: string;
  code_type: 'delegate' | 'officer';
  accessible_elections: string[];
  village_id: string | null;
  is_used: boolean;
}

export default function VoteWithCodePage({ 
  params 
}: { 
  params: Promise<{ code: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [voterCode, setVoterCode] = useState<VoterCode | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<Set<string>>(new Set());
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isAbstain, setIsAbstain] = useState(false); // 기권 여부
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{ 
    isOpen: boolean; 
    message: string; 
    title: string;
    onClose?: () => void;
  }>({
    isOpen: false,
    message: '',
    title: '',
    onClose: undefined
  });

  const loadData = useCallback(async () => {
    const supabase = createClient();

    // 1. 참여코드 확인 (대문자로 변환하여 검색)
    const { data: codeData, error: codeError } = await supabase
      .from('voter_codes')
      .select('*')
      .eq('code', resolvedParams.code.toUpperCase())
      .single();

    if (codeError || !codeData) {
      setLoading(false);
      setAlertModal({ 
        isOpen: true, 
        message: '올바르지 않은 참여코드입니다.', 
        title: '오류',
        onClose: () => router.push('/vote')
      });
      return;
    }

    // 첫 로그인 시 참석 체크 (first_login_at 기록)
    if (!codeData.first_login_at) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('voter_codes')
        .update({
          first_login_at: now,
          last_login_at: now
        })
        .eq('id', codeData.id);

      if (!updateError) {
        codeData.first_login_at = now;
        codeData.last_login_at = now;
      }
    } else {
      // 재방문 시 last_login_at만 업데이트
      await supabase
        .from('voter_codes')
        .update({
          last_login_at: new Date().toISOString()
        })
        .eq('id', codeData.id);
    }

    setVoterCode(codeData);

    // 2. 이미 투표한 선거 목록 조회
    const { data: votesData } = await supabase
      .from('votes')
      .select('election_id')
      .eq('voter_code_id', codeData.id);

    const voted = new Set(votesData?.map(v => v.election_id) || []);
    setVotedElectionIds(voted);

    // 3. 접근 가능한 투표 목록 조회
    const { data: electionsData, error: electionsError } = await supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .in('id', codeData.accessible_elections)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (electionsError) {
      console.error('투표 로딩 오류:', electionsError);
      setLoading(false);
      setAlertModal({ 
        isOpen: true, 
        message: '투표를 불러오지 못했습니다.', 
        title: '오류',
        onClose: () => router.push('/vote')
      });
      return;
    }

    if (!electionsData || electionsData.length === 0) {
      setLoading(false);
      setAlertModal({ 
        isOpen: true, 
        message: '현재 참여 가능한 투표가 없습니다.\n투표가 시작되면 다시 시도해주세요.', 
        title: '투표 없음',
        onClose: () => router.push('/vote')
      });
      return;
    }

    setElections(electionsData);
    setLoading(false);
  }, [resolvedParams.code, router]);

  const loadCandidates = useCallback(async (electionId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', electionId)
      .order('name', { ascending: true });

    if (error) {
      console.error('후보자 로딩 오류:', error);
      return;
    }

    setCandidates(data || []);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadData();
    };
    initialize();
  }, [loadData]);

  // URL 쿼리 파라미터 변경 감지
  useEffect(() => {
    if (loading || elections.length === 0) return;
    
    const electionId = searchParams.get('election');
    
    if (!electionId) {
      // 쿼리 파라미터가 없으면 투표 목록으로
      if (selectedElection) {
        setSelectedElection(null);
        setSelectedCandidates([]);
      }
    } else if (selectedElection?.id !== electionId) {
      // 쿼리 파라미터가 있고 현재 선택된 투표와 다르면 해당 투표 선택
      const election = elections.find(e => e.id === electionId);
      if (election && !votedElectionIds.has(election.id)) {
        setSelectedElection(election);
        setSelectedCandidates([]);
        setIsAbstain(false); // 기권 상태 초기화
        loadCandidates(election.id);
      } else {
        // 유효하지 않은 투표 ID거나 이미 투표한 경우
        router.push(`/vote/${resolvedParams.code}`);
      }
    }
  }, [searchParams, elections, votedElectionIds, resolvedParams.code, router, loading]);

  const handleElectionSelect = (election: Election) => {
    // 이미 투표한 선거는 선택 불가
    if (votedElectionIds.has(election.id)) {
      setAlertModal({ isOpen: true, message: '이미 투표를 완료한 선거입니다.', title: '안내' });
      return;
    }

    // URL 업데이트만 하고, useEffect가 나머지 처리
    router.push(`/vote/${resolvedParams.code}?election=${election.id}`);
  };

  const handleCandidateToggle = (candidateId: string) => {
    if (!selectedElection) return;

    // 후보자 선택 시 기권 해제
    if (isAbstain) {
      setIsAbstain(false);
    }

    if (selectedCandidates.includes(candidateId)) {
      setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId));
    } else {
      if (selectedCandidates.length >= selectedElection.max_selections) {
        setAlertModal({ isOpen: true, message: `최대 ${selectedElection.max_selections}명까지 선택할 수 있습니다.`, title: '안내' });
        return;
      }
      setSelectedCandidates([...selectedCandidates, candidateId]);
    }
  };

  const handleAbstainToggle = () => {
    if (isAbstain) {
      // 기권 해제
      setIsAbstain(false);
    } else {
      // 기권 선택 시 다른 선택 모두 취소
      setIsAbstain(true);
      setSelectedCandidates([]);
    }
  };

  const handleSubmitClick = () => {
    if (!selectedElection || !voterCode) return;

    // 기권도 안 하고 후보자도 안 선택한 경우
    if (!isAbstain && selectedCandidates.length === 0) {
      setAlertModal({ isOpen: true, message: '후보자를 선택하거나 기권을 선택하세요.', title: '안내' });
      return;
    }

    // 기권이 아닌데 정확한 인원을 선택하지 않은 경우
    if (!isAbstain && selectedCandidates.length !== selectedElection.max_selections) {
      setAlertModal({ isOpen: true, message: `정확히 ${selectedElection.max_selections}명을 선택해야 합니다.\n현재 ${selectedCandidates.length}명 선택됨\n\n투표하지 않으려면 '기권'을 선택하세요.`, title: '안내' });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedElection || !voterCode) return;

    setSubmitting(true);

    try {
      const supabase = createClient();

      // 1. 중복 투표 체크
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_code_id', voterCode.id)
        .eq('election_id', selectedElection.id)
        .maybeSingle();

      if (existingVote) {
        setAlertModal({ isOpen: true, message: '이미 이 투표에 참여하셨습니다.', title: '안내' });
        setSubmitting(false);
        return;
      }

      // 2. 투표 기록 생성
      if (isAbstain) {
        // 기권인 경우: candidate_id를 null로 저장
        const { error: abstainError } = await supabase
          .from('votes')
          .insert({
            election_id: selectedElection.id,
            candidate_id: null,
            voter_code_id: voterCode.id,
            is_abstain: true
          });

        if (abstainError) {
          console.error('기권 제출 오류:', abstainError);
          setAlertModal({ isOpen: true, message: `기권 제출에 실패했습니다.\n오류: ${abstainError.message}`, title: '오류' });
          setSubmitting(false);
          return;
        }
      } else {
        // 일반 투표인 경우
        const validCandidates = selectedCandidates.filter(id => id && id.trim());
        
        if (validCandidates.length !== selectedElection.max_selections) {
          setAlertModal({ 
            isOpen: true, 
            message: '올바르지 않은 투표 데이터입니다. 다시 선택해주세요.', 
            title: '오류' 
          });
          setSubmitting(false);
          return;
        }

        const votes = validCandidates.map(candidateId => ({
          election_id: selectedElection.id,
          candidate_id: candidateId,
          voter_code_id: voterCode.id,
          is_abstain: false
        }));

        const { error: votesError } = await supabase
          .from('votes')
          .insert(votes);

        if (votesError) {
          console.error('투표 제출 오류:', votesError);
          setAlertModal({ isOpen: true, message: `투표 제출에 실패했습니다.\n오류: ${votesError.message}`, title: '오류' });
          setSubmitting(false);
          return;
        }

        // 3. 후보자 득표수 업데이트 (기권이 아닐 때만)
        for (const candidateId of validCandidates) {
          const { error: updateError } = await supabase.rpc('increment_vote_count', {
            candidate_id: candidateId
          });

          if (updateError) {
            console.error('득표수 업데이트 오류:', updateError);
            // 득표수 업데이트 실패해도 투표는 기록되었으므로 계속 진행
          }
        }
      }

      // 3. 투표 완료된 선거 목록 업데이트
      const updatedVotedIds = new Set(votedElectionIds);
      updatedVotedIds.add(selectedElection.id);

      // 4. 모든 투표가 완료되었는지 확인
      const allCompleted = voterCode.accessible_elections.every(electionId => 
        updatedVotedIds.has(electionId)
      );

      // 5. 모든 투표가 완료되었을 때만 is_used를 true로 설정
      if (allCompleted) {
        const { error: codeUpdateError } = await supabase
          .from('voter_codes')
          .update({ 
            is_used: true, 
            used_at: new Date().toISOString() 
          })
          .eq('id', voterCode.id);

        if (codeUpdateError) {
          console.error('코드 업데이트 오류:', codeUpdateError);
        }
      }

      // 6. 남은 투표가 있으면 목록으로, 모두 완료했으면 완료 페이지로
      if (allCompleted) {
        router.push(`/vote/complete?election=${selectedElection.title}`);
      } else {
        // votedElectionIds 상태 업데이트
        setVotedElectionIds(updatedVotedIds);
        
        // 선택 상태 초기화 (목록으로 돌아가기)
        setSelectedElection(null);
        setSelectedCandidates([]);
        setSubmitting(false);
        
        // 목록으로 돌아가기 (URL 변경)
        router.push(`/vote/${resolvedParams.code}`);
        
        // 완료 메시지
        setAlertModal({ isOpen: true, message: '투표를 완료하셨습니다', title: '완료' });
      }
    } catch (error) {
      console.error('투표 제출 중 오류:', error);
      setAlertModal({ isOpen: true, message: '투표 제출 중 오류가 발생했습니다.', title: '오류' });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto mb-6"></div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>투표 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-8 lg:py-12 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <div className="max-w-3xl mx-auto">
        {/* 헤더 - Glass Effect */}
        <div className="glass-effect rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 mb-6 sm:mb-8" style={{ 
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold mb-2 sm:mb-3" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                투표 진행
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600">참여코드</span>
                <span className="px-2.5 sm:px-3 py-1 rounded-lg font-mono text-xs sm:text-sm font-semibold" style={{ 
                  background: 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '0.05em'
                }}>
                  {resolvedParams.code}
                </span>
              </div>
            </div>
            {selectedElection && (
              <button
                onClick={() => {
                  // URL에서 쿼리 파라미터 제거만 하고, useEffect가 나머지 처리
                  router.push(`/vote/${resolvedParams.code}`);
                }}
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-sm sm:text-base font-medium transition-all duration-200 hover:scale-105 active:scale-95 w-full sm:w-auto justify-center"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: '#1d1d1f',
                  letterSpacing: '-0.01em'
                }}
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                투표 목록
              </button>
            )}
          </div>
        </div>

        {!selectedElection ? (
          /* 투표 선택 - Apple Card Style */
          <div>
            <div className="card-apple p-5 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold mb-5 sm:mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                투표를 선택하세요
              </h2>
              <div className="space-y-3 sm:space-y-4">
                {elections.map((election) => {
                  const isVoted = votedElectionIds.has(election.id);
                  
                  return (
                    <button
                      key={election.id}
                      onClick={() => handleElectionSelect(election)}
                      disabled={isVoted}
                      className="group w-full p-4 sm:p-5 lg:p-6 rounded-2xl transition-all duration-200 text-left disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                      style={{ 
                        background: isVoted ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                        border: isVoted ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-semibold" style={{ 
                              color: '#1d1d1f',
                              letterSpacing: '-0.02em'
                            }}>
                              {election.title}
                            </h3>
                            {isVoted && (
                              <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
                                투표 완료
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>
                            {election.election_type === 'delegate' 
                              ? `총대 선출 · ${election.villages?.name}`
                              : `임원 선출 · ${election.position}`
                            }
                          </p>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="px-2 py-1 rounded-md bg-white/50">{election.round}차</span>
                            <span className="whitespace-nowrap">최대 {election.max_selections}명 선택</span>
                          </div>
                        </div>
                        {!isVoted && (
                          <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1 group-active:translate-x-0" style={{ 
                            background: 'var(--color-secondary)',
                            color: 'white'
                          }}>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단 처음으로 버튼 */}
            <div className="text-center mt-6">
              <button
                onClick={() => router.push('/vote')}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all hover:scale-105 active:scale-95"
                style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.01em'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                다른 코드로 투표하기
              </button>
            </div>
          </div>
        ) : (
          /* 후보자 선택 - Apple Style */
          <div className="space-y-5 sm:space-y-6">
            <div className="card-apple p-5 sm:p-6 lg:p-8">
              <h2 className="text-xl sm:text-2xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                {selectedElection.title}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-5 sm:mb-6" style={{ letterSpacing: '-0.01em' }}>
                {selectedElection.election_type === 'delegate' 
                  ? `총대 선출 · ${selectedElection.villages?.name}`
                  : `임원 선출 · ${selectedElection.position}`
                }
              </p>

              {/* 선택 가이드 */}
              <div className="mb-6 sm:mb-8 p-4 sm:p-5 rounded-2xl" style={{ background: 'rgba(0, 113, 227, 0.05)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 113, 227, 0.1)' }}>
                    <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-secondary)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: '#1d1d1f' }}>
                      {isAbstain ? (
                        <span className="text-orange-600">🗳️ 기권 선택됨</span>
                      ) : (
                        <>최대 <strong>{selectedElection.max_selections}명</strong>까지 선택할 수 있습니다</>
                      )}
                    </p>
                    {!isAbstain && (
                      <>
                        <p className="text-xs text-red-600 font-medium">
                          ⚠️ {selectedElection.max_selections}명을 정확히 선택해야 합니다.
                        </p>
                        {selectedCandidates.length > 0 && (
                          <p className="text-sm mt-2" style={{ color: 'var(--color-secondary)' }}>
                            현재 <strong>{selectedCandidates.length}명</strong> 선택됨
                          </p>
                        )}
                      </>
                    )}
                    {isAbstain && (
                      <p className="text-xs text-gray-600 mt-1">
                        투표하지 않습니다. 후보자를 선택하면 기권이 취소됩니다.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 후보자 목록 */}
              {candidates.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-sm sm:text-base text-gray-500" style={{ letterSpacing: '-0.01em' }}>후보자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {candidates.map((candidate, index) => {
                    const isSelected = selectedCandidates.includes(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        onClick={() => handleCandidateToggle(candidate.id)}
                        className="w-full p-4 sm:p-5 rounded-2xl transition-all duration-200 text-left active:scale-[0.98]"
                        style={{ 
                          background: isSelected ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.02)',
                          border: `2px solid ${isSelected ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.06)'}`,
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                        }}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div 
                            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-semibold text-base sm:text-lg transition-all"
                            style={{ 
                              background: isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.05)',
                              color: isSelected ? 'white' : '#1d1d1f'
                            }}
                          >
                            {isSelected ? '✓' : index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p 
                              className="text-base sm:text-lg font-semibold truncate"
                              style={{ 
                                color: isSelected ? 'white' : '#1d1d1f',
                                letterSpacing: '-0.02em'
                              }}
                            >
                              {candidate.name}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* 기권 버튼 */}
                  <button
                    onClick={handleAbstainToggle}
                    disabled={isAbstain}
                    className="w-full p-4 sm:p-5 rounded-2xl transition-all duration-200 text-left active:scale-[0.98] mt-4"
                    style={{ 
                      background: isAbstain ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(0, 0, 0, 0.02)',
                      border: `2px solid ${isAbstain ? '#f59e0b' : 'rgba(0, 0, 0, 0.06)'}`,
                      opacity: isAbstain ? 1 : 0.9
                    }}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div 
                        className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl transition-all"
                        style={{ 
                          background: isAbstain ? 'rgba(255, 255, 255, 0.3)' : 'rgba(249, 115, 22, 0.1)',
                          color: isAbstain ? 'white' : '#f97316'
                        }}
                      >
                        🗳️
                      </div>
                      <div className="flex-1 min-w-0">
                        <p 
                          className="text-base sm:text-lg font-semibold"
                          style={{ 
                            color: isAbstain ? 'white' : '#1d1d1f',
                            letterSpacing: '-0.02em'
                          }}
                        >
                          {isAbstain ? '✓ 기권 (투표하지 않음)' : '기권 (투표하지 않음)'}
                        </p>
                        <p 
                          className="text-xs sm:text-sm mt-1"
                          style={{ 
                            color: isAbstain ? 'rgba(255, 255, 255, 0.9)' : '#6b7280'
                          }}
                        >
                          투표에 참여하지 않습니다
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 투표 제출 카드 */}
            {(selectedCandidates.length > 0 || isAbstain) && (
              <div className="card-apple p-5 sm:p-6 lg:p-8">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  {isAbstain ? '기권 확인' : '선택한 후보자'}
                </h3>
                {isAbstain ? (
                  <div className="mb-5 sm:mb-6 p-4 sm:p-5 rounded-xl" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
                        <span className="text-2xl">🗳️</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-orange-700">기권 (투표하지 않음)</p>
                        <p className="text-sm text-gray-600 mt-1">이 투표에 참여하지 않습니다</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 sm:space-y-3 mb-5 sm:mb-6">
                    {selectedCandidates.map((candidateId) => {
                      const candidate = candidates.find(c => c.id === candidateId);
                      return (
                        <div key={candidateId} className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl" style={{ background: 'rgba(0, 113, 227, 0.05)' }}>
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-secondary)' }}>
                            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="font-medium text-sm sm:text-base truncate" style={{ color: '#1d1d1f' }}>{candidate?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <button
                  onClick={handleSubmitClick}
                  disabled={submitting}
                  className="btn-apple-primary w-full text-base sm:text-lg py-3.5 sm:py-4 mb-4 active:scale-95"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2.5 sm:gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent"></div>
                      투표 제출 중
                    </span>
                  ) : '투표 제출하기'}
                </button>
                
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-center">투표 후에는 변경할 수 없습니다</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 투표 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleSubmit}
        title="투표 제출"
        message={isAbstain 
          ? '기권(투표하지 않음)으로 제출하시겠습니까?\n제출 후에는 변경할 수 없습니다.'
          : `${selectedCandidates.length}명의 후보자에게 투표하시겠습니까?\n투표 후에는 변경할 수 없습니다.`
        }
        confirmText={isAbstain ? '기권 제출' : '투표하기'}
        cancelText="취소"
        variant="primary"
      />

      {/* 알림 모달 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => {
          setAlertModal({ isOpen: false, message: '', title: '', onClose: undefined });
          if (alertModal.onClose) {
            alertModal.onClose();
          }
        }}
        message={alertModal.message}
        title={alertModal.title}
      />
    </div>
  );
}
