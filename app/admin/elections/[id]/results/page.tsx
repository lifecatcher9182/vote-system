'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  village_id: string | null;
  max_selections: number;
  round: number;
  status: string;
  created_at: string;
  villages?: {
    name: string;
  };
}

interface Candidate {
  id: string;
  name: string;
  vote_count: number;
}

interface VoteStats {
  totalCodes: number;
  usedCodes: number;
  unusedCodes: number;
  participationRate: number;
  totalVotes: number;
  uniqueVoters: number;
}

interface VillageStats {
  villageName: string;
  codesCount: number;
  usedCount: number;
  participationRate: number;
}

export default function ResultsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<VoteStats>({
    totalCodes: 0,
    usedCodes: 0,
    unusedCodes: 0,
    participationRate: 0,
    totalVotes: 0,
    uniqueVoters: 0,
  });
  const [villageStats, setVillageStats] = useState<VillageStats[]>([]);

  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin');
      return false;
    }

    const { isAdmin } = await checkAdminAccess(user.email!);
    if (!isAdmin) {
      alert('관리자 권한이 없습니다.');
      await signOut();
      router.push('/admin');
      return false;
    }

    return true;
  }, [router]);

  const loadElection = useCallback(async () => {
    const supabase = createClient();
    
    const { data: electionData, error: electionError } = await supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .eq('id', resolvedParams.id)
      .single();

    if (electionError || !electionData) {
      console.error('투표 로딩 오류:', electionError);
      alert('투표를 불러오지 못했습니다.');
      router.push('/admin/elections');
      return;
    }

    setElection(electionData);
  }, [resolvedParams.id, router]);

  const loadCandidates = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', resolvedParams.id)
      .order('vote_count', { ascending: false });

    if (error) {
      console.error('후보자 로딩 오류:', error);
      return;
    }

    setCandidates(data || []);
  }, [resolvedParams.id]);

  const loadStats = useCallback(async () => {
    const supabase = createClient();
    
    // 이 투표에 접근 가능한 코드 통계
    const { data: codes, error: codesError } = await supabase
      .from('voter_codes')
      .select('*')
      .contains('accessible_elections', [resolvedParams.id]);

    if (codesError) {
      console.error('코드 통계 로딩 오류:', codesError);
      return;
    }

    const totalCodes = codes?.length || 0;
    const usedCodes = codes?.filter(c => c.is_used).length || 0;
    const unusedCodes = totalCodes - usedCodes;
    const participationRate = totalCodes > 0 ? (usedCodes / totalCodes) * 100 : 0;

    // 총 투표 수
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('voter_code_id')
      .eq('election_id', resolvedParams.id);

    if (votesError) {
      console.error('투표 통계 로딩 오류:', votesError);
    }

    // 고유 투표자 수 (중복 제거)
    const uniqueVoterIds = new Set(votes?.map(v => v.voter_code_id) || []);

    setStats({
      totalCodes,
      usedCodes,
      unusedCodes,
      participationRate,
      totalVotes: votes?.length || 0,
      uniqueVoters: uniqueVoterIds.size,
    });
  }, [resolvedParams.id]);

  const loadVillageStats = useCallback(async () => {
    const supabase = createClient();

    // 모든 마을 가져오기
    const { data: villages, error: villagesError } = await supabase
      .from('villages')
      .select('id, name');

    if (villagesError || !villages) {
      console.error('마을 로딩 오류:', villagesError);
      return;
    }

    const villageStatsData: VillageStats[] = [];

    for (const village of villages) {
      // 각 마을의 코드 통계
      const { data: codes } = await supabase
        .from('voter_codes')
        .select('*')
        .eq('village_id', village.id)
        .contains('accessible_elections', [resolvedParams.id]);

      const codesCount = codes?.length || 0;
      const usedCount = codes?.filter(c => c.is_used).length || 0;
      const participationRate = codesCount > 0 ? (usedCount / codesCount) * 100 : 0;

      if (codesCount > 0) {
        villageStatsData.push({
          villageName: village.name,
          codesCount,
          usedCount,
          participationRate,
        });
      }
    }

    // 투표율 높은 순으로 정렬
    villageStatsData.sort((a, b) => b.participationRate - a.participationRate);
    setVillageStats(villageStatsData);
  }, [resolvedParams.id]);

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;
      
      await loadElection();
      await loadCandidates();
      await loadStats();
      await loadVillageStats();
      setLoading(false);
    };

    initialize();
  }, [checkAuth, loadElection, loadCandidates, loadStats, loadVillageStats]);

  if (loading || !election) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const maxVotes = Math.max(...candidates.map(c => c.vote_count), 1);
  const winners = candidates.filter(c => c.vote_count > 0).slice(0, election.max_selections);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">투표 결과</h1>
              <p className="text-sm text-gray-600 mt-1">{election.title}</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href={`/admin/elections/${election.id}/monitor`}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                📊 모니터링
              </Link>
              <Link 
                href="/admin/results"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                ← 결과 목록
              </Link>
              <Link 
                href="/admin/dashboard"
                className="text-blue-600 hover:text-blue-800 px-4 py-2"
              >
                🏠 대시보드
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 투표 정보 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">투표 정보</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">투표 유형</div>
                <div className="font-semibold">
                  {election.election_type === 'delegate' ? '대의원' : '임원'}
                </div>
              </div>
              {election.position && (
                <div>
                  <div className="text-sm text-gray-600">직책</div>
                  <div className="font-semibold">{election.position}</div>
                </div>
              )}
              {election.villages && (
                <div>
                  <div className="text-sm text-gray-600">마을</div>
                  <div className="font-semibold">{election.villages.name}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-600">최대 선택</div>
                <div className="font-semibold">{election.max_selections}명</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">투표 차수</div>
                <div className="font-semibold">{election.round}차</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">상태</div>
                <div className={`font-semibold ${
                  election.status === 'closed' ? 'text-gray-600' :
                  election.status === 'active' ? 'text-green-600' :
                  'text-blue-600'
                }`}>
                  {election.status === 'closed' ? '종료' :
                   election.status === 'active' ? '진행중' :
                   election.status === 'registering' ? '등록중' : '대기'}
                </div>
              </div>
            </div>
          </div>

          {/* 투표 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">전체 코드</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalCodes}</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">투표 완료</div>
              <div className="text-3xl font-bold text-green-600">{stats.usedCodes}</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">미투표</div>
              <div className="text-3xl font-bold text-gray-500">{stats.unusedCodes}</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">투표율</div>
              <div className="text-3xl font-bold text-blue-600">
                {stats.participationRate.toFixed(1)}%
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">투표자 수</div>
              <div className="text-3xl font-bold text-purple-600">{stats.uniqueVoters}</div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600 mb-1">총 투표 수</div>
              <div className="text-3xl font-bold text-indigo-600">{stats.totalVotes}</div>
            </div>
          </div>

          {/* 당선자 */}
          {winners.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-yellow-400 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🏆 당선자
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {winners.map((winner, index) => (
                  <div key={winner.id} className="bg-white rounded-lg p-4 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                        index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900' :
                        'bg-gradient-to-br from-blue-300 to-blue-400 text-blue-900'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-lg text-gray-900">{winner.name}</div>
                        <div className="text-sm text-gray-600">
                          {winner.vote_count}표 ({((winner.vote_count / stats.totalVotes) * 100).toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 전체 후보자 득표 결과 */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">전체 후보자 득표 결과</h2>
            
            {candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                후보자가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {candidates.map((candidate, index) => {
                  const percentage = maxVotes > 0 ? (candidate.vote_count / maxVotes) * 100 : 0;
                  const votePercentage = stats.totalVotes > 0 ? (candidate.vote_count / stats.totalVotes) * 100 : 0;
                  const isWinner = index < election.max_selections && candidate.vote_count > 0;

                  return (
                    <div 
                      key={candidate.id} 
                      className={`border rounded-lg p-4 ${
                        isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isWinner ? (
                              index === 0 ? 'bg-yellow-200 text-yellow-800' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-200 text-orange-800'
                            ) : 'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              {candidate.name}
                              {isWinner && <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full font-bold">당선</span>}
                            </div>
                            <div className="text-sm text-gray-500">
                              득표율: {votePercentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {candidate.vote_count}
                          </div>
                          <div className="text-xs text-gray-500">표</div>
                        </div>
                      </div>
                      
                      {/* 득표 바 */}
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isWinner ? (
                              index === 0 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                              index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                              'bg-gradient-to-r from-orange-400 to-orange-500'
                            ) : 'bg-blue-400'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 마을별 투표율 (대의원 선거인 경우) */}
          {election.election_type === 'delegate' && villageStats.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">마을별 투표율</h2>
              <div className="space-y-3">
                {villageStats.map((villageStat, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-semibold text-gray-900">{villageStat.villageName}</div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {villageStat.participationRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {villageStat.usedCount} / {villageStat.codesCount}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                        style={{ width: `${villageStat.participationRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
