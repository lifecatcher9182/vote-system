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

    if (codeData.is_used) {
      alert('이미 사용된 참여코드입니다.');
      router.push('/vote');
      return;
    }

    setVoterCode(codeData);

    // 2. 접근 가능한 투표 목록 조회
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

      // 1. 투표 기록 생성
      const votes = selectedCandidates.map(candidateId => ({
        election_id: selectedElection.id,
        candidate_id: candidateId,
        voter_code_id: voterCode.id,
      }));

      const { error: votesError } = await supabase
        .from('votes')
        .insert(votes);

      if (votesError) {
        console.error('투표 제출 오류:', votesError);
        alert('투표 제출에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      // 2. 후보자 득표수 업데이트
      for (const candidateId of selectedCandidates) {
        const { error: updateError } = await supabase.rpc('increment_vote_count', {
          candidate_id: candidateId
        });

        if (updateError) {
          console.error('득표수 업데이트 오류:', updateError);
        }
      }

      // 3. 참여코드를 사용됨으로 표시
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

      // 완료 페이지로 이동
      router.push(`/vote/complete?election=${selectedElection.title}`);
    } catch (error) {
      console.error('투표 제출 중 오류:', error);
      alert('투표 제출 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--color-primary), #f3f4f6)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" style={{ background: 'linear-gradient(to bottom right, var(--color-primary), #f3f4f6)' }}>
      <div className="max-w-4xl mx-auto px-4">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">투표 진행</h1>
              <p className="text-sm text-gray-600 mt-1">
                참여코드: <span className="font-mono font-semibold">{resolvedParams.code}</span>
              </p>
            </div>
            <Link 
              href="/vote" 
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← 처음으로
            </Link>
          </div>
        </div>

        {!selectedElection ? (
          /* 투표 선택 */
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                투표를 선택하세요
              </h2>
              <div className="space-y-3">
                {elections.map((election) => (
                  <button
                    key={election.id}
                    onClick={() => handleElectionSelect(election)}
                    className="w-full p-4 bg-gray-50 hover:bg-gray-50 border-2 border-gray-200 hover:border-[var(--color-secondary)] rounded-lg transition-all text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{election.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {election.election_type === 'delegate' 
                            ? `총대 선출 - ${election.villages?.name}`
                            : `임원 선출 - ${election.position}`
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {election.round}차 • 최대 {election.max_selections}명 선택
                        </p>
                      </div>
                      <span className="text-[var(--color-secondary)] text-2xl">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 후보자 선택 */
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="mb-6">
                <button
                  onClick={() => {
                    setSelectedElection(null);
                    setSelectedCandidates([]);
                  }}
                  className="text-sm text-[var(--color-secondary)] hover:opacity-80 mb-4"
                >
                  ← 투표 다시 선택
                </button>
                <h2 className="text-xl font-bold text-gray-900">{selectedElection.title}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedElection.election_type === 'delegate' 
                    ? `총대 선출 - ${selectedElection.villages?.name}`
                    : `임원 선출 - ${selectedElection.position}`
                  }
                </p>
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    💡 최대 <strong>{selectedElection.max_selections}명</strong>까지 선택할 수 있습니다.
                    {selectedCandidates.length > 0 && (
                      <span className="ml-2">
                        (현재 <strong>{selectedCandidates.length}명</strong> 선택)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {candidates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  후보자가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {candidates.map((candidate, index) => (
                    <button
                      key={candidate.id}
                      onClick={() => handleCandidateToggle(candidate.id)}
                      className={`w-full p-4 border-2 rounded-lg transition-all text-left ${
                        selectedCandidates.includes(candidate.id)
                          ? 'border-[var(--color-secondary)] bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          selectedCandidates.includes(candidate.id)
                            ? 'bg-[var(--color-secondary)] text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {selectedCandidates.includes(candidate.id) ? '✓' : index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{candidate.name}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 투표 제출 */}
            {selectedCandidates.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="font-bold text-gray-900 mb-3">선택한 후보자</h3>
                <div className="space-y-2 mb-4">
                  {selectedCandidates.map((candidateId) => {
                    const candidate = candidates.find(c => c.id === candidateId);
                    return (
                      <div key={candidateId} className="flex items-center gap-2">
                        <span className="text-[var(--color-secondary)]">✓</span>
                        <span className="font-medium">{candidate?.name}</span>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-[var(--color-secondary)] text-white py-4 rounded-lg font-bold hover:opacity-90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? '투표 제출 중...' : '투표 제출하기'}
                </button>
                <p className="text-xs text-center text-gray-500 mt-3">
                  ⚠️ 투표 후에는 변경할 수 없습니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
