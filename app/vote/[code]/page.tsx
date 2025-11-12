'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

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
  const [loading, setLoading] = useState(true);
  const [voterCode, setVoterCode] = useState<VoterCode | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [votedElectionIds, setVotedElectionIds] = useState<Set<string>>(new Set());
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    // 1. 참여코드 확인
    const { data: codeData, error: codeError } = await supabase
      .from('voter_codes')
      .select('*')
      .eq('code', resolvedParams.code)
      .single();

    if (codeError || !codeData) {
      alert('올바르지 않은 참여코드입니다.');
      router.push('/vote');
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
      alert('투표를 불러오지 못했습니다.');
      router.push('/vote');
      return;
    }

    if (!electionsData || electionsData.length === 0) {
      alert('현재 진행 중인 투표가 없습니다.');
      router.push('/vote');
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

  const handleElectionSelect = (election: Election) => {
    // 이미 투표한 선거는 선택 불가
    if (votedElectionIds.has(election.id)) {
      alert('이미 투표를 완료한 선거입니다.');
      return;
    }

    setSelectedElection(election);
    setSelectedCandidates([]);
    loadCandidates(election.id);
  };

  const handleCandidateToggle = (candidateId: string) => {
    if (!selectedElection) return;

    if (selectedCandidates.includes(candidateId)) {
      setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId));
    } else {
      if (selectedCandidates.length >= selectedElection.max_selections) {
        alert(`최대 ${selectedElection.max_selections}명까지 선택할 수 있습니다.`);
        return;
      }
      setSelectedCandidates([...selectedCandidates, candidateId]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedElection || !voterCode) return;

    if (selectedCandidates.length === 0) {
      alert('최소 1명의 후보자를 선택하세요.');
      return;
    }

    if (selectedCandidates.length > selectedElection.max_selections) {
      alert(`최대 ${selectedElection.max_selections}명까지 선택할 수 있습니다.`);
      return;
    }

    if (!confirm(`${selectedCandidates.length}명의 후보자에게 투표하시겠습니까?\n투표 후에는 변경할 수 없습니다.`)) {
      return;
    }

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
        alert('이미 이 투표에 참여하셨습니다.');
        setSubmitting(false);
        return;
      }

      // 2. 투표 기록 생성
      const votes = selectedCandidates.map(candidateId => ({
        election_id: selectedElection.id,
        candidate_id: candidateId,
        voter_code_id: voterCode.id,
      }));

      console.log('투표 데이터:', votes);

      const { error: votesError } = await supabase
        .from('votes')
        .insert(votes);

      if (votesError) {
        console.error('투표 제출 오류:', votesError);
        alert(`투표 제출에 실패했습니다.\n오류: ${votesError.message}`);
        setSubmitting(false);
        return;
      }

      // 3. 후보자 득표수 업데이트
      for (const candidateId of selectedCandidates) {
        const { error: updateError } = await supabase.rpc('increment_vote_count', {
          candidate_id: candidateId
        });

        if (updateError) {
          console.error('득표수 업데이트 오류:', updateError);
          // 득표수 업데이트 실패해도 투표는 기록되었으므로 계속 진행
        }
      }

      // 3. 투표 완료된 선거 목록 업데이트
      const updatedVotedIds = new Set(votedElectionIds);
      updatedVotedIds.add(selectedElection.id);
      setVotedElectionIds(updatedVotedIds);

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
        // 목록으로 돌아가서 다음 투표 진행 가능
        setSelectedElection(null);
        setSelectedCandidates([]);
        alert(`투표가 완료되었습니다!\n\n남은 투표: ${voterCode.accessible_elections.length - updatedVotedIds.size}개`);
      }
    } catch (error) {
      console.error('투표 제출 중 오류:', error);
      alert('투표 제출 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <svg className="animate-spin h-16 w-16" style={{ color: 'var(--color-secondary)' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>투표 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <div className="max-w-3xl mx-auto">
        {/* 헤더 - Glass Effect */}
        <div className="glass-effect rounded-3xl p-8 mb-8" style={{ 
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                투표 진행
              </h1>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-gray-600">참여코드</span>
                <span className="px-3 py-1 rounded-lg font-mono text-sm font-semibold" style={{ 
                  background: 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '0.05em'
                }}>
                  {resolvedParams.code}
                </span>
              </div>
            </div>
            <Link 
              href="/vote" 
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2 rounded-full hover:bg-white/50"
              style={{ color: 'var(--color-secondary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              처음으로
            </Link>
          </div>
        </div>

        {!selectedElection ? (
          /* 투표 선택 - Apple Card Style */
          <div>
            <div className="card-apple p-8">
              <h2 className="text-2xl font-semibold mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                투표를 선택하세요
              </h2>
              <div className="space-y-4">
                {elections.map((election) => {
                  const isVoted = votedElectionIds.has(election.id);
                  
                  return (
                    <button
                      key={election.id}
                      onClick={() => handleElectionSelect(election)}
                      disabled={isVoted}
                      className="group w-full p-6 rounded-2xl transition-all duration-200 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ 
                        background: isVoted ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                        border: isVoted ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold" style={{ 
                              color: '#1d1d1f',
                              letterSpacing: '-0.02em'
                            }}>
                              {election.title}
                            </h3>
                            {isVoted && (
                              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                투표 완료
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>
                            {election.election_type === 'delegate' 
                              ? `총대 선출 · ${election.villages?.name}`
                              : `임원 선출 · ${election.position}`
                            }
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="px-2 py-1 rounded-md bg-white/50">{election.round}차</span>
                            <span>최대 {election.max_selections}명 선택</span>
                          </div>
                        </div>
                        {!isVoted && (
                          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1" style={{ 
                            background: 'var(--color-secondary)',
                            color: 'white'
                          }}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          </div>
        ) : (
          /* 후보자 선택 - Apple Style */
          <div className="space-y-6">
            <div className="card-apple p-8">
              <button
                onClick={() => {
                  setSelectedElection(null);
                  setSelectedCandidates([]);
                }}
                className="inline-flex items-center gap-2 text-sm font-medium mb-6 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors"
                style={{ color: 'var(--color-secondary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                투표 다시 선택
              </button>
              
              <h2 className="text-2xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                {selectedElection.title}
              </h2>
              <p className="text-gray-600 mb-6" style={{ letterSpacing: '-0.01em' }}>
                {selectedElection.election_type === 'delegate' 
                  ? `총대 선출 · ${selectedElection.villages?.name}`
                  : `임원 선출 · ${selectedElection.position}`
                }
              </p>

              {/* 선택 가이드 */}
              <div className="mb-8 p-5 rounded-2xl" style={{ background: 'rgba(0, 113, 227, 0.05)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 113, 227, 0.1)' }}>
                    <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-secondary)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#1d1d1f' }}>
                      최대 <strong>{selectedElection.max_selections}명</strong>까지 선택할 수 있습니다
                    </p>
                    {selectedCandidates.length > 0 && (
                      <p className="text-sm mt-1" style={{ color: 'var(--color-secondary)' }}>
                        현재 <strong>{selectedCandidates.length}명</strong> 선택됨
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 후보자 목록 */}
              {candidates.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500" style={{ letterSpacing: '-0.01em' }}>후보자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {candidates.map((candidate, index) => {
                    const isSelected = selectedCandidates.includes(candidate.id);
                    return (
                      <button
                        key={candidate.id}
                        onClick={() => handleCandidateToggle(candidate.id)}
                        className="w-full p-5 rounded-2xl transition-all duration-200 text-left"
                        style={{ 
                          background: isSelected ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.02)',
                          border: `2px solid ${isSelected ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.06)'}`,
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all"
                            style={{ 
                              background: isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.05)',
                              color: isSelected ? 'white' : '#1d1d1f'
                            }}
                          >
                            {isSelected ? '✓' : index + 1}
                          </div>
                          <div className="flex-1">
                            <p 
                              className="text-lg font-semibold"
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
                </div>
              )}
            </div>

            {/* 투표 제출 카드 */}
            {selectedCandidates.length > 0 && (
              <div className="card-apple p-8">
                <h3 className="text-xl font-semibold mb-5" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  선택한 후보자
                </h3>
                <div className="space-y-3 mb-6">
                  {selectedCandidates.map((candidateId) => {
                    const candidate = candidates.find(c => c.id === candidateId);
                    return (
                      <div key={candidateId} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0, 113, 227, 0.05)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--color-secondary)' }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="font-medium" style={{ color: '#1d1d1f' }}>{candidate?.name}</span>
                      </div>
                    );
                  })}
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="btn-apple-primary w-full text-lg py-4 mb-4"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      투표 제출 중
                    </span>
                  ) : '투표 제출하기'}
                </button>
                
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>투표 후에는 변경할 수 없습니다</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
