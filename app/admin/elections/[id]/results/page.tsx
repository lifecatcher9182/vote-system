'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import { WinningCriteria } from '@/lib/database.types';
import Link from 'next/link';
import AlertModal from '@/components/AlertModal';

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  village_id: string | null;
  max_selections: number;
  round: number;
  status: string;
  winning_criteria: WinningCriteria;
  series_id: string | null;
  series_title: string | null;
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
  attendedCodes: number; // 참석자 (로그인한 사람)
  usedCodes: number; // deprecated
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
    attendedCodes: 0,
    usedCodes: 0,
    unusedCodes: 0,
    participationRate: 0,
    totalVotes: 0,
    uniqueVoters: 0,
  });
  const [villageStats, setVillageStats] = useState<VillageStats[]>([]);

  // 모달 상태
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ 
    isOpen: false, message: '', title: '알림' 
  });

  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin');
      return false;
    }

    const { isAdmin } = await checkAdminAccess(user.email!);
    if (!isAdmin) {
      setAlertModal({ isOpen: true, message: '관리자 권한이 없습니다.', title: '접근 권한 없음' });
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
      setAlertModal({ isOpen: true, message: '투표를 불러오지 못했습니다.', title: '오류' });
      router.push('/admin/dashboard');
      return;
    }

    setElection(electionData);
  }, [resolvedParams.id, router]);

  const loadCandidates = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('candidates')
      .select('id, name, election_id, vote_count')
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
      .select('id, first_login_at, is_used')
      .contains('accessible_elections', [resolvedParams.id]);

    if (codesError) {
      console.error('코드 통계 로딩 오류:', codesError);
      return;
    }

    const totalCodes = codes?.length || 0;
    const attendedCodes = codes?.filter(c => c.first_login_at !== null).length || 0; // 참석자 (로그인한 사람)
    const usedCodes = codes?.filter(c => c.is_used).length || 0; // deprecated
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
      attendedCodes,
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
        .select('id, is_used')
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
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' 
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium" style={{ letterSpacing: '-0.01em' }}>
            로딩 중...
          </p>
        </div>
      </div>
    );
  }

  const maxVotes = Math.max(...candidates.map(c => c.vote_count), 1);
  
  // 득표수가 있는 후보자들만 필터링
  const candidatesWithVotes = candidates.filter(c => c.vote_count > 0);
  
  // 당선 기준 계산
  const calculateWinners = () => {
    if (candidatesWithVotes.length === 0) {
      return { 
        winners: [], 
        hasTie: false, 
        meetsThreshold: false, 
        requiredVotes: 0, 
        thresholdMessage: '',
        confirmedWinners: [],
        tiedCandidates: []
      };
    }

    const criteria = election.winning_criteria;
    let requiredVotes = 0;
    let thresholdMessage = '';
    let meetsThreshold = false;

    // 1. 당선 기준에 따라 필요 득표수 계산
    if (criteria.type === 'plurality') {
      // 최다 득표
      thresholdMessage = '최다 득표자';
      meetsThreshold = true; // 최다 득표는 항상 충족
    } else if (criteria.type === 'absolute_majority') {
      // 절대 과반수 (50% 초과)
      const base = stats.attendedCodes > 0 ? stats.attendedCodes : stats.totalCodes;
      requiredVotes = Math.floor(base / 2) + 1;
      thresholdMessage = `${base}명의 과반(${requiredVotes}표 이상)`;
      meetsThreshold = candidatesWithVotes[0].vote_count > Math.floor(base / 2);
    } else if (criteria.type === 'percentage') {
      // 특정 득표율
      const base = criteria.base === 'attended' 
        ? (stats.attendedCodes > 0 ? stats.attendedCodes : stats.totalCodes)
        : stats.totalCodes;
      requiredVotes = Math.ceil(base * (criteria.percentage / 100));
      const baseText = criteria.base === 'attended' ? '참석자' : '발급 코드';
      thresholdMessage = `${baseText} ${base}명의 ${criteria.percentage}%(${requiredVotes}표 이상)`;
      meetsThreshold = candidatesWithVotes[0].vote_count >= requiredVotes;
    }

    // 2. 동점자 처리
    let winners: typeof candidates = [];
    let hasTie = false;
    let confirmedWinners: typeof candidates = [];
    let tiedCandidates: typeof candidates = [];

    if (!meetsThreshold && criteria.type !== 'plurality') {
      // 기준 미달 → 당선자 없음
      winners = [];
      hasTie = false;
      confirmedWinners = [];
      tiedCandidates = [];
    } else if (candidatesWithVotes.length >= election.max_selections) {
      // 동점자 확인을 위한 로직
      const cutoffVotes = candidatesWithVotes[election.max_selections - 1].vote_count;
      const allTiedAtCutoff = candidatesWithVotes.filter(c => c.vote_count >= cutoffVotes);
      
      if (allTiedAtCutoff.length > election.max_selections) {
        // 동점이 발생한 경우
        hasTie = true;
        
        // 1. 확정 당선자: 동점 득표수보다 많이 받은 후보들
        confirmedWinners = candidatesWithVotes.filter(c => c.vote_count > cutoffVotes);
        
        // 2. 동점 후보자: cutoffVotes와 동일한 득표를 한 후보들
        tiedCandidates = candidatesWithVotes.filter(c => c.vote_count === cutoffVotes);
        
        // winners에는 확정 당선자 + 동점 후보자 모두 포함
        winners = [...confirmedWinners, ...tiedCandidates];
      } else {
        // 동점 없음 - 정상 당선
        winners = candidatesWithVotes.slice(0, election.max_selections);
        confirmedWinners = winners;
        tiedCandidates = [];
      }
    } else {
      // 후보자 수가 선발 인원보다 적은 경우
      winners = candidatesWithVotes;
      confirmedWinners = winners;
      tiedCandidates = [];
    }

    const result = { 
      winners, 
      hasTie, 
      meetsThreshold, 
      requiredVotes, 
      thresholdMessage, 
      confirmedWinners, 
      tiedCandidates 
    };
    
    // 디버깅 로그
    console.log('=== 당선자 계산 결과 ===');
    console.log('전체 후보:', candidatesWithVotes.map(c => `${c.name}: ${c.vote_count}표`));
    console.log('선출 인원:', election.max_selections);
    console.log('hasTie:', hasTie);
    console.log('확정 당선자:', confirmedWinners.map(c => `${c.name}: ${c.vote_count}표`));
    console.log('동점 후보자:', tiedCandidates.map(c => `${c.name}: ${c.vote_count}표`));
    console.log('전체 winners:', winners.map(c => `${c.name}: ${c.vote_count}표`));
    
    return result;
  };

  const { winners, hasTie, meetsThreshold, requiredVotes, thresholdMessage, confirmedWinners, tiedCandidates } = calculateWinners();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                투표 결과
              </h1>
              <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                {election.title}
              </p>
            </div>
            <div className="flex gap-3">
              <Link 
                href={`/admin/elections/${election.id}/monitor`}
                className="btn-apple-secondary text-sm"
              >
                📊 모니터링
              </Link>
              <Link 
                href="/admin/dashboard"
                className="btn-apple-primary text-sm"
              >
                🏠 대시보드
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 투표 정보 */}
        <div className="card-apple p-8 mb-6">
          <h2 className="text-xl font-semibold mb-6" style={{ 
            color: '#1d1d1f',
            letterSpacing: '-0.02em'
          }}>
            투표 정보
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>투표 유형</div>
              <div className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>
                {election.election_type === 'delegate' ? '대의원' : '임원'}
              </div>
            </div>
            {election.position && (
              <div>
                <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>직책</div>
                <div className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>
                  {election.position}
                </div>
              </div>
            )}
            {election.villages && (
              <div>
                <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>마을</div>
                <div className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>
                  {election.villages.name}
                </div>
              </div>
            )}
              <div>
                <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>최대 선택</div>
                <div className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>{election.max_selections}명</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>투표 차수</div>
                <div className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>{election.round}차</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>당선 기준</div>
                <div className="font-semibold" style={{ color: 'var(--color-secondary)', letterSpacing: '-0.01em' }}>{thresholdMessage}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>상태</div>
                <div className={`font-semibold ${
                  election.status === 'closed' ? 'text-gray-600' :
                  election.status === 'active' ? 'text-[var(--color-primary)]' :
                  'text-[var(--color-secondary)]'
                }`} style={{ letterSpacing: '-0.01em' }}>
                  {election.status === 'closed' ? '종료' :
                   election.status === 'active' ? '진행중' : '대기'}
                </div>
              </div>
            </div>
          </div>

          {/* 투표 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-6">
            <div className="card-apple p-6">
              <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>발급 코드</div>
              <div className="text-3xl font-semibold text-gray-900" style={{ letterSpacing: '-0.03em' }}>{stats.totalCodes}</div>
            </div>

            <div className="card-apple p-6">
              <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>참석 확인</div>
              <div className="text-3xl font-semibold" style={{ color: 'var(--color-primary)', letterSpacing: '-0.03em' }}>{stats.attendedCodes}</div>
              <div className="text-xs text-gray-500 mt-2" style={{ letterSpacing: '-0.01em' }}>
                ({stats.totalCodes > 0 ? ((stats.attendedCodes / stats.totalCodes) * 100).toFixed(1) : 0}%)
              </div>
            </div>

            <div className="card-apple p-6">
              <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>투표 완료</div>
              <div className="text-3xl font-semibold" style={{ color: 'var(--color-secondary)', letterSpacing: '-0.03em' }}>{stats.uniqueVoters}</div>
              <div className="text-xs text-gray-500 mt-2" style={{ letterSpacing: '-0.01em' }}>
                ({stats.attendedCodes > 0 ? ((stats.uniqueVoters / stats.attendedCodes) * 100).toFixed(1) : 0}% of 참석)
              </div>
            </div>

            <div className="card-apple p-6">
              <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>미참석</div>
              <div className="text-3xl font-semibold text-gray-500" style={{ letterSpacing: '-0.03em' }}>{stats.totalCodes - stats.attendedCodes}</div>
            </div>

            <div className="card-apple p-6">
              <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>총 투표 수</div>
              <div className="text-3xl font-semibold text-blue-600" style={{ letterSpacing: '-0.03em' }}>{stats.totalVotes}</div>
            </div>
          </div>

          {/* 당선자 또는 기준 미달 */}
          {!meetsThreshold && election.winning_criteria.type !== 'plurality' ? (
            <div className="card-apple p-8 mb-6" style={{ 
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(249, 115, 22, 0.05) 100%)',
              border: '2px solid rgba(239, 68, 68, 0.2)'
            }}>
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                ❌ 당선자 없음 (기준 미달)
              </h2>
              <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-red-200">
                <p className="text-sm text-gray-700 mb-2" style={{ letterSpacing: '-0.01em' }}>
                  <strong>당선 기준:</strong> {thresholdMessage}
                </p>
                <p className="text-sm text-red-600 mt-2 font-semibold">
                  → {election.round === 1 ? '2차 투표를 진행하거나' : election.round === 2 ? '3차 투표(최다득표)를 진행하거나' : ''} 
                  {' '}별도 규정에 따라 결정해주세요.
                </p>
              </div>
            </div>
          ) : winners.length > 0 ? (
            <>
              {/* 확정 당선자 표시 (동점 발생 시) */}
              {hasTie && confirmedWinners && confirmedWinners.length > 0 && (
                <div className="border-2 rounded-lg p-6 mb-6 bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-400">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    🏆 확정 당선자
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {confirmedWinners.map((winner, index) => {
                      // 실제 순위 계산 (득표수 기준)
                      let actualRank = 1;
                      for (let i = 0; i < index; i++) {
                        if (confirmedWinners[i].vote_count > winner.vote_count) {
                          actualRank++;
                        }
                      }
                      
                      return (
                        <div key={winner.id} className="bg-white rounded-lg p-4 shadow-md">
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                              actualRank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900' :
                              actualRank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                              actualRank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900' :
                              'bg-gradient-to-br from-blue-300 to-blue-400 text-gray-800'
                            }`}>
                              {actualRank}
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-lg text-gray-900">{winner.name}</div>
                              <div className="text-sm text-gray-600">
                                {winner.vote_count}표 ({stats.totalVotes > 0 ? ((winner.vote_count / stats.totalVotes) * 100).toFixed(1) : 0}%)
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 동점 후보자 또는 전체 당선자 표시 */}
              <div className={`border-2 rounded-lg p-6 mb-6 ${
                hasTie 
                  ? 'bg-gradient-to-br from-orange-50 to-red-100 border-orange-400'
                  : 'bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-400'
              }`}>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  {hasTie ? '⚠️ 동점으로 미확정 후보' : 
                   election.max_selections === 1 ? '🏆 당선자' : 
                   `🏆 당선자 (상위 ${election.max_selections}명)`}
                </h2>
                {hasTie && (
                  <div className="mb-4 p-4 bg-white/80 rounded-lg border border-orange-300">
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>동점 발생:</strong> {election.max_selections}명을 선출해야 하지만, 
                      {tiedCandidates && tiedCandidates[0]?.vote_count}표로 동점인 후보가 {tiedCandidates?.length || 0}명입니다.
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>남은 선출 인원:</strong> {election.max_selections - (confirmedWinners?.length || 0)}명 
                      (확정 당선자 {confirmedWinners?.length || 0}명)
                    </p>
                    <p className="text-sm text-orange-700 mt-2 font-semibold">
                      → {election.round > 1 ? '이미 결선 투표입니다.' : '결선 투표를 진행하거나'} 별도의 규정에 따라 결정해주세요.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(hasTie && tiedCandidates ? tiedCandidates : winners).map((winner, index) => {
                    // 실제 순위 계산 (득표수 기준)
                    let actualRank = (confirmedWinners?.length || 0) + 1; // 동점자는 확정 당선자 다음 순위
                    if (!hasTie) {
                      actualRank = 1;
                      for (let i = 0; i < index; i++) {
                        if (winners[i].vote_count > winner.vote_count) {
                          actualRank++;
                        }
                      }
                    }
                    
                    return (
                      <div key={winner.id} className={`bg-white rounded-lg p-4 shadow-md ${
                        hasTie ? 'border-2 border-orange-300' : ''
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                            hasTie ? 'bg-orange-200 text-orange-900' :
                            actualRank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900' :
                            actualRank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                            actualRank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900' :
                            'bg-gradient-to-br from-blue-300 to-blue-400 text-gray-800'
                          }`}>
                            {hasTie ? '?' : actualRank}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-gray-900">{winner.name}</div>
                            <div className="text-sm text-gray-600">
                              {winner.vote_count}표 ({stats.totalVotes > 0 ? ((winner.vote_count / stats.totalVotes) * 100).toFixed(1) : 0}%)
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

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
                  
                  // 확정 당선자인지 확인
                  const isConfirmedWinner = confirmedWinners?.some(w => w.id === candidate.id) || false;
                  // 동점 후보자인지 확인
                  const isTiedCandidate = tiedCandidates?.some(t => t.id === candidate.id) || false;
                  // 일반 당선자인지 확인 (동점 없는 경우)
                  const isWinner = !hasTie && winners.some(w => w.id === candidate.id) && candidate.vote_count > 0;
                  
                  // 실제 순위 계산 (득표수 기준, 동점자는 같은 순위)
                  let actualRank = 1;
                  for (let i = 0; i < index; i++) {
                    if (candidates[i].vote_count > candidate.vote_count) {
                      actualRank++;
                    }
                  }

                  return (
                    <div 
                      key={candidate.id} 
                      className={`border rounded-lg p-4 ${
                        isTiedCandidate ? 'border-orange-400 bg-orange-50' :
                        isConfirmedWinner || isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isTiedCandidate ? 'bg-orange-200 text-orange-800' :
                            (isConfirmedWinner || isWinner) ? (
                              actualRank === 1 ? 'bg-yellow-200 text-yellow-800' :
                              actualRank === 2 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-200 text-orange-800'
                            ) : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isTiedCandidate ? '?' : actualRank}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              {candidate.name}
                              {isConfirmedWinner && <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full font-bold">당선</span>}
                              {isTiedCandidate && <span className="text-xs px-2 py-1 bg-orange-200 text-orange-800 rounded-full font-bold">미확정</span>}
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
                            isTiedCandidate ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                            (isConfirmedWinner || isWinner) ? (
                              actualRank === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                              actualRank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
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
                        <div className="text-lg font-bold text-[var(--color-secondary)]">
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
      </main>

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        title={alertModal.title}
      />
    </div>
  );
}
