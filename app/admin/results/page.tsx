'use client';

import { useEffect, useState, useCallback } from 'react';
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

interface ElectionStats {
  electionId: string;
  totalCodes: number;
  usedCodes: number;
  participationRate: number;
  totalVotes: number;
  topCandidate: string | null;
  topCandidateVotes: number;
}

export default function AllResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [elections, setElections] = useState<Election[]>([]);
  const [stats, setStats] = useState<Map<string, ElectionStats>>(new Map());
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

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

  const loadElections = useCallback(async () => {
    const supabase = createClient();
    
    let query = supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query = query.eq('status', 'active');
    } else if (filter === 'closed') {
      query = query.eq('status', 'closed');
    }

    const { data, error } = await query;

    if (error) {
      console.error('투표 로딩 오류:', error);
      return;
    }

    setElections(data || []);

    // 각 투표의 통계 로드
    const newStats = new Map<string, ElectionStats>();
    
    for (const election of data || []) {
      // 코드 통계
      const { data: codes } = await supabase
        .from('voter_codes')
        .select('*')
        .contains('accessible_elections', [election.id]);

      const totalCodes = codes?.length || 0;
      const usedCodes = codes?.filter(c => c.is_used).length || 0;
      const participationRate = totalCodes > 0 ? (usedCodes / totalCodes) * 100 : 0;

      // 투표 수
      const { data: votes } = await supabase
        .from('votes')
        .select('id')
        .eq('election_id', election.id);

      // 1위 후보자
      const { data: candidates } = await supabase
        .from('candidates')
        .select('name, vote_count')
        .eq('election_id', election.id)
        .order('vote_count', { ascending: false })
        .limit(1);

      newStats.set(election.id, {
        electionId: election.id,
        totalCodes,
        usedCodes,
        participationRate,
        totalVotes: votes?.length || 0,
        topCandidate: candidates && candidates.length > 0 ? candidates[0].name : null,
        topCandidateVotes: candidates && candidates.length > 0 ? candidates[0].vote_count : 0,
      });
    }

    setStats(newStats);
  }, [filter]);

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;
      
      await loadElections();
      setLoading(false);
    };

    initialize();
  }, [checkAuth, loadElections]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      waiting: { text: '대기', color: 'bg-gray-100 text-gray-800' },
      registering: { text: '등록중', color: 'bg-blue-100 text-blue-800' },
      active: { text: '진행중', color: 'bg-green-100 text-green-800' },
      closed: { text: '종료', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">📊 전체 투표 결과</h1>
            <Link 
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-800"
            >
              ← 대시보드로
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 필터 */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              진행중
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'closed'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              종료
            </button>
          </div>

          {/* 투표 목록 */}
          {elections.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">📊</div>
              <p className="text-gray-600">투표가 없습니다.</p>
              <Link
                href="/admin/elections/create"
                className="mt-4 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + 투표 생성하기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {elections.map((election) => {
                const electionStats = stats.get(election.id);

                return (
                  <div key={election.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      {/* 헤더 */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{election.title}</h3>
                            {getStatusBadge(election.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>
                              {election.election_type === 'delegate' ? '🗳️ 대의원' : '👔 임원'}
                            </span>
                            <span>
                              {election.election_type === 'delegate'
                                ? `📍 ${election.villages?.name || '-'}`
                                : `📋 ${election.position || '-'}`
                              }
                            </span>
                            <span>🔢 {election.round}차</span>
                            <span>✅ 최대 {election.max_selections}명</span>
                          </div>
                        </div>
                      </div>

                      {/* 통계 */}
                      {electionStats && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">전체 코드</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {electionStats.totalCodes}
                            </div>
                          </div>

                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">투표 완료</div>
                            <div className="text-2xl font-bold text-green-600">
                              {electionStats.usedCodes}
                            </div>
                          </div>

                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">투표율</div>
                            <div className="text-2xl font-bold text-blue-600">
                              {electionStats.participationRate.toFixed(1)}%
                            </div>
                          </div>

                          <div className="bg-purple-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">총 투표</div>
                            <div className="text-2xl font-bold text-purple-600">
                              {electionStats.totalVotes}
                            </div>
                          </div>

                          <div className="bg-yellow-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">현재 1위</div>
                            <div className="text-sm font-bold text-yellow-700 truncate">
                              {electionStats.topCandidate || '-'}
                            </div>
                            <div className="text-xs text-gray-600">
                              {electionStats.topCandidateVotes}표
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/elections/${election.id}/monitor`}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center text-sm font-medium"
                        >
                          📊 실시간 모니터링
                        </Link>
                        <Link
                          href={`/admin/elections/${election.id}/results`}
                          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center text-sm font-medium"
                        >
                          📈 상세 결과
                        </Link>
                        <Link
                          href={`/admin/elections/${election.id}`}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center text-sm font-medium"
                        >
                          ⚙️ 관리
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
