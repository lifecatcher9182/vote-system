'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

// 알파벳 2자 + 숫자 4자 조합으로 코드 생성 (예: AB1234)
function generateVoterCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let code = '';
  // 알파벳 2자
  for (let i = 0; i < 2; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  // 숫자 4자
  for (let i = 0; i < 4; i++) {
    code += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  return code;
}

// 중복되지 않는 코드 생성 (데이터베이스 체크)
async function generateUniqueVoterCode(): Promise<string> {
  const supabase = createClient();
  let code = '';
  let attempts = 0;
  const maxAttempts = 10; // 최대 10번 시도
  
  while (attempts < maxAttempts) {
    code = generateVoterCode();
    
    // 데이터베이스에서 중복 확인
    const { data, error } = await supabase
      .from('voter_codes')
      .select('code')
      .eq('code', code)
      .maybeSingle();
    
    // 중복되지 않으면 반환
    if (!data && !error) {
      return code;
    }
    
    attempts++;
  }
  
  // 10번 시도해도 실패하면 타임스탬프 추가하여 고유성 보장
  return generateVoterCode() + Date.now().toString().slice(-2);
}

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
  round: number;
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
  
  // 일괄 삭제를 위한 선택 상태
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 마을별 투표율 (총대 투표용)
  const [villageStats, setVillageStats] = useState<Array<{
    villageName: string;
    codesCount: number;
    attendedCount: number;
    usedCount: number;
    participationRate: number;
  }>>([]);

  // 모달 상태
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ 
    isOpen: false, message: '', title: '알림' 
  });
  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; message: string; title?: string; onConfirm: () => void; variant?: 'danger' | 'primary';
  }>({ isOpen: false, message: '', title: '확인', onConfirm: () => {}, variant: 'primary' });

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

  const loadGroup = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('election_groups')
      .select('id, title, description, group_type, status, created_at, updated_at')
      .eq('id', resolvedParams.id)
      .single();

    if (error || !data) {
      console.error('그룹 로딩 오류:', error);
      setAlertModal({ isOpen: true, message: '그룹을 찾을 수 없습니다.', title: '오류' });
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

    // 각 투표별 후보자 수와 투표자 수 조회
    const electionsWithCounts = await Promise.all(
      (data || []).map(async (election) => {
        const { data: candidates } = await supabase
          .from('candidates')
          .select('id')
          .eq('election_id', election.id);

        // 고유한 voter_code_id 개수를 세어서 실제 투표한 사람 수를 계산
        const { data: votes } = await supabase
          .from('votes')
          .select('voter_code_id')
          .eq('election_id', election.id);

        // 고유한 투표자 수 계산
        const uniqueVoters = new Set(votes?.map(v => v.voter_code_id) || []).size;

        return {
          ...election,
          _count: {
            candidates: candidates?.length || 0,
            votes: uniqueVoters, // 투표 수 → 투표자 수로 변경
          },
        };
      })
    );

    setElections(electionsWithCounts);
  }, [resolvedParams.id]);

  const handleDeleteElection = async (electionId: string, electionTitle: string) => {
    setConfirmModal({
      isOpen: true,
      message: `"${electionTitle}" 투표를 삭제하시겠습니까?\n\n관련된 후보자, 투표 데이터도 모두 삭제됩니다.`,
      title: '투표 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();

        // 투표 삭제 (cascade로 후보자, 투표 데이터도 자동 삭제됨)
        const { error } = await supabase
          .from('elections')
          .delete()
          .eq('id', electionId);

        if (error) {
          console.error('투표 삭제 오류:', error);
          setAlertModal({ isOpen: true, message: '투표 삭제에 실패했습니다.', title: '오류' });
          return;
        }

        setAlertModal({ isOpen: true, message: '투표가 삭제되었습니다.', title: '삭제 완료' });
        loadElections(); // 목록 새로고침
      }
    });
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

  // 마을별 투표율 로딩 (총대 투표 그룹용)
  const loadVillageStats = useCallback(async () => {
    if (!group || group.group_type !== 'delegate') return;
    
    const supabase = createClient();

    // 이 그룹의 모든 총대 투표 가져오기
    const { data: delegateElections } = await supabase
      .from('elections')
      .select('id, village_id')
      .eq('group_id', group.id)
      .eq('election_type', 'delegate');

    if (!delegateElections || delegateElections.length === 0) return;

    const villageIds = delegateElections
      .map(e => e.village_id)
      .filter(Boolean) as string[];

    if (villageIds.length === 0) return;

    // ✅ 최적화: 모든 마을 정보를 한 번에 조회
    const { data: villages } = await supabase
      .from('villages')
      .select('id, name')
      .in('id', villageIds);

    const villageMap = new Map(villages?.map(v => [v.id, v.name]) || []);

    // ✅ 최적화: 모든 코드를 한 번에 조회
    const electionIds = delegateElections.map(e => e.id);
    const { data: allCodes } = await supabase
      .from('voter_codes')
      .select('id, first_login_at, is_used, village_id, accessible_elections')
      .in('village_id', villageIds);

    // 투표별로 코드 그룹화
    const codesByElection = new Map<string, typeof allCodes>();
    delegateElections.forEach(election => {
      const electionCodes = (allCodes || []).filter(code => 
        code.accessible_elections?.includes(election.id)
      );
      codesByElection.set(election.id, electionCodes);
    });

    const villageStatsData = [];
    for (const delegateElection of delegateElections) {
      if (!delegateElection.village_id) continue;

      const villageName = villageMap.get(delegateElection.village_id);
      if (!villageName) continue;

      const codes = codesByElection.get(delegateElection.id) || [];
      const codesCount = codes.length;
      const attendedCount = codes.filter(c => c.first_login_at !== null).length;
      const usedCount = codes.filter(c => c.is_used).length;
      const participationRate = attendedCount > 0 ? (usedCount / attendedCount) * 100 : 0;

      villageStatsData.push({
        villageName,
        codesCount,
        attendedCount,
        usedCount,
        participationRate,
      });
    }

    villageStatsData.sort((a, b) => b.participationRate - a.participationRate);
    setVillageStats(villageStatsData);
  }, [group]);

  // 임원 투표용 코드 로딩
  const loadVoterCodes = useCallback(async () => {
    if (!group || group.group_type !== 'officer') return;
    
    const supabase = createClient();
    
    // voter_codes에서 이 그룹의 코드만 조회 (group_id로 필터링)
    const { data: codesData, error } = await supabase
      .from('voter_codes')
      .select('id, code, is_used, village_id, created_at, first_login_at, accessible_elections')
      .eq('code_type', 'officer')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('코드 로딩 오류:', error);
      return;
    }

    // group_id로 필터링했으므로 추가 필터링 불필요
    // 모든 코드를 그대로 사용
    const filteredCodes = codesData || [];

    // 각 코드가 실제로 투표한 선거 개수 계산
    const codeIds = filteredCodes.map(c => c.id);
    
    // 이 그룹의 모든 투표 ID 가져오기
    const electionIds = elections.map(e => e.id);
    
    // 코드별로 투표한 선거 ID를 Set으로 집계
    const voteCountMap = new Map<string, Set<string>>();
    
    if (codeIds.length > 0 && electionIds.length > 0) {
      const { data: votesData } = await supabase
        .from('votes')
        .select('voter_code_id, election_id')
        .in('voter_code_id', codeIds)
        .in('election_id', electionIds);

      votesData?.forEach(vote => {
        if (!voteCountMap.has(vote.voter_code_id)) {
          voteCountMap.set(vote.voter_code_id, new Set());
        }
        voteCountMap.get(vote.voter_code_id)!.add(vote.election_id);
      });
    }

    // 각 코드에 completed_election_count 추가
    const codesWithVoteCount = filteredCodes.map(code => ({
      ...code,
      vote_count: voteCountMap.get(code.id)?.size || 0 // 투표한 선거 개수
    }));

    setVoterCodes(codesWithVoteCount);
    setSelectedCodeIds([]); // 코드 목록 변경 시 선택 초기화
  }, [group, elections]);

  // 임원 투표용 코드 생성
  const handleGenerateCodes = async () => {
    if (!group || group.group_type !== 'officer') return;
    if (codeQuantity < 1 || codeQuantity > 100) {
      setAlertModal({ isOpen: true, message: '코드는 1-100개까지 생성 가능합니다.', title: '입력 오류' });
      return;
    }

    if (elections.length === 0) {
      setAlertModal({ isOpen: true, message: '투표를 먼저 생성해주세요.', title: '입력 오류' });
      return;
    }

    setGeneratingCodes(true);

    try {
      const supabase = createClient();
      const electionIds = elections.map(e => e.id);
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (!success && retryCount < maxRetries) {
        const newCodes = [];

        // 중복되지 않는 코드 생성
        for (let i = 0; i < codeQuantity; i++) {
          const uniqueCode = await generateUniqueVoterCode();
          newCodes.push({
            code: uniqueCode,
            code_type: 'officer' as const,
            accessible_elections: electionIds,
            group_id: group.id,
            is_used: false,
          });
        }

        const { error } = await supabase
          .from('voter_codes')
          .insert(newCodes);

        if (!error) {
          // 성공!
          success = true;
          setAlertModal({ isOpen: true, message: `${codeQuantity}개의 코드가 생성되었습니다.`, title: '생성 완료' });
          setShowCreateCodeModal(false);
          setCodeQuantity(10);
          loadVoterCodes();
        } else if (error.code === '23505') {
          // UNIQUE 제약 위반 - 재시도
          retryCount++;
          console.log(`중복 코드 감지, 재시도 중... (${retryCount}/${maxRetries})`);
          
          if (retryCount >= maxRetries) {
            setAlertModal({ 
              isOpen: true, 
              message: '코드 생성 중 중복이 계속 발생합니다.\n잠시 후 다시 시도해주세요.', 
              title: '생성 실패' 
            });
          }
        } else {
          // 다른 오류
          console.error('코드 생성 오류:', error);
          setAlertModal({ isOpen: true, message: '코드 생성에 실패했습니다.', title: '오류' });
          break;
        }
      }
    } catch (error) {
      console.error('코드 생성 오류:', error);
      setAlertModal({ isOpen: true, message: '코드 생성 중 오류가 발생했습니다.', title: '오류' });
    } finally {
      setGeneratingCodes(false);
    }
  };

  // 코드 삭제
  const handleDeleteCode = async (codeId: string) => {
    setConfirmModal({
      isOpen: true,
      message: '정말 이 코드를 삭제하시겠습니까?',
      title: '코드 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from('voter_codes')
          .delete()
          .eq('id', codeId);

        if (error) {
          console.error('코드 삭제 오류:', error);
          setAlertModal({ isOpen: true, message: '코드 삭제에 실패했습니다.', title: '오류' });
          return;
        }

        loadVoterCodes();
      }
    });
  };

  // 전체 선택/해제
  const handleSelectAll = (codes: Array<{ id: string }>) => {
    const codeIds = codes.map(c => c.id);
    if (selectedCodeIds.length === codeIds.length) {
      // 전체 선택되어 있으면 해제
      setSelectedCodeIds([]);
    } else {
      // 전체 선택
      setSelectedCodeIds(codeIds);
    }
  };

  // 일괄 삭제
  const handleBulkDeleteCodes = async () => {
    if (selectedCodeIds.length === 0) {
      setAlertModal({ isOpen: true, message: '삭제할 코드를 선택해주세요.', title: '알림' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      message: `선택한 ${selectedCodeIds.length}개의 코드를 삭제하시겠습니까?\n\n관련된 투표 기록도 함께 삭제됩니다.`,
      title: '코드 일괄 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from('voter_codes')
          .delete()
          .in('id', selectedCodeIds);

        if (error) {
          console.error('코드 삭제 오류:', error);
          setAlertModal({ isOpen: true, message: '코드 삭제에 실패했습니다.', title: '오류' });
          return;
        }

        setSelectedCodeIds([]);
        loadVoterCodes();
        setAlertModal({ isOpen: true, message: `${selectedCodeIds.length}개의 코드가 삭제되었습니다.`, title: '삭제 완료' });
      }
    });
  };

  const handleBatchCreate = async () => {
    if (!group) return;

    if (group.group_type === 'delegate') {
      // 총대 일괄 생성 - 마을별
      const selectedVillages = villages.filter(v => v.selections > 0);
      if (selectedVillages.length === 0) {
        setAlertModal({ isOpen: true, message: '생성할 마을을 선택하세요.', title: '입력 오류' });
        return;
      }

      setConfirmModal({
        isOpen: true,
        message: `${selectedVillages.length}개 마을에 대한 투표를 생성하시겠습니까?`,
        title: '일괄 생성 확인',
        variant: 'primary',
        onConfirm: async () => {
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

            setAlertModal({ isOpen: true, message: `${selectedVillages.length}개의 투표가 생성되었습니다.`, title: '생성 완료' });
            setShowBatchModal(false);
            loadElections();
          } catch (error) {
            console.error('일괄 생성 오류:', error);
            setAlertModal({ isOpen: true, message: '일괄 생성 중 오류가 발생했습니다.', title: '오류' });
          } finally {
            setBatchCreating(false);
          }
        }
      });

    } else {
      // 임원 일괄 생성 - 직책별
      const selectedPositions = positions.filter(p => p.selections > 0);
      if (selectedPositions.length === 0) {
        setAlertModal({ isOpen: true, message: '생성할 직책을 선택하세요.', title: '입력 오류' });
        return;
      }

      setConfirmModal({
        isOpen: true,
        message: `${selectedPositions.length}개 직책에 대한 투표를 생성하시겠습니까?`,
        title: '일괄 생성 확인',
        variant: 'primary',
        onConfirm: async () => {
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
                  group_id: group.id,
                  winning_criteria: {
                    type: 'percentage',
                    percentage: 66.67,
                    base: 'attended'
                  }
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

              // 이 그룹의 기존 코드만 정확하게 가져오기
              const { data: allCodes } = await supabase
                .from('voter_codes')
                .select('id, accessible_elections')
                .eq('code_type', 'officer');

              // 클라이언트 사이드에서 필터링: 현재 그룹의 투표 ID만 포함하는 코드
              const existingCodes = (allCodes || []).filter(code => {
                const accessibleElections = (code as { accessible_elections?: string[] }).accessible_elections || [];
                // 현재 그룹의 모든 투표 ID를 포함하는 코드만 선택
                // (이 그룹 전용 코드만 업데이트)
                return currentElectionIds.every(id => accessibleElections.includes(id));
              });

              // 각 코드의 accessible_elections 업데이트
              if (existingCodes.length > 0) {
                for (const code of existingCodes) {
                  await supabase
                    .from('voter_codes')
                    .update({ accessible_elections: allElectionIds })
                    .eq('id', code.id);
                }
              }
            }

            setAlertModal({ isOpen: true, message: `${selectedPositions.length}개의 투표가 생성되었습니다.`, title: '생성 완료' });
            setShowBatchModal(false);
            loadElections();
          } catch (error) {
            console.error('일괄 생성 오류:', error);
            setAlertModal({ isOpen: true, message: '일괄 생성 중 오류가 발생했습니다.', title: '오류' });
          } finally {
            setBatchCreating(false);
          }
        }
      });
    }
  };

  const handleDelete = async () => {
    if (!group) return;

    if (elections.length > 0) {
      setAlertModal({ isOpen: true, message: '하위 투표가 있는 그룹은 삭제할 수 없습니다. 먼저 투표들을 삭제해주세요.', title: '삭제 불가' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      message: '정말로 이 그룹을 삭제하시겠습니까?',
      title: '그룹 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();

        const { error } = await supabase
          .from('election_groups')
          .delete()
          .eq('id', group.id);

        if (error) {
          console.error('그룹 삭제 오류:', error);
          setAlertModal({ isOpen: true, message: '그룹 삭제에 실패했습니다.', title: '오류' });
          return;
        }

        setAlertModal({ isOpen: true, message: '그룹이 삭제되었습니다.', title: '삭제 완료' });
        router.push('/admin/election-groups');
      }
    });
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

  // 총대 투표인 경우 마을별 투표율 로드
  useEffect(() => {
    if (group && group.group_type === 'delegate' && elections.length > 0) {
      loadVillageStats();
    }
  }, [group, elections, loadVillageStats]);

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: 'var(--paper)' 
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

  const activeElections = elections.filter(e => e.status === 'active').length;
  const completedElections = elections.filter(e => e.status === 'closed').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.8)',
        
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <SystemLogo size="md" linkToHome />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold" style={{ 
                    color: 'var(--ink)',
                    letterSpacing: '-0.03em'
                  }}>
                    {group.title}
                  </h1>
                </div>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  {group.group_type === 'delegate' ? '📋 총대 투표 그룹' : '👔 임원 투표 그룹'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.04)',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                대시보드
              </Link>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                <span>뒤로가기</span>
              </button>
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
                color: 'var(--ink)',
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

            {/* 그룹 삭제 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="px-6 py-2.5 rounded-2xl font-semibold transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                }}
              >
                그룹 삭제
              </button>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-4">
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
          </div>
        </div>

        {/* 마을별 투표율 (총대 투표 그룹만) */}
        {group.group_type === 'delegate' && villageStats.length > 0 && (
          <div className="card-apple p-8 mb-6">
            <h2 className="text-xl font-semibold mb-6" style={{ 
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              📊 마을별 투표율
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {villageStats.map((villageStat, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-5" style={{ background: 'white' }}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-semibold text-lg" style={{ color: 'var(--ink)' }}>{villageStat.villageName}</div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                        {villageStat.participationRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    투표 {villageStat.usedCount} / 참석 {villageStat.attendedCount}
                    <span className="text-xs text-gray-400 ml-2">(전체: {villageStat.codesCount})</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
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

        {/* 참여코드 관리 */}
        {group.group_type === 'officer' ? (
          // 임원 투표 - 이 페이지에서 직접 관리
          <div className="card-apple p-8 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-semibold mb-2" style={{ 
                  color: 'var(--ink)',
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
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateCodeModal(true)}
                  disabled={elections.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: elections.length === 0 ? 'rgba(0, 0, 0, 0.1)' : 'var(--color-secondary)',
                    color: 'white',
                    letterSpacing: '-0.01em',
                    boxShadow: elections.length === 0 ? 'none' : 'var(--shadow-secondary)'
                  }}
                  title={elections.length === 0 ? '먼저 투표를 생성하세요' : ''}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  코드 생성
                </button>
                {isDeleteMode ? (
                  <button
                    onClick={() => {
                      setIsDeleteMode(false);
                      setSelectedCodeIds([]);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                    style={{
                      background: 'rgba(0, 0, 0, 0.06)',
                      color: 'var(--ink)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    취소
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsDeleteMode(true);
                      setSelectedCodeIds([]);
                    }}
                    disabled={voterCodes.length === 0}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: voterCodes.length === 0 
                        ? 'rgba(0, 0, 0, 0.1)' 
                        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white',
                      letterSpacing: '-0.01em',
                      boxShadow: voterCodes.length === 0 ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.25)'
                    }}
                    title={voterCodes.length === 0 ? '삭제할 코드가 없습니다' : ''}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    일괄 삭제
                  </button>
                )}
              </div>
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
                <h3 className="text-2xl font-semibold mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
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
                  {/* 상단: 개수 표시 + 삭제 모드 액션 버튼 + 페이지당 개수 선택 */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-gray-600">
                        총 {voterCodes.length}개의 코드
                        {codeFilter !== 'all' && ` (${filteredCodes.length}개 표시)`}
                      </p>
                      {isDeleteMode && selectedCodeIds.length > 0 && (
                        <button
                          onClick={handleBulkDeleteCodes}
                          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{ 
                            background: '#dc2626',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
                          }}
                        >
                          선택 삭제 ({selectedCodeIds.length})
                        </button>
                      )}
                    </div>
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
                  
                  {/* 전체 선택 체크박스 - 삭제 모드일 때만 표시 */}
                  {isDeleteMode && paginatedCodes.length > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-red-200" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                      <input
                        type="checkbox"
                        checked={paginatedCodes.every(code => selectedCodeIds.includes(code.id))}
                        onChange={() => handleSelectAll(paginatedCodes)}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: '#dc2626' }}
                      />
                      <label className="text-sm font-medium cursor-pointer" style={{ color: '#dc2626' }} onClick={() => handleSelectAll(paginatedCodes)}>
                        현재 페이지 전체 선택
                      </label>
                    </div>
                  )}
                  
                  {/* 코드 목록 */}
                  <div className="grid gap-3">
                    {paginatedCodes.map((code) => (
                    <div 
                      key={code.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                      style={{ background: 'white' }}
                    >
                      <div className="flex items-center gap-4">
                        {/* 체크박스 - 삭제 모드일 때만 표시 */}
                        {isDeleteMode && (
                          <input
                            type="checkbox"
                            checked={selectedCodeIds.includes(code.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCodeIds([...selectedCodeIds, code.id]);
                              } else {
                                setSelectedCodeIds(selectedCodeIds.filter(id => id !== code.id));
                              }
                            }}
                            className="w-5 h-5 rounded cursor-pointer"
                            style={{ accentColor: '#dc2626' }}
                          />
                        )}
                        <code className="px-3 py-1.5 rounded-lg text-lg font-mono font-semibold" style={{ 
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: 'var(--ink)',
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
                      {!isDeleteMode && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(code.code);
                              setAlertModal({ isOpen: true, message: '코드가 복사되었습니다.', title: '복사 완료' });
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{ 
                              background: 'rgba(0, 0, 0, 0.04)',
                              color: 'var(--ink)'
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
                      )}
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
                          color: 'var(--ink)'
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
                          color: 'var(--ink)'
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
                  color: 'var(--ink)',
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
                color: 'var(--ink)',
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
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                style={{
                  background: 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '-0.01em',
                  boxShadow: 'var(--shadow-secondary)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                <span>일괄 생성</span>
              </button>
              <Link
                href={`/admin/elections/create?group_id=${group.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
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
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">라운드</th>
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
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {election.round}차
                        </span>
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
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)',  }}>
          <div className="card-apple max-w-md w-full p-8 animate-[scale-in_0.2s_ease-out]">
            <h2 className="text-2xl font-semibold mb-6" style={{ 
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              참여 코드 생성
            </h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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
                className="flex-1 px-8 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em'
                }}
                disabled={generatingCodes}
              >
                취소
              </button>
              <button
                onClick={handleGenerateCodes}
                className="flex-1 px-8 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: generatingCodes ? 'rgba(0, 0, 0, 0.4)' : 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '-0.01em',
                  boxShadow: generatingCodes ? 'none' : 'var(--shadow-secondary)'
                }}
                disabled={generatingCodes}
              >
                {generatingCodes ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>생성 중...</span>
                  </span>
                ) : (
                  '생성'
                )}
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
              <h2 className="text-2xl font-semibold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
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
                className="px-8 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em'
                }}
              >
                취소
              </button>
              <button
                onClick={handleBatchCreate}
                disabled={batchCreating || (group.group_type === 'delegate' ? villages.filter(v => v.selections > 0).length === 0 : positions.filter(p => p.selections > 0).length === 0)}
                className="px-8 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: batchCreating ? 'rgba(0, 0, 0, 0.4)' : 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '-0.01em',
                  boxShadow: batchCreating ? 'none' : 'var(--shadow-secondary)'
                }}
              >
                {batchCreating ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>생성 중...</span>
                  </span>
                ) : (
                  `${group.group_type === 'delegate' ? villages.filter(v => v.selections > 0).length : positions.filter(p => p.selections > 0).length}개 투표 생성`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AlertModal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        title={alertModal.title}
      />

      {/* ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        message={confirmModal.message}
        title={confirmModal.title}
        variant={confirmModal.variant}
      />
    </div>
  );
}
