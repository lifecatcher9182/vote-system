'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import { use } from 'react';
import QRCodeSection from '@/components/QRCodeSection';
import { nanoid } from 'nanoid';

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  village_id: string | null;
  max_selections: number;
  round: number;
  status: 'waiting' | 'active' | 'closed';
  created_at: string;
  group_id: string | null;
  winning_criteria: {
    type: 'plurality' | 'absolute_majority' | 'percentage';
    percentage?: number;
    base?: 'attended' | 'total_codes';
  };
  villages?: {
    name: string;
  };
}

interface Candidate {
  id: string;
  name: string;
  vote_count: number;
}

export default function ElectionDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'results'>('overview');
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  
  // 코드 관리 상태
  const [codeFilter, setCodeFilter] = useState<'all' | 'voted' | 'attended' | 'not_attended'>('all');
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [codeQuantity, setCodeQuantity] = useState(10);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [voterCodes, setVoterCodes] = useState<Array<{
    id: string;
    code: string;
    is_used: boolean;
    village_id: string | null;
    created_at: string;
    first_login_at: string | null;
    has_voted: boolean;
  }>>([]);

  // 결과 상태
  const [resultStats, setResultStats] = useState({
    totalCodes: 0,
    attendedCodes: 0,
    usedCodes: 0,
    unusedCodes: 0,
    participationRate: 0,
    totalVotes: 0,
    uniqueVoters: 0,
  });
  const [villageStats, setVillageStats] = useState<Array<{
    villageName: string;
    codesCount: number;
    usedCount: number;
    participationRate: number;
  }>>([]);

  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin');
      return;
    }

    const { isAdmin } = await checkAdminAccess(user.email!);
    if (!isAdmin) {
      alert('관리자 권한이 없습니다.');
      await signOut();
      router.push('/admin');
      return;
    }

    setLoading(false);
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

    if (electionError) {
      console.error('투표 로딩 오류:', electionError);
      alert('투표를 불러오지 못했습니다.');
      router.push('/admin/dashboard');
      return;
    }

    setElection(electionData);

    const { data: candidatesData, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', resolvedParams.id)
      .order('name', { ascending: true });

    if (candidatesError) {
      console.error('후보자 로딩 오류:', candidatesError);
      return;
    }

    setCandidates(candidatesData || []);
  }, [resolvedParams.id, router]);

  const loadVoterCodes = useCallback(async () => {
    if (!election) return;
    
    const supabase = createClient();
    
    // voter_codes와 votes를 조인해서 투표 여부 확인
    const { data: codesData, error } = await supabase
      .from('voter_codes')
      .select('id, code, is_used, village_id, created_at, first_login_at')
      .contains('accessible_elections', [election.id])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('코드 로딩 오류:', error);
      return;
    }

    // 각 코드에 대해 투표 여부 확인
    const codesWithVoteStatus = await Promise.all(
      (codesData || []).map(async (code) => {
        const { data: voteData } = await supabase
          .from('votes')
          .select('id')
          .eq('voter_code_id', code.id)
          .eq('election_id', election.id)
          .maybeSingle();

        return {
          ...code,
          has_voted: !!voteData
        };
      })
    );

    setVoterCodes(codesWithVoteStatus);
  }, [election]);

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      await loadElection();
    };

    initialize();
  }, [checkAuth, loadElection]);

  useEffect(() => {
    if (activeTab === 'codes' && election) {
      loadVoterCodes();
    }
  }, [activeTab, election, loadVoterCodes]);

  const handleStatusChange = async (newStatus: Election['status']) => {
    if (!election) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('elections')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', election.id);

    if (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경에 실패했습니다.');
      return;
    }

    setElection({ ...election, status: newStatus });
  };

  const handleAddCandidate = async () => {
    if (!newCandidateName.trim()) {
      alert('후보자 이름을 입력하세요.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('candidates')
      .insert([{
        election_id: resolvedParams.id,
        name: newCandidateName.trim(),
        vote_count: 0,
      }]);

    if (error) {
      console.error('후보자 추가 오류:', error);
      alert('후보자 추가에 실패했습니다.');
      return;
    }

    setNewCandidateName('');
    setShowAddCandidate(false);
    loadElection();
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm('정말 이 후보자를 삭제하시겠습니까?')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId);

    if (error) {
      console.error('후보자 삭제 오류:', error);
      alert('후보자 삭제에 실패했습니다.');
      return;
    }

    loadElection();
  };

  const handleGenerateCodes = async () => {
    if (!election) return;
    if (codeQuantity < 1 || codeQuantity > 100) {
      alert('코드는 1-100개까지 생성 가능합니다.');
      return;
    }

    setGeneratingCodes(true);

    try {
      const supabase = createClient();
      const newCodes = [];

      for (let i = 0; i < codeQuantity; i++) {
        newCodes.push({
          code: nanoid(10).toUpperCase(),
          code_type: 'delegate' as const,
          accessible_elections: [election.id],
          village_id: election.village_id,
          is_used: false,
        });
      }

      const { error } = await supabase
        .from('voter_codes')
        .insert(newCodes);

      if (error) {
        console.error('코드 생성 오류:', error);
        alert('코드 생성에 실패했습니다.');
        return;
      }

      alert(`${codeQuantity}개의 코드가 생성되었습니다.`);
      setShowCreateCodeModal(false);
      setCodeQuantity(10);
      loadVoterCodes();
    } catch (error) {
      console.error('코드 생성 오류:', error);
      alert('코드 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('정말 이 코드를 삭제하시겠습니까?')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('voter_codes')
      .delete()
      .eq('id', codeId);

    if (error) {
      console.error('코드 삭제 오류:', error);
      alert('코드 삭제에 실패했습니다.');
      return;
    }

    loadVoterCodes();
  };

  const loadResultStats = useCallback(async () => {
    if (!election) return;
    
    const supabase = createClient();
    
    // 이 투표에 접근 가능한 코드 통계
    const { data: codes } = await supabase
      .from('voter_codes')
      .select('*')
      .contains('accessible_elections', [election.id]);

    const totalCodes = codes?.length || 0;
    const attendedCodes = codes?.filter(c => c.first_login_at !== null).length || 0;
    const usedCodes = codes?.filter(c => c.is_used).length || 0;
    const unusedCodes = totalCodes - usedCodes;
    const participationRate = totalCodes > 0 ? (usedCodes / totalCodes) * 100 : 0;

    // 총 투표 수
    const { data: votes } = await supabase
      .from('votes')
      .select('voter_code_id')
      .eq('election_id', election.id);

    const uniqueVoterIds = new Set(votes?.map(v => v.voter_code_id) || []);

    setResultStats({
      totalCodes,
      attendedCodes,
      usedCodes,
      unusedCodes,
      participationRate,
      totalVotes: votes?.length || 0,
      uniqueVoters: uniqueVoterIds.size,
    });
  }, [election]);

  const loadVillageStats = useCallback(async () => {
    if (!election) return;
    
    const supabase = createClient();

    const { data: villages } = await supabase
      .from('villages')
      .select('id, name');

    if (!villages) return;

    const villageStatsData = [];

    for (const village of villages) {
      const { data: codes } = await supabase
        .from('voter_codes')
        .select('*')
        .eq('village_id', village.id)
        .contains('accessible_elections', [election.id]);

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

    villageStatsData.sort((a, b) => b.participationRate - a.participationRate);
    setVillageStats(villageStatsData);
  }, [election]);

  // 결과 탭 활성화 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'results' && election) {
      loadResultStats();
      loadVillageStats();
      loadElection();
    }
  }, [activeTab, election, loadResultStats, loadVillageStats, loadElection]);

  const calculateWinners = useCallback(() => {
    if (!election) return { winners: [], hasTie: false, meetsThreshold: false, requiredVotes: 0, thresholdMessage: '' };
    
    const candidatesWithVotes = candidates.filter(c => c.vote_count > 0);
    
    if (candidatesWithVotes.length === 0) {
      return { winners: [], hasTie: false, meetsThreshold: false, requiredVotes: 0, thresholdMessage: '' };
    }

    const criteria = election.winning_criteria;
    let requiredVotes = 0;
    let thresholdMessage = '';
    let meetsThreshold = false;

    if (criteria.type === 'plurality') {
      thresholdMessage = '최다 득표자';
      meetsThreshold = true;
    } else if (criteria.type === 'absolute_majority') {
      const base = resultStats.attendedCodes > 0 ? resultStats.attendedCodes : resultStats.totalCodes;
      requiredVotes = Math.floor(base / 2) + 1;
      thresholdMessage = `${base}명의 과반(${requiredVotes}표 이상)`;
      meetsThreshold = candidatesWithVotes[0].vote_count > Math.floor(base / 2);
    } else if (criteria.type === 'percentage') {
      const base = criteria.base === 'attended' 
        ? (resultStats.attendedCodes > 0 ? resultStats.attendedCodes : resultStats.totalCodes)
        : resultStats.totalCodes;
      requiredVotes = Math.ceil(base * ((criteria.percentage || 0) / 100));
      const baseText = criteria.base === 'attended' ? '참석자' : '발급 코드';
      thresholdMessage = `${baseText} ${base}명의 ${criteria.percentage}%(${requiredVotes}표 이상)`;
      meetsThreshold = candidatesWithVotes[0].vote_count >= requiredVotes;
    }

    let winners: typeof candidates = [];
    let hasTie = false;

    if (!meetsThreshold && criteria.type !== 'plurality') {
      winners = [];
      hasTie = false;
    } else if (candidatesWithVotes.length >= election.max_selections) {
      const cutoffVotes = candidatesWithVotes[election.max_selections - 1].vote_count;
      const tiedCandidates = candidatesWithVotes.filter(c => c.vote_count >= cutoffVotes);
      
      if (tiedCandidates.length > election.max_selections) {
        hasTie = true;
        winners = tiedCandidates;
      } else {
        winners = candidatesWithVotes.slice(0, election.max_selections);
      }
    } else {
      winners = candidatesWithVotes;
    }

    return { winners, hasTie, meetsThreshold, requiredVotes, thresholdMessage };
  }, [election, candidates, resultStats]);

  const getStatusBadge = (status: Election['status']) => {
    const badges: Record<string, { text: string; bg: string; color: string; border: string }> = {
      waiting: { text: '대기', bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
      active: { text: '진행중', bg: '#dcfce7', color: '#166534', border: '#86efac' },
      closed: { text: '종료', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
      registering: { text: '진행중', bg: '#dcfce7', color: '#166534', border: '#86efac' }, // 레거시 데이터 대응
    };

    const badge = badges[status] || badges.active; // 알 수 없는 상태는 진행중으로 처리
    return (
      <span 
        className="px-3 py-1.5 text-sm font-semibold rounded-lg"
        style={{
          background: badge.bg,
          color: badge.color,
          border: `1.5px solid ${badge.border}`
        }}
      >
        {badge.text}
      </span>
    );
  };

  if (loading || !election) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-semibold" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.03em'
            }}>
              투표 관리
            </h1>
            <Link 
              href={election.group_id ? `/admin/election-groups/${election.group_id}` : '/admin/dashboard'}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              ← {election.group_id ? '투표 그룹' : '대시보드'}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 탭 네비게이션 */}
          <div className="card-apple p-2 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'overview' ? 'text-white' : 'text-gray-700'
                }`}
                style={{
                  background: activeTab === 'overview' ? 'var(--color-secondary)' : 'transparent',
                  letterSpacing: '-0.01em'
                }}
              >
                📋 개요
              </button>
              {/* 총대 투표만 코드 관리 탭 표시 */}
              {election.election_type === 'delegate' && (
                <button
                  onClick={() => setActiveTab('codes')}
                  className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    activeTab === 'codes' ? 'text-white' : 'text-gray-700'
                  }`}
                  style={{
                    background: activeTab === 'codes' ? 'var(--color-secondary)' : 'transparent',
                    letterSpacing: '-0.01em'
                  }}
                >
                  🎫 코드 관리
                </button>
              )}
              <button
                onClick={() => setActiveTab('results')}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'results' ? 'text-white' : 'text-gray-700'
                }`}
                style={{
                  background: activeTab === 'results' ? 'var(--color-secondary)' : 'transparent',
                  letterSpacing: '-0.01em'
                }}
              >
                📈 결과
              </button>
            </div>
          </div>

          {/* 개요 탭 */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 투표 정보 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">투표 정보</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between py-3 border-b border-gray-200">
                    <span className="font-medium text-gray-700">제목</span>
                    <span className="text-gray-900">{election.title}</span>
                  </div>
                  
                  <div className="flex justify-between py-3 border-b border-gray-200">
                    <span className="font-medium text-gray-700">유형</span>
                    <span className="text-gray-900">
                      {election.election_type === 'delegate' ? '총대 선출' : '임원 선출'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between py-3 border-b border-gray-200">
                    <span className="font-medium text-gray-700">대상</span>
                    <span className="text-gray-900">
                      {election.election_type === 'delegate' 
                        ? election.villages?.name || '-'
                        : election.position || '-'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between py-3 border-b border-gray-200">
                    <span className="font-medium text-gray-700">라운드</span>
                    <span className="text-gray-900">{election.round}차</span>
                  </div>
                  
                  <div className="flex justify-between py-3 border-b border-gray-200">
                    <span className="font-medium text-gray-700">최대 선택 수</span>
                    <span className="text-gray-900">{election.max_selections}명</span>
                  </div>
                  
                  <div className="flex justify-between py-3">
                    <span className="font-medium text-gray-700">생성일</span>
                    <span className="text-gray-900">
                      {new Date(election.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 후보자 목록 */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">후보자 목록 ({candidates.length}명)</h2>
                  <button
                    onClick={() => setShowAddCandidate(true)}
                    className="px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 text-sm"
                  >
                    + 후보자 추가
                  </button>
                </div>

                {showAddCandidate && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCandidateName}
                        onChange={(e) => setNewCandidateName(e.target.value)}
                        placeholder="후보자 이름"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCandidate();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddCandidate}
                        className="px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90"
                      >
                        추가
                      </button>
                      <button
                        onClick={() => {
                          setShowAddCandidate(false);
                          setNewCandidateName('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {candidates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    후보자가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {candidates.map((candidate, index) => (
                      <div 
                        key={candidate.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-400">
                            {index + 1}
                          </span>
                          <span className="font-medium">{candidate.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">
                            득표: {candidate.vote_count}표
                          </span>
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 상태 관리 */}
            <div className="space-y-6">
              {/* QR 코드 섹션 */}
              <QRCodeSection 
                electionId={election.id}
                title={election.title}
              />

              {/* 임원 투표 코드 관리 안내 */}
              {election.election_type === 'officer' && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <div className="flex gap-3">
                    <div className="text-2xl">ℹ️</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 mb-2">참여 코드 관리</h3>
                      <p className="text-sm text-blue-800 mb-3">
                        임원 투표는 하나의 코드로 모든 임원 투표에 참여할 수 있도록 설계되었습니다.
                      </p>
                      <p className="text-sm text-blue-800 mb-3">
                        참여 코드는 <strong>투표 그룹 페이지</strong>에서 생성하고 관리하세요.
                      </p>
                      <Link
                        href={`/admin/election-groups`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <span>→</span>
                        <span>투표 그룹으로 이동</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">상태 관리</h2>
                
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">현재 상태</span>
                    {getStatusBadge(election.status)}
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handleStatusChange('waiting')}
                    disabled={election.status === 'waiting'}
                    className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:cursor-not-allowed"
                    style={{
                      background: election.status === 'waiting' ? '#f3f4f6' : 'white',
                      border: election.status === 'waiting' ? '2px solid #9ca3af' : '2px solid #e5e7eb',
                      color: election.status === 'waiting' ? '#374151' : '#6b7280',
                      opacity: election.status === 'waiting' ? 0.7 : 1
                    }}
                  >
                    {election.status === 'waiting' && '✓ '}대기
                  </button>
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={election.status === 'active'}
                    className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:cursor-not-allowed"
                    style={{
                      background: election.status === 'active' ? '#dcfce7' : 'white',
                      border: election.status === 'active' ? '2px solid #22c55e' : '2px solid #e5e7eb',
                      color: election.status === 'active' ? '#166534' : '#6b7280',
                      opacity: election.status === 'active' ? 0.7 : 1
                    }}
                  >
                    {election.status === 'active' && '✓ '}진행중
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed')}
                    disabled={election.status === 'closed'}
                    className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:cursor-not-allowed"
                    style={{
                      background: election.status === 'closed' ? '#fee2e2' : 'white',
                      border: election.status === 'closed' ? '2px solid #ef4444' : '2px solid #e5e7eb',
                      color: election.status === 'closed' ? '#991b1b' : '#6b7280',
                      opacity: election.status === 'closed' ? 0.7 : 1
                    }}
                  >
                    {election.status === 'closed' && '✓ '}종료
                  </button>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-700">
                  <p className="font-semibold mb-2">상태 설명</p>
                  <ul className="space-y-1.5 list-none">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span><strong>대기</strong>: 투표 준비 중</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span><strong>등록중</strong>: 후보자 등록 및 투표 진행 중</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400">•</span>
                      <span><strong>종료</strong>: 투표 마감</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* 코드 관리 탭 */}
          {activeTab === 'codes' && election && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setCodeFilter('all')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'all' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'all' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'all' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setCodeFilter('voted')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'voted' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'voted' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'voted' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    투표 완료
                  </button>
                  <button
                    onClick={() => setCodeFilter('attended')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'attended' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'attended' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'attended' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    참석 확인
                  </button>
                  <button
                    onClick={() => setCodeFilter('not_attended')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'not_attended' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'not_attended' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'not_attended' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    미참석
                  </button>
                </div>
                
                <button
                  onClick={() => setShowCreateCodeModal(true)}
                  className="btn-apple-primary inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  코드 생성
                </button>
              </div>

              <div className="card-apple p-8">
                <h2 className="text-2xl font-semibold mb-4" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  참여 코드 관리
                </h2>
                <p className="text-gray-600 mb-8" style={{ letterSpacing: '-0.01em' }}>
                  이 투표({election.title})의 참여 코드를 생성하고 관리합니다.
                </p>
                
                {voterCodes.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                      생성된 코드가 없습니다
                    </h3>
                    <p className="text-gray-500 mb-8" style={{ letterSpacing: '-0.01em' }}>
                      &ldquo;코드 생성&rdquo; 버튼을 눌러 참여 코드를 만드세요
                    </p>
                    <button
                      onClick={() => setShowCreateCodeModal(true)}
                      className="btn-apple-primary inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      코드 생성
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-gray-600">
                        총 {voterCodes.length}개의 코드
                        {codeFilter !== 'all' && ` (${
                          voterCodes.filter(code => {
                            if (codeFilter === 'voted') return code.has_voted;
                            if (codeFilter === 'attended') return code.first_login_at && !code.has_voted;
                            if (codeFilter === 'not_attended') return !code.first_login_at;
                            return true;
                          }).length
                        }개 표시)`}
                      </p>
                    </div>
                    
                    <div className="grid gap-3">
                      {voterCodes
                        .filter(code => {
                          if (codeFilter === 'all') return true;
                          if (codeFilter === 'voted') return code.has_voted;
                          if (codeFilter === 'attended') return code.first_login_at && !code.has_voted;
                          if (codeFilter === 'not_attended') return !code.first_login_at;
                          return true;
                        })
                        .map((code) => (
                        <div 
                          key={code.id}
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                          style={{ background: 'white' }}
                        >
                          <div className="flex items-center gap-4">
                            <code className="px-3 py-1.5 rounded-lg text-lg font-mono font-semibold" style={{ 
                              background: 'rgba(0, 0, 0, 0.04)',
                              color: '#1d1d1f',
                              letterSpacing: '0.05em'
                            }}>
                              {code.code}
                            </code>
                            <div className="flex gap-2">
                              {code.has_voted ? (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                  투표 완료
                                </span>
                              ) : code.first_login_at ? (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                  참석 확인
                                </span>
                              ) : (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                                  미참석
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(code.code);
                                alert('코드가 복사되었습니다.');
                              }}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                              style={{ 
                                background: 'rgba(0, 0, 0, 0.04)',
                                color: '#1d1d1f'
                              }}
                            >
                              복사
                            </button>
                            <button
                              onClick={() => handleDeleteCode(code.id)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#dc2626'
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 코드 생성 모달 */}
              {showCreateCodeModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
                  <div className="card-apple max-w-md w-full p-8 animate-[scale-in_0.2s_ease-out]">
                    <h2 className="text-2xl font-semibold mb-6" style={{ 
                      color: '#1d1d1f',
                      letterSpacing: '-0.02em'
                    }}>
                      참여 코드 생성
                    </h2>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                        생성 개수
                      </label>
                      <input
                        type="number"
                        value={codeQuantity}
                        onChange={(e) => setCodeQuantity(parseInt(e.target.value) || 1)}
                        min="1"
                        max="100"
                        className="input-apple"
                        placeholder="생성할 코드 개수"
                      />
                      <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                        1-100개까지 생성 가능합니다
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateCodeModal(false);
                          setCodeQuantity(10);
                        }}
                        className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                        style={{ 
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: '#1d1d1f',
                          letterSpacing: '-0.01em'
                        }}
                        disabled={generatingCodes}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleGenerateCodes}
                        className="btn-apple-primary flex-1"
                        disabled={generatingCodes}
                      >
                        {generatingCodes ? '생성 중...' : '생성'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 결과 & 모니터링 탭 */}
          {activeTab === 'results' && (() => {
            const { winners, hasTie, meetsThreshold, requiredVotes, thresholdMessage } = calculateWinners();
            const candidatesWithVotes = candidates.filter(c => c.vote_count > 0);
            const maxVotes = Math.max(...candidates.map(c => c.vote_count), 1);

            return (
              <div className="space-y-6">
                {/* 투표 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="card-apple p-6">
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>발급 코드</div>
                    <div className="text-2xl font-semibold text-gray-900">{resultStats.totalCodes}</div>
                  </div>

                  <div className="card-apple p-6">
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>참석 확인</div>
                    <div className="text-2xl font-semibold" style={{ color: 'var(--color-primary)' }}>{resultStats.attendedCodes}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ({resultStats.totalCodes > 0 ? ((resultStats.attendedCodes / resultStats.totalCodes) * 100).toFixed(1) : 0}%)
                    </div>
                  </div>

                  <div className="card-apple p-6">
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>투표 완료</div>
                    <div className="text-2xl font-semibold" style={{ color: 'var(--color-secondary)' }}>{resultStats.uniqueVoters}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ({resultStats.attendedCodes > 0 ? ((resultStats.uniqueVoters / resultStats.attendedCodes) * 100).toFixed(1) : 0}%)
                    </div>
                  </div>

                  <div className="card-apple p-6">
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>미참석</div>
                    <div className="text-2xl font-semibold text-gray-500">{resultStats.totalCodes - resultStats.attendedCodes}</div>
                  </div>

                  <div className="card-apple p-6">
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>총 투표 수</div>
                    <div className="text-2xl font-semibold text-blue-600">{resultStats.totalVotes}</div>
                  </div>
                </div>

                {/* 당선자 또는 기준 미달 */}
                {!meetsThreshold && election.winning_criteria.type !== 'plurality' ? (
                  <div className="card-apple p-6" style={{ 
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(249, 115, 22, 0.05) 100%)',
                    border: '2px solid rgba(239, 68, 68, 0.2)'
                  }}>
                    <h2 className="text-xl font-semibold mb-3 flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                      ❌ 당선자 없음 (기준 미달)
                    </h2>
                    <div className="p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.8)' }}>
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>당선 기준:</strong> {thresholdMessage}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>최고 득표:</strong> {candidatesWithVotes[0]?.name} {candidatesWithVotes[0]?.vote_count}표
                        {requiredVotes > 0 && ` (필요: ${requiredVotes}표)`}
                      </p>
                      <p className="text-sm text-red-600 mt-2 font-semibold">
                        → {election.round === 1 ? '2차 투표' : election.round === 2 ? '3차 투표(최다득표)' : ''}를 진행하거나 별도 규정에 따라 결정해주세요.
                      </p>
                    </div>
                  </div>
                ) : winners.length > 0 ? (
                  <div className={`p-6 rounded-xl ${
                    hasTie 
                      ? 'bg-gradient-to-br from-orange-50 to-red-100 border-2 border-orange-400'
                      : 'bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-yellow-400'
                  }`}>
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                      {hasTie ? '⚠️ 동점으로 당선자 미확정' : 
                       election.max_selections === 1 ? '🏆 당선자' : 
                       `🏆 당선자 (상위 ${election.max_selections}명)`}
                    </h2>
                    {hasTie && (
                      <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.8)' }}>
                        <p className="text-sm text-gray-700">
                          <strong>동점 발생:</strong> {election.max_selections}명을 선출해야 하지만, 
                          {winners[election.max_selections - 1]?.vote_count}표로 동점인 후보가 {winners.length}명입니다.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {winners.map((winner, index) => {
                        let actualRank = 1;
                        for (let i = 0; i < index; i++) {
                          if (winners[i].vote_count > winner.vote_count) {
                            actualRank++;
                          }
                        }
                        
                        return (
                          <div key={winner.id} className={`p-4 rounded-xl shadow-sm ${
                            hasTie ? 'border-2 border-orange-300' : ''
                          }`} style={{ background: 'white' }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                                hasTie ? 'bg-orange-200 text-orange-900' :
                                actualRank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900' :
                                actualRank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                                actualRank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900' :
                                'bg-gradient-to-br from-blue-300 to-blue-400 text-gray-800'
                              }`}>
                                {hasTie ? '?' : actualRank}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{winner.name}</div>
                                <div className="text-sm text-gray-600">
                                  {winner.vote_count}표 ({resultStats.totalVotes > 0 ? ((winner.vote_count / resultStats.totalVotes) * 100).toFixed(1) : 0}%)
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* 전체 후보자 득표 결과 */}
                <div className="card-apple p-6">
                  <h2 className="text-xl font-bold mb-6" style={{ color: '#1d1d1f' }}>전체 후보자 득표 결과</h2>
                  
                  {candidates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      후보자가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {candidates.map((candidate, index) => {
                        const percentage = maxVotes > 0 ? (candidate.vote_count / maxVotes) * 100 : 0;
                        const votePercentage = resultStats.totalVotes > 0 ? (candidate.vote_count / resultStats.totalVotes) * 100 : 0;
                        const isWinner = !hasTie && winners.some(w => w.id === candidate.id);
                        const isTied = hasTie && winners.some(w => w.id === candidate.id);
                        
                        let actualRank = 1;
                        for (let i = 0; i < index; i++) {
                          if (candidates[i].vote_count > candidate.vote_count) {
                            actualRank++;
                          }
                        }

                        return (
                          <div 
                            key={candidate.id} 
                            className={`border rounded-xl p-4 ${
                              isTied ? 'border-orange-400 bg-orange-50' :
                              isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                  isTied ? 'bg-orange-200 text-orange-800' :
                                  isWinner ? (
                                    actualRank === 1 ? 'bg-yellow-200 text-yellow-800' :
                                    actualRank === 2 ? 'bg-gray-300 text-gray-700' :
                                    'bg-orange-200 text-orange-800'
                                  ) : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isTied ? '?' : actualRank}
                                </div>
                                <div>
                                  <div className="font-semibold flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                                    {candidate.name}
                                    {isWinner && <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full font-bold">당선</span>}
                                    {isTied && <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full font-bold">동점</span>}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    득표율: {votePercentage.toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold" style={{ color: '#1d1d1f' }}>
                                  {candidate.vote_count}
                                </div>
                                <div className="text-xs text-gray-500">표</div>
                              </div>
                            </div>
                            
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isTied ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                                  isWinner ? (
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

                {/* 마을별 투표율 */}
                {election.election_type === 'delegate' && villageStats.length > 0 && (
                  <div className="card-apple p-6">
                    <h2 className="text-xl font-bold mb-6" style={{ color: '#1d1d1f' }}>마을별 투표율</h2>
                    <div className="space-y-3">
                      {villageStats.map((villageStat, index) => (
                        <div key={index} className="border border-gray-200 rounded-xl p-4" style={{ background: 'white' }}>
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-semibold" style={{ color: '#1d1d1f' }}>{villageStat.villageName}</div>
                            <div className="text-right">
                              <div className="text-lg font-bold" style={{ color: 'var(--color-secondary)' }}>
                                {villageStat.participationRate.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {villageStat.usedCount} / {villageStat.codesCount}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
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
            );
          })()}
        </div>
      </main>
    </div>
  );
}
