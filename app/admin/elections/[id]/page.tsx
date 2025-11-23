'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import { use } from 'react';
import QRCodeSection from '@/components/QRCodeSection';
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

interface ElectionNote {
  id: string;
  election_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
  
  // 일괄 삭제를 위한 선택 상태
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 결과 상태
  const [resultStats, setResultStats] = useState({
    totalCodes: 0,
    attendedCodes: 0,
    usedCodes: 0,
    unusedCodes: 0,
    participationRate: 0,
    totalVotes: 0,
    validVotes: 0,
    abstainCount: 0,
    abstainRate: 0,
    uniqueVoters: 0,
  });
  const [villageStats, setVillageStats] = useState<Array<{
    villageName: string;
    codesCount: number;
    usedCount: number;
    participationRate: number;
  }>>([]);

  // 비고/메모 상태
  const [notes, setNotes] = useState<ElectionNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // 득표 기준 계산기 상태
  const [voteThresholds, setVoteThresholds] = useState<Array<{ id: string; percentage: number; label: string }>>([
    { id: '1', percentage: 50, label: '과반수' },
    { id: '2', percentage: 66.67, label: '2/3' }
  ]);

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
      return;
    }

    const { isAdmin } = await checkAdminAccess(user.email!);
    if (!isAdmin) {
      setAlertModal({ isOpen: true, message: '관리자 권한이 없습니다.', title: '접근 권한 없음' });
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
      setAlertModal({ isOpen: true, message: '투표를 불러오지 못했습니다.', title: '오류' });
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
    
    // voter_codes에서 이 투표에 속한 코드만 조회 (group_id와 village_id로 필터링)
    let query = supabase
      .from('voter_codes')
      .select('id, code, is_used, village_id, created_at, first_login_at')
      .contains('accessible_elections', [election.id])
      .eq('group_id', election.group_id);
    
    // 총대 투표인 경우 마을별로 필터링
    if (election.election_type === 'delegate' && election.village_id) {
      query = query.eq('village_id', election.village_id);
    }
    
    const { data: codesData, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('코드 로딩 오류:', error);
      return;
    }

    if (!codesData || codesData.length === 0) {
      setVoterCodes([]);
      return;
    }

    // 모든 코드의 투표 여부를 한 번에 조회 (N+1 문제 해결)
    const codeIds = codesData.map(c => c.id);
    const { data: allVotes, error: votesError } = await supabase
      .from('votes')
      .select('voter_code_id')
      .in('voter_code_id', codeIds)
      .eq('election_id', election.id);

    if (votesError) {
      console.error('투표 조회 오류:', votesError);
    }

    // 투표한 코드 ID 집합 생성
    const votedCodeIds = new Set(allVotes?.map(v => v.voter_code_id) || []);

    // 각 코드에 투표 여부 추가
    const codesWithVoteStatus = codesData.map((code) => ({
      ...code,
      has_voted: votedCodeIds.has(code.id)
    }));

    console.log('총', codesWithVoteStatus.length, '개 코드 로드 완료');
    console.log('투표 완료:', codesWithVoteStatus.filter(c => c.has_voted).length, '개');
    console.log('참석 확인:', codesWithVoteStatus.filter(c => c.first_login_at && !c.has_voted).length, '개');
    console.log('미참석:', codesWithVoteStatus.filter(c => !c.first_login_at).length, '개');

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
      setAlertModal({ isOpen: true, message: '상태 변경에 실패했습니다.', title: '오류' });
      return;
    }

    setElection({ ...election, status: newStatus });
  };

  const handleAddCandidate = async () => {
    if (!newCandidateName.trim()) {
      setAlertModal({ isOpen: true, message: '후보자 이름을 입력하세요.', title: '입력 오류' });
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
      setAlertModal({ isOpen: true, message: '후보자 추가에 실패했습니다.', title: '오류' });
      return;
    }

    setNewCandidateName('');
    setShowAddCandidate(false);
    loadElection();
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    setConfirmModal({
      isOpen: true,
      message: '정말 이 후보자를 삭제하시겠습니까?',
      title: '후보자 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from('candidates')
          .delete()
          .eq('id', candidateId);

        if (error) {
          console.error('후보자 삭제 오류:', error);
          setAlertModal({ isOpen: true, message: '후보자 삭제에 실패했습니다.', title: '오류' });
          return;
        }

        loadElection();
      }
    });
  };

  const handleGenerateCodes = async () => {
    if (!election) return;
    if (codeQuantity < 1 || codeQuantity > 100) {
      setAlertModal({ isOpen: true, message: '코드는 1-100개까지 생성 가능합니다.', title: '입력 오류' });
      return;
    }

    setGeneratingCodes(true);

    try {
      const supabase = createClient();
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
            code_type: 'delegate' as const,
            accessible_elections: [election.id],
            village_id: election.village_id,
            group_id: election.group_id,
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
        setIsDeleteMode(false);
        loadVoterCodes();
        setAlertModal({ isOpen: true, message: `${selectedCodeIds.length}개의 코드가 삭제되었습니다.`, title: '삭제 완료' });
      }
    });
  };

  const loadResultStats = useCallback(async () => {
    if (!election) return;
    
    const supabase = createClient();
    
    // 이 투표에 접근 가능한 코드 통계
    let codesQuery = supabase
      .from('voter_codes')
      .select('*')
      .contains('accessible_elections', [election.id]);
    
    // 임원투표인 경우 group_id로 필터링
    if (election.election_type === 'officer' && election.group_id) {
      codesQuery = codesQuery.eq('group_id', election.group_id);
    }
    
    // 총대투표인 경우 village_id로 필터링
    if (election.election_type === 'delegate' && election.village_id) {
      codesQuery = codesQuery.eq('village_id', election.village_id);
    }

    const { data: codes } = await codesQuery;

    const totalCodes = codes?.length || 0;
    const attendedCodes = codes?.filter(c => c.first_login_at !== null).length || 0;

    // 실제로 이 투표에 투표한 사람 수 (접근 가능이 아니라 실제 투표 기준)
    const { data: votes } = await supabase
      .from('votes')
      .select('voter_code_id, is_abstain')
      .eq('election_id', election.id);

    const uniqueVoterIds = new Set(votes?.map(v => v.voter_code_id) || []);
    const actualVoterCount = uniqueVoterIds.size;

    // 기권 수 계산
    const abstainCount = votes?.filter(v => v.is_abstain === true).length || 0;
    const validVotes = votes?.filter(v => v.is_abstain !== true).length || 0;

    // usedCodes는 실제로 이 투표에 투표한 사람 수로 계산
    const usedCodes = actualVoterCount;
    const unusedCodes = totalCodes - usedCodes;
    const participationRate = totalCodes > 0 ? (usedCodes / totalCodes) * 100 : 0;
    const abstainRate = actualVoterCount > 0 ? (abstainCount / actualVoterCount) * 100 : 0;

    setResultStats({
      totalCodes,
      attendedCodes,
      usedCodes,
      unusedCodes,
      participationRate,
      totalVotes: votes?.length || 0,
      validVotes,
      abstainCount,
      abstainRate,
      uniqueVoters: actualVoterCount,
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
      let villageCodesQuery = supabase
        .from('voter_codes')
        .select('*')
        .eq('village_id', village.id)
        .contains('accessible_elections', [election.id]);
      
      // 임원투표인 경우 group_id로 필터링
      if (election.election_type === 'officer' && election.group_id) {
        villageCodesQuery = villageCodesQuery.eq('group_id', election.group_id);
      }

      const { data: codes } = await villageCodesQuery;

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

  // 비고 로드
  const loadNotes = useCallback(async () => {
    if (!election) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('election_notes')
      .select('*')
      .eq('election_id', election.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('비고 로딩 오류:', error);
      return;
    }

    setNotes(data || []);
  }, [election]);

  useEffect(() => {
    if (election) {
      loadNotes();
    }
  }, [election, loadNotes]);

  // 비고 추가
  const handleAddNote = async () => {
    if (!newNote.trim() || !election) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('election_notes')
      .insert([{
        election_id: election.id,
        content: newNote.trim(),
        created_by: '관리자', // 필요시 사용자 정보로 대체 가능
      }]);

    if (error) {
      console.error('비고 추가 오류:', error);
      setAlertModal({ isOpen: true, message: '비고 추가에 실패했습니다.', title: '오류' });
      return;
    }

    setNewNote('');
    loadNotes();
  };

  // 비고 수정
  const handleUpdateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('election_notes')
      .update({ 
        content: editingNoteContent.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', noteId);

    if (error) {
      console.error('비고 수정 오류:', error);
      setAlertModal({ isOpen: true, message: '비고 수정에 실패했습니다.', title: '오류' });
      return;
    }

    setEditingNoteId(null);
    setEditingNoteContent('');
    loadNotes();
  };

  // 비고 삭제
  const handleDeleteNote = async (noteId: string) => {
    setConfirmModal({
      isOpen: true,
      message: '정말 이 비고를 삭제하시겠습니까?',
      title: '비고 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from('election_notes')
          .delete()
          .eq('id', noteId);

        if (error) {
          console.error('비고 삭제 오류:', error);
          setAlertModal({ isOpen: true, message: '비고 삭제에 실패했습니다.', title: '오류' });
          return;
        }

        loadNotes();
      }
    });
  };

  const calculateWinners = useCallback(() => {
    if (!election) return { 
      winners: [], 
      hasTie: false, 
      meetsThreshold: false, 
      requiredVotes: 0, 
      thresholdMessage: '',
      confirmedWinners: [],
      tiedCandidates: []
    };
    
    const candidatesWithVotes = candidates.filter(c => c.vote_count > 0);
    
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
    let confirmedWinners: typeof candidates = [];
    let tiedCandidates: typeof candidates = [];

    if (!meetsThreshold && criteria.type !== 'plurality') {
      winners = [];
      hasTie = false;
    } else if (candidatesWithVotes.length >= election.max_selections) {
      // For plurality voting, separate confirmed winners from tied candidates
      if (criteria.type === 'plurality') {
        const cutoffVotes = candidatesWithVotes[election.max_selections - 1].vote_count;
        
        // Find candidates with votes higher than the tie threshold (confirmed winners)
        confirmedWinners = candidatesWithVotes.filter(c => c.vote_count > cutoffVotes);
        
        // Find tied candidates (those at the cutoff who are competing for remaining slots)
        tiedCandidates = candidatesWithVotes.filter(c => c.vote_count === cutoffVotes);
        
        if (tiedCandidates.length + confirmedWinners.length > election.max_selections) {
          // There's a tie - only tied candidates are uncertain
          hasTie = true;
          winners = [...confirmedWinners, ...tiedCandidates];
        } else {
          // No tie - all top candidates are confirmed winners
          winners = candidatesWithVotes.slice(0, election.max_selections);
          confirmedWinners = winners;
          tiedCandidates = [];
        }
      } else {
        // For non-plurality voting, use old logic
        const cutoffVotes = candidatesWithVotes[election.max_selections - 1].vote_count;
        const tiedCandidates = candidatesWithVotes.filter(c => c.vote_count >= cutoffVotes);
        
        if (tiedCandidates.length > election.max_selections) {
          hasTie = true;
          winners = tiedCandidates;
        } else {
          winners = candidatesWithVotes.slice(0, election.max_selections);
        }
      }
    } else {
      winners = candidatesWithVotes;
    }

    return { winners, hasTie, meetsThreshold, requiredVotes, thresholdMessage, confirmedWinners, tiedCandidates };
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
            <div className="flex gap-3">
              <Link 
                href="/admin/dashboard"
                className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                style={{
                  background: 'rgba(0, 0, 0, 0.04)',
                  color: '#1d1d1f',
                  letterSpacing: '-0.01em',
                  display: 'inline-block'
                }}
              >
                🏠 대시보드
              </Link>
              {election.group_id && (
                <Link 
                  href={`/admin/election-groups/${election.group_id}`}
                  className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                  style={{
                    background: 'rgba(0, 0, 0, 0.06)',
                    color: '#1d1d1f',
                    letterSpacing: '-0.01em',
                    display: 'inline-block'
                  }}
                >
                  ← 투표 그룹
                </Link>
              )}
            </div>
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
                    className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                    style={{
                      background: 'var(--color-secondary)',
                      color: 'white',
                      letterSpacing: '-0.01em'
                    }}
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
                        className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                        style={{
                          background: 'var(--color-secondary)',
                          color: 'white',
                          letterSpacing: '-0.01em'
                        }}
                      >
                        추가
                      </button>
                      <button
                        onClick={() => {
                          setShowAddCandidate(false);
                          setNewCandidateName('');
                        }}
                        className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                        style={{
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: '#1d1d1f',
                          letterSpacing: '-0.01em'
                        }}
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
                      <p className="text-sm text-blue-800 mb-2">
                        임원 투표는 하나의 코드로 모든 임원 투표에 참여할 수 있도록 설계되었습니다.
                      </p>
                      <p className="text-sm text-blue-800">
                        참여 코드는 <strong>투표 그룹 페이지</strong>에서 생성하고 관리하세요.
                      </p>
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
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateCodeModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                    style={{
                      background: 'var(--color-secondary)',
                      color: 'white',
                      letterSpacing: '-0.01em',
                      boxShadow: 'var(--shadow-secondary)'
                    }}
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
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                      style={{
                        background: 'rgba(0, 0, 0, 0.06)',
                        color: '#1d1d1f',
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
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
                    <p className="text-gray-500" style={{ letterSpacing: '-0.01em' }}>
                      상단 &ldquo;코드 생성&rdquo; 버튼을 눌러 참여 코드를 만드세요
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 일괄 삭제 모드: 선택 삭제 버튼 */}
                    {isDeleteMode && selectedCodeIds.length > 0 && (
                      <button
                        onClick={handleBulkDeleteCodes}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white',
                          letterSpacing: '-0.01em',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        선택 삭제 ({selectedCodeIds.length})
                      </button>
                    )}

                    {/* 일괄 삭제 모드: 전체 선택 체크박스 */}
                    {isDeleteMode && voterCodes.length > 0 && (() => {
                      const filteredCodes = voterCodes.filter(code => {
                        if (codeFilter === 'all') return true;
                        if (codeFilter === 'voted') return code.has_voted;
                        if (codeFilter === 'attended') return code.first_login_at && !code.has_voted;
                        if (codeFilter === 'not_attended') return !code.first_login_at;
                        return true;
                      });
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const currentPageCodes = filteredCodes.slice(startIndex, endIndex);
                      const currentPageCodeIds = currentPageCodes.map(c => c.id);
                      const allCurrentPageSelected = currentPageCodeIds.length > 0 && 
                        currentPageCodeIds.every(id => selectedCodeIds.includes(id));
                      
                      return (
                        <div 
                          className="flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer hover:bg-red-50 transition-colors"
                          style={{ borderColor: '#fecaca' }}
                          onClick={() => handleSelectAll(currentPageCodes)}
                        >
                          <input
                            type="checkbox"
                            checked={allCurrentPageSelected}
                            onChange={() => handleSelectAll(currentPageCodes)}
                            className="w-5 h-5 rounded border-2 cursor-pointer"
                            style={{
                              accentColor: '#dc2626',
                              borderColor: '#fca5a5'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label 
                            className="flex-1 text-sm font-semibold cursor-pointer select-none"
                            style={{ color: '#dc2626', letterSpacing: '-0.01em' }}
                          >
                            현재 페이지 전체 선택 ({currentPageCodes.length}개)
                          </label>
                        </div>
                      );
                    })()}

                    {/* 페이지당 항목 수 선택 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
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
                    
                    <div className="grid gap-3">
                      {(() => {
                        const filteredCodes = voterCodes.filter(code => {
                          if (codeFilter === 'all') return true;
                          if (codeFilter === 'voted') return code.has_voted;
                          if (codeFilter === 'attended') return code.first_login_at && !code.has_voted;
                          if (codeFilter === 'not_attended') return !code.first_login_at;
                          return true;
                        });
                        
                        const startIndex = (currentPage - 1) * itemsPerPage;
                        const endIndex = startIndex + itemsPerPage;
                        const paginatedCodes = filteredCodes.slice(startIndex, endIndex);
                        
                        return paginatedCodes.map((code) => (
                        <div 
                          key={code.id}
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                          style={{ background: 'white' }}
                        >
                          <div className="flex items-center gap-4">
                            {/* 일괄 삭제 모드: 체크박스 표시 */}
                            {isDeleteMode && (
                              <input
                                type="checkbox"
                                checked={selectedCodeIds.includes(code.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCodeIds(prev => [...prev, code.id]);
                                  } else {
                                    setSelectedCodeIds(prev => prev.filter(id => id !== code.id));
                                  }
                                }}
                                className="w-5 h-5 rounded border-2 cursor-pointer"
                                style={{
                                  accentColor: '#dc2626',
                                  borderColor: '#fca5a5'
                                }}
                              />
                            )}
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
                          {/* 일괄 삭제 모드가 아닐 때만 복사/삭제 버튼 표시 */}
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
                          )}
                        </div>
                        ));
                      })()}
                    </div>

                    {/* 페이지네이션 */}
                    {(() => {
                      const filteredCodes = voterCodes.filter(code => {
                        if (codeFilter === 'all') return true;
                        if (codeFilter === 'voted') return code.has_voted;
                        if (codeFilter === 'attended') return code.first_login_at && !code.has_voted;
                        if (codeFilter === 'not_attended') return !code.first_login_at;
                        return true;
                      });
                      const totalPages = Math.ceil(filteredCodes.length / itemsPerPage);
                      
                      if (totalPages <= 1) return null;
                      
                      return (
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
                      );
                    })()}
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
            const { winners, hasTie, meetsThreshold, requiredVotes, thresholdMessage, confirmedWinners, tiedCandidates } = calculateWinners();
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
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>기권</div>
                    <div className="text-2xl font-semibold text-orange-600">{resultStats.abstainCount}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ({resultStats.uniqueVoters > 0 ? ((resultStats.abstainCount / resultStats.uniqueVoters) * 100).toFixed(1) : 0}%)
                    </div>
                  </div>

                  <div className="card-apple p-6">
                    <div className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>미참석</div>
                    <div className="text-2xl font-semibold text-gray-500">{resultStats.totalCodes - resultStats.attendedCodes}</div>
                  </div>
                </div>

                {/* 득표 기준 계산기 */}
                <div className="card-apple p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold" style={{ 
                      color: '#1d1d1f',
                      letterSpacing: '-0.02em'
                    }}>
                      📊 득표 기준 계산
                    </h3>
                    <button
                      onClick={() => {
                        const percentage = prompt('비율을 입력하세요 (예: 50, 66.67, 75):');
                        if (percentage && !isNaN(parseFloat(percentage))) {
                          const value = parseFloat(percentage);
                          if (value > 0 && value <= 100) {
                            const label = prompt('라벨을 입력하세요 (예: 과반수, 2/3, 3/4):') || `${value}%`;
                            setVoteThresholds([
                              ...voteThresholds,
                              { id: Date.now().toString(), percentage: value, label }
                            ]);
                          } else {
                            setAlertModal({ isOpen: true, message: '0보다 크고 100 이하의 값을 입력하세요.', title: '입력 오류' });
                          }
                        }
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{
                        background: 'rgba(0, 113, 227, 0.1)',
                        color: 'var(--color-secondary)'
                      }}
                    >
                      + 비율 추가
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {voteThresholds.map((threshold) => {
                      const attendedCodes = resultStats.attendedCodes;
                      const requiredVotes = Math.ceil(attendedCodes * (threshold.percentage / 100));
                      
                      return (
                        <div key={threshold.id} className="relative group bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                message: `"${threshold.label}" 비율을 삭제하시겠습니까?`,
                                title: '비율 삭제',
                                variant: 'danger',
                                onConfirm: () => {
                                  setVoteThresholds(voteThresholds.filter(t => t.id !== threshold.id));
                                }
                              });
                            }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold hover:bg-red-200"
                            title="삭제"
                          >
                            ✕
                          </button>
                          
                          <div className="flex items-center gap-2 mb-4">
                            <div className="text-xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                              {threshold.label}
                            </div>
                            <div className="text-sm text-gray-500">
                              ({threshold.percentage}%)
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="text-sm text-gray-600 mb-2">필요한 득표수</div>
                            <div className="text-4xl font-bold text-green-600 mb-2">
                              {requiredVotes}명
                            </div>
                            <div className="text-xs text-gray-500 pt-3 border-t border-blue-200">
                              참석자 {attendedCodes}명 기준
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                ) : (
                  <>
                    {/* Confirmed Winners Section - Only for plurality with tie */}
                    {election.winning_criteria.type === 'plurality' && hasTie && confirmedWinners.length > 0 && (
                      <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-100 border-2 border-yellow-400">
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                          🏆 당선 확정
                        </h2>
                        <p className="text-sm text-gray-700 mb-4">
                          다득표로 당선이 확정된 후보자입니다.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {confirmedWinners.map((winner, index) => {
                            let actualRank = 1;
                            for (let i = 0; i < index; i++) {
                              if (confirmedWinners[i].vote_count > winner.vote_count) {
                                actualRank++;
                              }
                            }
                            
                            return (
                              <div key={winner.id} className="p-4 rounded-xl shadow-sm" style={{ background: 'white' }}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                                    actualRank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900' :
                                    actualRank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800' :
                                    actualRank === 3 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900' :
                                    'bg-gradient-to-br from-blue-300 to-blue-400 text-gray-800'
                                  }`}>
                                    {actualRank}
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
                    )}

                    {/* Tied Candidates Section - Only for plurality with tie */}
                    {election.winning_criteria.type === 'plurality' && hasTie && tiedCandidates.length > 0 && (
                      <div className="p-6 rounded-xl bg-gradient-to-br from-orange-50 to-red-100 border-2 border-orange-400">
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                          ⚠️ 동점으로 당선자 미확정
                        </h2>
                        <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.8)' }}>
                          <p className="text-sm text-gray-700">
                            <strong>동점 발생:</strong> {election.max_selections}명을 선출해야 하며, 
                            {tiedCandidates[0]?.vote_count}표로 동점인 후보가 {tiedCandidates.length}명입니다.
                            {confirmedWinners.length > 0 && ` (당선 확정: ${confirmedWinners.length}명, 남은 자리: ${election.max_selections - confirmedWinners.length}명)`}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {tiedCandidates.map((candidate) => (
                            <div key={candidate.id} className="p-4 rounded-xl shadow-sm border-2 border-orange-300" style={{ background: 'white' }}>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-orange-200 text-orange-900">
                                  ?
                                </div>
                                <div className="flex-1">
                                  <div className="font-bold text-lg" style={{ color: '#1d1d1f' }}>{candidate.name}</div>
                                  <div className="text-sm text-gray-600">
                                    {candidate.vote_count}표 ({resultStats.totalVotes > 0 ? ((candidate.vote_count / resultStats.totalVotes) * 100).toFixed(1) : 0}%)
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standard Winners Section - For non-tie cases or non-plurality */}
                    {(!hasTie || election.winning_criteria.type !== 'plurality') && winners.length > 0 && (
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
                                    'bg-gradient-to-br from-green-400 to-emerald-500 text-white'
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
                    )}
                  </>
                )}

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
                        
                        // For plurality with tie: distinguish confirmed winners from tied candidates
                        const isConfirmedWinner = election.winning_criteria.type === 'plurality' && hasTie 
                          ? confirmedWinners.some(w => w.id === candidate.id)
                          : !hasTie && winners.some(w => w.id === candidate.id);
                        
                        const isTied = election.winning_criteria.type === 'plurality' && hasTie 
                          ? tiedCandidates.some(t => t.id === candidate.id)
                          : hasTie && winners.some(w => w.id === candidate.id);
                        
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
                              isConfirmedWinner ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                  isTied ? 'bg-orange-200 text-orange-800' :
                                  isConfirmedWinner ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {isTied ? '?' : actualRank}
                                </div>
                                <div>
                                  <div className="font-semibold flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                                    {candidate.name}
                                    {isConfirmedWinner && <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded-full font-bold">당선</span>}
                                    {isTied && <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full font-bold">미확정</span>}
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
                                  isConfirmedWinner ? (
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

          {/* 비고/메모 섹션 - 결과 탭에서만 표시 */}
          {activeTab === 'results' && (
            <div className="space-y-6 mt-6">
              <div className="card-apple p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: '#1d1d1f' }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                비고
              </h2>

              {/* 비고 추가 입력 */}
              <div className="mb-6">
                <div className="flex gap-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="비고를 입력하세요..."
                    className="input-apple flex-1 resize-none"
                    rows={3}
                    style={{ minHeight: '80px' }}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-6 py-3 rounded-2xl font-semibold transition-all duration-200 self-end"
                    style={{ 
                      background: newNote.trim() ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)',
                      color: newNote.trim() ? 'white' : '#999',
                      letterSpacing: '-0.01em',
                      cursor: newNote.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 비고 목록 */}
              {notes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p style={{ letterSpacing: '-0.01em' }}>작성된 비고가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div 
                      key={note.id} 
                      className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
                      style={{ background: 'white' }}
                    >
                      {editingNoteId === note.id ? (
                        // 수정 모드
                        <div className="space-y-3">
                          <textarea
                            value={editingNoteContent}
                            onChange={(e) => setEditingNoteContent(e.target.value)}
                            className="input-apple w-full resize-none"
                            rows={3}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setEditingNoteId(null);
                                setEditingNoteContent('');
                              }}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                              style={{ 
                                background: 'rgba(0, 0, 0, 0.04)',
                                color: '#1d1d1f'
                              }}
                            >
                              취소
                            </button>
                            <button
                              onClick={() => handleUpdateNote(note.id)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                              style={{ 
                                background: 'var(--color-secondary)',
                                color: 'white'
                              }}
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 보기 모드
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="text-gray-800 whitespace-pre-wrap" style={{ letterSpacing: '-0.01em' }}>
                                {note.content}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteContent(note.content);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-100"
                                style={{ color: '#1d1d1f' }}
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-50"
                                style={{ color: '#dc2626' }}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {note.created_by && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {note.created_by}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {new Date(note.created_at).toLocaleString('ko-KR', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            {note.updated_at !== note.created_at && (
                              <span className="text-gray-400">(수정됨)</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </main>

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
