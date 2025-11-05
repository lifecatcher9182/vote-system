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
}

export default function MonitorPage({ 
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
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

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
      .select('id')
      .eq('election_id', resolvedParams.id);

    if (votesError) {
      console.error('투표 통계 로딩 오류:', votesError);
    }

    setStats({
      totalCodes,
      usedCodes,
      unusedCodes,
      participationRate,
      totalVotes: votes?.length || 0,
    });

    setLastUpdate(new Date());
  }, [resolvedParams.id]);

  const refreshData = useCallback(async () => {
    await loadCandidates();
    await loadStats();
  }, [loadCandidates, loadStats]);

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;
      
      await loadElection();
      await loadCandidates();
      await loadStats();
      setLoading(false);
    };

    initialize();
  }, [checkAuth, loadElection, loadCandidates, loadStats]);

  // 자동 새로고침 (10초마다)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshData();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

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
  const winner = candidates.length > 0 ? candidates[0] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">실시간 모니터링</h1>
              <p className="text-sm text-gray-600 mt-1">{election.title}</p>
            </div>
            <div className="flex gap-3">
              <Link 
                href={`/admin/elections/${election.id}/results`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                📈 결과 보기
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
          {/* 자동 새로고침 컨트롤 */}
          <div className="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoRefresh ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  자동 새로고침 {autoRefresh ? 'ON' : 'OFF'}
                </span>
              </div>
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                🔄 지금 새로고침
              </button>
            </div>
            <p className="text-xs text-gray-500">
              마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
            </p>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
              <div className="text-sm text-gray-600 mb-1">총 투표 수</div>
              <div className="text-3xl font-bold text-purple-600">{stats.totalVotes}</div>
            </div>
          </div>

          {/* 현재 1위 */}
          {winner && winner.vote_count > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🏆</div>
                <div>
                  <div className="text-sm text-amber-700 font-semibold mb-1">현재 1위</div>
                  <div className="text-2xl font-bold text-gray-900">{winner.name}</div>
                  <div className="text-lg text-gray-600">{winner.vote_count}표</div>
                </div>
              </div>
            </div>
          )}

          {/* 득표 현황 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">후보자별 득표 현황</h2>
            
            {candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                후보자가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {candidates.map((candidate, index) => {
                  const percentage = maxVotes > 0 ? (candidate.vote_count / maxVotes) * 100 : 0;
                  const votePercentage = stats.totalVotes > 0 ? (candidate.vote_count / stats.totalVotes) * 100 : 0;

                  return (
                    <div key={candidate.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-200 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{candidate.name}</div>
                            <div className="text-xs text-gray-500">
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
                            index === 0 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                            index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                            index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                            'bg-blue-500'
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

          {/* 안내 메시지 */}
          {election.status !== 'active' && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                ⚠️ 이 투표는 현재 <strong>{
                  election.status === 'waiting' ? '대기' :
                  election.status === 'registering' ? '등록중' :
                  election.status === 'closed' ? '종료' : '알 수 없음'
                }</strong> 상태입니다.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
