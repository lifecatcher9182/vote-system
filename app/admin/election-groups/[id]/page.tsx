'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';
import { nanoid } from 'nanoid';

interface ElectionGroup {
  id: string;
  title: string;
  description: string | null;
  group_type: 'delegate' | 'officer';
  status: 'waiting' | 'active' | 'closed';
  created_at: string;
  updated_at: string;
}

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  village_id: string | null;
  max_selections: number;
  status: 'waiting' | 'active' | 'closed';
  created_at: string;
  villages?: {
    name: string;
  };
  _count?: {
    candidates: number;
    votes: number;
  };
}

export default function ElectionGroupDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ElectionGroup | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  
  // 일괄 생성 모달 관련 state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);
  
  // 총대 일괄 생성 (마을 기반)
  const [villages, setVillages] = useState<Array<{ id: string; name: string; selections: number }>>([]);
  
  // 임원 일괄 생성 (직책 기반)
  const [positions, setPositions] = useState<Array<{ name: string; selections: number }>>([
    { name: '회장', selections: 1 },
    { name: '총무', selections: 1 },
    { name: '회계', selections: 1 },
    { name: '서기', selections: 1 }
  ]);

  // 코드 관리 상태 (임원 투표용)
  const [codeFilter, setCodeFilter] = useState<'all' | 'not_attended' | 'attended' | 'voting' | 'completed'>('all');
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
    vote_count: number; // 이 코드로 투표한 투표 수
  }>>([]);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const loadGroup = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('election_groups')
      .select('*')
      .eq('id', resolvedParams.id)
      .single();

    if (error || !data) {
      console.error('그룹 로딩 오류:', error);
      alert('그룹을 찾을 수 없습니다.');
      router.push('/admin/election-groups');
      return;
    }

    setGroup(data);
  }, [resolvedParams.id, router]);

  const loadElections = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .eq('group_id', resolvedParams.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('투표 로딩 오류:', error);
      return;
    }

    // 각 투표별 후보자 수와 투표 수 조회
    const electionsWithCounts = await Promise.all(
      (data || []).map(async (election) => {
        const { data: candidates } = await supabase
          .from('candidates')
          .select('id')
          .eq('election_id', election.id);

        const { data: votes } = await supabase
          .from('votes')
          .select('id')
          .eq('election_id', election.id);

        return {
          ...election,
          _count: {
            candidates: candidates?.length || 0,
            votes: votes?.length || 0,
          },
        };
      })
    );

    setElections(electionsWithCounts);
  }, [resolvedParams.id]);

  const handleDeleteElection = async (electionId: string, electionTitle: string) => {
    if (!confirm(`"${electionTitle}" 투표를 삭제하시겠습니까?\n\n관련된 후보자, 투표 데이터도 모두 삭제됩니다.`)) {
      return;
    }

    const supabase = createClient();

    // 투표 삭제 (cascade로 후보자, 투표 데이터도 자동 삭제됨)
    const { error } = await supabase
      .from('elections')
      .delete()
      .eq('id', electionId);

    if (error) {
      console.error('투표 삭제 오류:', error);
      alert('투표 삭제에 실패했습니다.');
      return;
    }

    alert('투표가 삭제되었습니다.');
    loadElections(); // 목록 새로고침
  };

  const loadVillages = useCallback(async () => {
    const supabase = createClient();
    
    // is_active 컬럼이 있으면 활성화된 마을만, 없으면 모든 마을 가져오기
    const { data, error } = await supabase
      .from('villages')
      .select('id, name, is_active')
      .order('name');

    if (error) {
      console.error('마을 로딩 오류:', error);
      // is_active 컬럼이 없는 경우 모든 마을 가져오기
      const { data: allData } = await supabase
        .from('villages')
        .select('id, name')
        .order('name');
      
      if (allData) {
        setVillages(allData.map(v => ({ ...v, selections: 1 })));
      }
      return;
    }

    // is_active가 true인 마을만 필터링
    const activeVillages = (data || []).filter(v => v.is_active !== false);
    setVillages(activeVillages.map(v => ({ ...v, selections: 1 })));
  }, []);

  // 임원 투표용 코드 로딩
  const loadVoterCodes = useCallback(async () => {
    if (!group || group.group_type !== 'officer') return;
    
    const supabase = createClient();
    
    // 이 그룹의 모든 투표 ID 가져오기
    const electionIds = elections.map(e => e.id);
    if (electionIds.length === 0) return;
    
    // voter_codes에서 이 그룹의 투표에 접근 가능한 코드 조회
    const { data: codesData, error } = await supabase
      .from('voter_codes')
      .select('id, code, is_used, village_id, created_at, first_login_at, accessible_elections')
      .eq('code_type', 'officer')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('코드 로딩 오류:', error);
      return;
    }

    // accessible_elections에 이 그룹의 투표 ID가 포함된 코드만 필터링
    const filteredCodes = (codesData || []).filter(code => {
      // accessible_elections가 배열 형태로 저장되어 있는지 확인
      const accessibleElections = (code as { accessible_elections?: string[] }).accessible_elections || [];
      return electionIds.some(id => accessibleElections.includes(id));
    });

    // 각 코드가 실제로 투표한 선거 개수 계산
    const codeIds = filteredCodes.map(c => c.id);
    const { data: votesData } = await supabase
      .from('votes')
      .select('voter_code_id, election_id')
      .in('voter_code_id', codeIds)
      .in('election_id', electionIds);

    // 코드별로 투표한 선거 ID를 Set으로 집계
    const voteCountMap = new Map<string, Set<string>>();
    votesData?.forEach(vote => {
      if (!voteCountMap.has(vote.voter_code_id)) {
        voteCountMap.set(vote.voter_code_id, new Set());
      }
      voteCountMap.get(vote.voter_code_id)!.add(vote.election_id);
    });

    // 각 코드에 completed_election_count 추가
    const codesWithVoteCount = filteredCodes.map(code => ({
      ...code,
      vote_count: voteCountMap.get(code.id)?.size || 0 // 투표한 선거 개수
    }));

    setVoterCodes(codesWithVoteCount);
  }, [group, elections]);

  // 임원 투표용 코드 생성
  const handleGenerateCodes = async () => {
    if (!group || group.group_type !== 'officer') return;
    if (codeQuantity < 1 || codeQuantity > 100) {
      alert('코드는 1-100개까지 생성 가능합니다.');
      return;
    }

    if (elections.length === 0) {
      alert('투표를 먼저 생성해주세요.');
      return;
    }

    setGeneratingCodes(true);

    try {
      const supabase = createClient();
      const electionIds = elections.map(e => e.id);
      const newCodes = [];

      for (let i = 0; i < codeQuantity; i++) {
        newCodes.push({
          code: nanoid(10).toUpperCase(),
          code_type: 'officer' as const,
          accessible_elections: electionIds,
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

  // 코드 삭제
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

  const handleBatchCreate = async () => {
    if (!group) return;

    if (group.group_type === 'delegate') {
      // 총대 일괄 생성 - 마을별
      const selectedVillages = villages.filter(v => v.selections > 0);
      if (selectedVillages.length === 0) {
        alert('생성할 마을을 선택하세요.');
        return;
      }

      if (!confirm(`${selectedVillages.length}개 마을에 대한 투표를 생성하시겠습니까?`)) {
        return;
      }

      setBatchCreating(true);
      const supabase = createClient();

      try {
        for (const village of selectedVillages) {
          const { error } = await supabase
            .from('elections')
            .insert({
              title: `${village.name} 총대 선출`,
              election_type: 'delegate',
              village_id: village.id,
              max_selections: village.selections,
              round: 1,
              status: 'waiting',
              group_id: group.id
            });

          if (error) throw error;
        }

        alert(`${selectedVillages.length}개의 투표가 생성되었습니다.`);
        setShowBatchModal(false);
        loadElections();
      } catch (error) {
        console.error('일괄 생성 오류:', error);
        alert('일괄 생성 중 오류가 발생했습니다.');
      } finally {
        setBatchCreating(false);
      }

    } else {
      // 임원 일괄 생성 - 직책별
      const selectedPositions = positions.filter(p => p.selections > 0);
      if (selectedPositions.length === 0) {
        alert('생성할 직책을 선택하세요.');
        return;
      }

      if (!confirm(`${selectedPositions.length}개 직책에 대한 투표를 생성하시겠습니까?`)) {
        return;
      }

      setBatchCreating(true);
      const supabase = createClient();

      try {
        const newElectionIds: string[] = [];
        
        for (const position of selectedPositions) {
          const { data, error } = await supabase
            .from('elections')
            .insert({
              title: `${position.name} 선출`,
              election_type: 'officer',
              position: position.name,
              max_selections: position.selections,
              round: 1,
              status: 'waiting',
              group_id: group.id
            })
            .select('id')
            .single();

          if (error) throw error;
          if (data) newElectionIds.push(data.id);
        }

        // 기존 임원 코드들의 accessible_elections 업데이트
        if (newElectionIds.length > 0) {
          const currentElectionIds = elections.map(e => e.id);
          const allElectionIds = [...currentElectionIds, ...newElectionIds];

          // 이 그룹의 기존 코드 가져오기
          const { data: existingCodes } = await supabase
            .from('voter_codes')
            .select('id, accessible_elections')
            .eq('code_type', 'officer')
            .contains('accessible_elections', currentElectionIds);

          // 각 코드의 accessible_elections 업데이트
          if (existingCodes && existingCodes.length > 0) {
            for (const code of existingCodes) {
              await supabase
                .from('voter_codes')
                .update({ accessible_elections: allElectionIds })
                .eq('id', code.id);
            }
          }
        }

        alert(`${selectedPositions.length}개의 투표가 생성되었습니다.`);
        setShowBatchModal(false);
        loadElections();
      } catch (error) {
        console.error('일괄 생성 오류:', error);
        alert('일괄 생성 중 오류가 발생했습니다.');
      } finally {
        setBatchCreating(false);
      }
    }
  };

  const handleStatusChange = async (newStatus: 'waiting' | 'active' | 'closed') => {
    if (!group) return;

    const confirmMessage = 
      newStatus === 'active' ? '이 그룹을 활성화하시겠습니까?' :
      newStatus === 'closed' ? '이 그룹을 종료하시겠습니까? (되돌릴 수 없습니다)' :
      '이 그룹을 대기 상태로 변경하시겠습니까?';

    if (!confirm(confirmMessage)) return;

    const supabase = createClient();

    const { error } = await supabase
      .from('election_groups')
      .update({ status: newStatus })
      .eq('id', group.id);

    if (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경에 실패했습니다.');
      return;
    }

    alert('상태가 변경되었습니다.');
    await loadGroup();
  };

  const handleDelete = async () => {
    if (!group) return;

    if (elections.length > 0) {
      alert('하위 투표가 있는 그룹은 삭제할 수 없습니다. 먼저 투표들을 삭제해주세요.');
      return;
    }

    if (!confirm('정말로 이 그룹을 삭제하시겠습니까?')) return;

    const supabase = createClient();

    const { error } = await supabase
      .from('election_groups')
      .delete()
      .eq('id', group.id);

    if (error) {
      console.error('그룹 삭제 오류:', error);
      alert('그룹 삭제에 실패했습니다.');
      return;
    }

    alert('그룹이 삭제되었습니다.');
    router.push('/admin/election-groups');
  };

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;

      await loadGroup();
      await loadElections();
      await loadVillages(); // 마을 목록 로드 (총대용)
      setLoading(false);
    };

    initialize();
  }, [checkAuth, loadGroup, loadElections, loadVillages]);

  // 임원 투표인 경우 코드 로드
  useEffect(() => {
    if (group && group.group_type === 'officer' && elections.length > 0) {
      loadVoterCodes();
    }
  }, [group, elections, loadVoterCodes]);

  if (loading || !group) {
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

  const totalVotes = elections.reduce((sum, e) => sum + (e._count?.votes || 0), 0);
  const activeElections = elections.filter(e => e.status === 'active').length;
  const completedElections = elections.filter(e => e.status === 'closed').length;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <SystemLogo size="md" linkToHome />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.03em'
                  }}>
                    {group.title}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    group.status === 'active' ? 'bg-green-100 text-green-700' :
                    group.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {group.status === 'active' ? '진행중' :
                     group.status === 'closed' ? '종료' : '대기'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  {group.group_type === 'delegate' ? '📋 총대 투표 그룹' : '👔 임원 투표 그룹'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/election-groups"
                className="btn-apple-secondary text-sm"
              >
                ← 목록으로
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 그룹 정보 카드 */}
        <div className="card-apple p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                그룹 정보
              </h2>
              {group.description && (
                <p className="text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                  {group.description}
                </p>
              )}
              <div className="flex gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-semibold">생성일:</span>{' '}
                  {new Date(group.created_at).toLocaleDateString('ko-KR')}
                </div>
                <div>
                  <span className="font-semibold">마지막 수정:</span>{' '}
                  {new Date(group.updated_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            </div>

            {/* 상태 변경 버튼 */}
            <div className="flex gap-2">
              {group.status === 'waiting' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="btn-apple-primary text-sm"
                >
                  활성화
                </button>
              )}
              {group.status === 'active' && (
                <>
                  <button
                    onClick={() => handleStatusChange('waiting')}
                    className="btn-apple-secondary text-sm"
                  >
                    대기로 변경
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed')}
                    className="btn-apple-secondary text-sm"
                  >
                    종료
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                그룹 삭제
              </button>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">총 투표 수</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                {elections.length}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">진행중</div>
              <div className="text-2xl font-bold text-green-600">
                {activeElections}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">완료</div>
              <div className="text-2xl font-bold text-gray-600">
                {completedElections}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">총 투표 수</div>
              <div className="text-2xl font-bold text-blue-600">
                {totalVotes}
              </div>
            </div>
          </div>
        </div>

        {/* 참여코드 관리 */}
        {group.group_type === 'officer' ? (
          // 임원 투표 - 이 페이지에서 직접 관리
          <div className="card-apple p-8 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold mb-2" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  🎟️ 참여코드 관리
                </h3>
                <p className="text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                  {elections.length > 0 
                    ? '하나의 코드로 모든 임원 투표에 참여할 수 있습니다.'
                    : '투표를 생성한 후 참여코드를 생성할 수 있습니다.'}
                </p>
              </div>
              <button
                onClick={() => setShowCreateCodeModal(true)}
                disabled={elections.length === 0}
                className="btn-apple-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={elections.length === 0 ? '먼저 투표를 생성하세요' : ''}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                코드 생성
              </button>
            </div>

            {/* 필터 버튼 */}
            {voterCodes.length > 0 && (
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    setCodeFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                    codeFilter === 'all' ? 'text-white' : 'text-gray-700'
                  }`}
                  style={{ 
                    background: codeFilter === 'all' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  전체
                </button>
                <button
                  onClick={() => {
                    setCodeFilter('not_attended');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                    codeFilter === 'not_attended' ? 'text-white' : 'text-gray-700'
                  }`}
                  style={{ 
                    background: codeFilter === 'not_attended' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  미참석
                </button>
                <button
                  onClick={() => {
                    setCodeFilter('attended');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                    codeFilter === 'attended' ? 'text-white' : 'text-gray-700'
                  }`}
                  style={{ 
                    background: codeFilter === 'attended' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  참석 확인
                </button>
                <button
                  onClick={() => {
                    setCodeFilter('voting');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                    codeFilter === 'voting' ? 'text-white' : 'text-gray-700'
                  }`}
                  style={{ 
                    background: codeFilter === 'voting' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  투표 중
                </button>
                <button
                  onClick={() => {
                    setCodeFilter('completed');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                    codeFilter === 'completed' ? 'text-white' : 'text-gray-700'
                  }`}
                  style={{ 
                    background: codeFilter === 'completed' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  투표 완료
                </button>
              </div>
            )}

            {/* 코드 목록 */}
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
                <p className="text-gray-500" style={{ letterSpacing: '-0.01em' }}>
                  &ldquo;코드 생성&rdquo; 버튼을 눌러 참여 코드를 만드세요
                </p>
              </div>
            ) : (() => {
              // 상태 판단 함수
              const getVoteStatus = (code: typeof voterCodes[0]): '미참석' | '참석 확인' | '투표 중' | '투표 완료' => {
                const totalElections = elections.length;
                
                // 로그인 안함
                if (!code.first_login_at) return '미참석';
                
                // 로그인했지만 투표 안함
                if (code.vote_count === 0) return '참석 확인';
                
                // 일부만 투표
                if (code.vote_count < totalElections) return '투표 중';
                
                // 모두 투표
                return '투표 완료';
              };

              // 필터링된 코드 목록
              const filteredCodes = voterCodes.filter(code => {
                if (codeFilter === 'all') return true;
                
                const status = getVoteStatus(code);
                if (codeFilter === 'not_attended') return status === '미참석';
                if (codeFilter === 'attended') return status === '참석 확인';
                if (codeFilter === 'voting') return status === '투표 중';
                if (codeFilter === 'completed') return status === '투표 완료';
                
                return true;
              });

              // 페이지네이션 계산
              const totalPages = Math.ceil(filteredCodes.length / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedCodes = filteredCodes.slice(startIndex, endIndex);

              return (
                <div className="space-y-4">
                  {/* 상단: 개수 표시 + 페이지당 개수 선택 */}
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      총 {voterCodes.length}개의 코드
                      {codeFilter !== 'all' && ` (${filteredCodes.length}개 표시)`}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">페이지당:</span>
                      {[5, 10, 30, 50].map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            setItemsPerPage(size);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            itemsPerPage === size ? 'text-white' : 'text-gray-700'
                          }`}
                          style={{ 
                            background: itemsPerPage === size ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)'
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 코드 목록 */}
                  <div className="grid gap-3">
                    {paginatedCodes.map((code) => (
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
                          {(() => {
                            const status = getVoteStatus(code);
                            const totalElections = elections.length;
                            
                            if (status === '미참석') {
                              return (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                                  미참석
                                </span>
                              );
                            } else if (status === '참석 확인') {
                              return (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                  참석 확인
                                </span>
                              );
                            } else if (status === '투표 중') {
                              return (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                                  투표 중 ({code.vote_count}/{totalElections})
                                </span>
                              );
                            } else {
                              return (
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                  투표 완료 ({code.vote_count}/{totalElections})
                                </span>
                              );
                            }
                          })()}
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

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-6">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ 
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: '#1d1d1f'
                        }}
                      >
                        ← 이전
                      </button>
                      
                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // 현재 페이지 주변만 표시
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${
                                  currentPage === page ? 'text-white' : 'text-gray-700'
                                }`}
                                style={{ 
                                  background: currentPage === page ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)'
                                }}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return <span key={page} className="w-10 h-10 flex items-center justify-center text-gray-400">...</span>;
                          }
                          return null;
                        })}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ 
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: '#1d1d1f'
                        }}
                      >
                        다음 →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          // 총대 투표 - 기존 방식 (각 투표별 코드 관리)
          <div className="card-apple p-8 mb-6">
            <div className="flex gap-4">
              <div className="text-5xl">🎟️</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  참여코드 관리
                </h3>
                <p className="text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                  총대 투표는 마을별로 다른 코드를 사용합니다. 각 투표 페이지에서 코드를 관리하세요.
                </p>
                <p className="text-sm text-blue-600" style={{ letterSpacing: '-0.01em' }}>
                  💡 하위 투표 목록에서 각 마을의 투표를 클릭하여 코드를 생성하고 관리할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 하위 투표 목록 */}
        <div className="card-apple p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                하위 투표 목록 ({elections.length})
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {group.group_type === 'delegate' ? '마을별 총대 선출 투표' : '직책별 임원 선출 투표'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-2"
              >
                <span>⚡</span>
                <span>일괄 생성</span>
              </button>
              <Link
                href={`/admin/elections/create?group_id=${group.id}`}
                className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-sm font-medium flex items-center gap-2"
              >
                <span>+</span>
                <span>개별 추가</span>
              </Link>
            </div>
          </div>

          {elections.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-7xl mb-4">📋</div>
              <p className="text-lg text-gray-600 mb-2">아직 투표가 없습니다</p>
              <p className="text-sm text-gray-400">
                {group.group_type === 'delegate' 
                  ? '일괄 생성으로 모든 마을의 투표를 한번에 만들거나, 개별 추가로 하나씩 만들 수 있습니다.'
                  : '일괄 생성으로 여러 직책의 투표를 한번에 만들거나, 개별 추가로 하나씩 만들 수 있습니다.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">투표 제목</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                      {group.group_type === 'delegate' ? '마을' : '직책'}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">선발 인원</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">후보자</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">투표 수</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">상태</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {elections.map((election) => (
                    <tr key={election.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/elections/${election.id}`}
                          className="font-medium text-gray-900 hover:text-[var(--color-secondary)]"
                        >
                          {election.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {group.group_type === 'delegate' 
                          ? election.villages?.name || '-'
                          : election.position || '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {election.max_selections}명
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {election._count?.candidates || 0}명
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-semibold text-blue-600">
                        {election._count?.votes || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          election.status === 'active' ? 'bg-green-100 text-green-700' :
                          election.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {election.status === 'active' ? '진행중' :
                           election.status === 'closed' ? '종료' : '대기'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/elections/${election.id}`}
                            className="text-sm text-[var(--color-secondary)] hover:underline"
                          >
                            관리
                          </Link>
                          <button
                            onClick={() => handleDeleteElection(election.id, election.title)}
                            className="text-sm text-red-600 hover:underline"
                            title="투표 삭제"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 코드 생성 모달 (임원 투표용) */}
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
                1-100개까지 생성 가능합니다. 생성된 코드는 이 그룹의 모든 투표에 접근할 수 있습니다.
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

      {/* 일괄 생성 모달 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                {group.group_type === 'delegate' ? '총대 투표 일괄 생성' : '임원 투표 일괄 생성'}
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                {group.group_type === 'delegate' 
                  ? '활성화된 마을별로 투표를 생성합니다. 선발 인원을 조정할 수 있습니다.'
                  : '직책별로 투표를 생성합니다. 각 직책의 선발 인원을 설정하세요.'}
              </p>
            </div>

            <div className="p-6">
              {group.group_type === 'delegate' ? (
                // 총대 - 마을 목록
                <div className="space-y-3">
                  {villages.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">활성화된 마을이 없습니다.</p>
                  ) : (
                    villages.map((village, index) => (
                      <div key={village.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{village.name}</p>
                          <p className="text-xs text-gray-500">총대 선출 투표가 생성됩니다</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">선발 인원:</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={village.selections}
                            onChange={(e) => {
                              const newVillages = [...villages];
                              newVillages[index].selections = parseInt(e.target.value) || 0;
                              setVillages(newVillages);
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center"
                          />
                          <span className="text-sm text-gray-600">명</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // 임원 - 직책 목록
                <div className="space-y-3">
                  {positions.map((position, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{position.name}</p>
                        <p className="text-xs text-gray-500">{position.name} 선출 투표가 생성됩니다</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">선발 인원:</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={position.selections}
                            onChange={(e) => {
                              const newPositions = [...positions];
                              newPositions[index].selections = parseInt(e.target.value) || 0;
                              setPositions(newPositions);
                            }}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center"
                          />
                          <span className="text-sm text-gray-600">명</span>
                        </div>
                        <button
                          onClick={() => {
                            const newPositions = positions.filter((_, i) => i !== index);
                            setPositions(newPositions);
                          }}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="직책 삭제"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* 직책 추가 버튼 */}
                  <button
                    onClick={() => {
                      const newPosition = prompt('새로운 직책명을 입력하세요:');
                      if (newPosition && newPosition.trim()) {
                        setPositions([...positions, { name: newPosition.trim(), selections: 1 }]);
                      }
                    }}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
                  >
                    + 직책 추가
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowBatchModal(false)}
                disabled={batchCreating}
                className="px-6 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleBatchCreate}
                disabled={batchCreating || (group.group_type === 'delegate' ? villages.filter(v => v.selections > 0).length === 0 : positions.filter(p => p.selections > 0).length === 0)}
                className="btn-apple-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {batchCreating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    생성 중...
                  </span>
                ) : (
                  `${group.group_type === 'delegate' ? villages.filter(v => v.selections > 0).length : positions.filter(p => p.selections > 0).length}개 투표 생성`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
