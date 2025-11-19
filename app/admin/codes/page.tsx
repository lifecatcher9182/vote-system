'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

interface VoterCode {
  id: string;
  code: string;
  code_type: 'delegate' | 'officer';
  accessible_elections: string[];
  village_id: string | null;
  is_used: boolean;
  voter_name: string | null;
  used_at: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  created_at: string;
  villages?: {
    name: string;
  };
}

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  status: string;
}

interface Village {
  id: string;
  name: string;
}

function CodesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams?.get('group_id');
  
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<VoterCode[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [filter, setFilter] = useState<'all' | 'voted' | 'attended' | 'not_attended'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupInfo, setGroupInfo] = useState<{ title: string; group_type: 'delegate' | 'officer' } | null>(null);
  
  // 생성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [codeType, setCodeType] = useState<'delegate' | 'officer'>('delegate');
  const [quantity, setQuantity] = useState(10);
  const [selectedElections, setSelectedElections] = useState<string[]>([]);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [generating, setGenerating] = useState(false);

  // Alert and Confirm modal states
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ 
    isOpen: false, 
    message: '', 
    title: '알림' 
  });
  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean; 
    message: string; 
    title?: string;
    onConfirm: () => void;
    variant?: 'danger' | 'primary';
  }>({ 
    isOpen: false, 
    message: '', 
    title: '확인',
    onConfirm: () => {},
    variant: 'primary'
  });

  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin');
      return;
    }

    const { isAdmin } = await checkAdminAccess(user.email!);
    if (!isAdmin) {
      setAlertModal({
        isOpen: true,
        message: '관리자 권한이 없습니다.',
        title: '접근 권한 없음'
      });
      await signOut();
      router.push('/admin');
      return;
    }

    setLoading(false);
  }, [router]);

  const loadCodes = useCallback(async () => {
    const supabase = createClient();
    
    // group_id가 있으면 먼저 그룹의 투표 ID들을 가져옴
    let groupElectionIds: string[] = [];
    if (groupId) {
      const { data: groupElections } = await supabase
        .from('elections')
        .select('id')
        .eq('group_id', groupId);
      
      groupElectionIds = groupElections?.map(e => e.id) || [];
    }
    
    const { data, error } = await supabase
      .from('voter_codes')
      .select(`
        *,
        villages (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('코드 로딩 오류:', error);
      return;
    }

    let filteredData = data || [];

    // group_id가 있으면 해당 그룹의 투표들에 속한 코드만 필터링
    if (groupId && groupElectionIds.length > 0) {
      filteredData = filteredData.filter(code => {
        // accessible_elections 배열과 그룹의 투표 ID들이 겹치는지 확인
        return code.accessible_elections.some((electionId: string) => 
          groupElectionIds.includes(electionId)
        );
      });
    }

    // 클라이언트 사이드 필터링
    if (filter === 'voted') {
      // 투표 완료 (is_used = true)
      filteredData = filteredData.filter(c => c.is_used);
    } else if (filter === 'attended') {
      // 참석 확인 (로그인했지만 투표 안함)
      filteredData = filteredData.filter(c => c.first_login_at && !c.is_used);
    } else if (filter === 'not_attended') {
      // 미참석 (로그인 안함)
      filteredData = filteredData.filter(c => !c.first_login_at);
    }

    setCodes(filteredData);
  }, [filter, groupId]);

  const loadElections = useCallback(async () => {
    const supabase = createClient();
    
    let query = supabase
      .from('elections')
      .select('id, title, election_type, status')
      .order('created_at', { ascending: false });
    
    // group_id가 있으면 해당 그룹의 투표만 로딩
    if (groupId) {
      query = query.eq('group_id', groupId);
    }
    
    const { data, error } = await query;

    if (error) {
      console.error('투표 로딩 오류:', error);
      return;
    }

    setElections(data || []);
  }, [groupId]);

  const loadVillages = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('villages')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('마을 로딩 오류:', error);
      return;
    }

    setVillages(data || []);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      
      // group_id가 있으면 그룹 정보 로딩
      if (groupId) {
        const supabase = createClient();
        const { data } = await supabase
          .from('election_groups')
          .select('title, group_type')
          .eq('id', groupId)
          .single();
        
        if (data) {
          setGroupInfo(data);
          setCodeType(data.group_type);
        }
      }
      
      await loadElections();
      await loadVillages();
    };

    initialize();
  }, [checkAuth, loadElections, loadVillages, groupId]);

  useEffect(() => {
    if (!loading) {
      loadCodes();
    }
  }, [filter, loading, loadCodes]);

  const handleGenerateCodes = async () => {
    // 그룹 기반인 경우 해당 그룹의 모든 투표를 자동 선택
    const electionsToAccess = groupId 
      ? elections.map(e => e.id) 
      : selectedElections;
    
    if (electionsToAccess.length === 0) {
      setAlertModal({
        isOpen: true,
        message: '접근 가능한 투표를 최소 1개 선택하세요.',
        title: '입력 오류'
      });
      return;
    }

    if (codeType === 'delegate' && !selectedVillage) {
      setAlertModal({
        isOpen: true,
        message: '총대 코드는 마을을 선택해야 합니다.',
        title: '입력 오류'
      });
      return;
    }

    if (quantity < 1 || quantity > 1000) {
      setAlertModal({
        isOpen: true,
        message: '생성 개수는 1~1000개 사이여야 합니다.',
        title: '입력 오류'
      });
      return;
    }

    setGenerating(true);

    try {
      const supabase = createClient();
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (!success && retryCount < maxRetries) {
        const newCodes = [];

        // 중복되지 않는 코드 생성
        for (let i = 0; i < quantity; i++) {
          const uniqueCode = await generateUniqueVoterCode();
          const codeData: {
            code: string;
            code_type: 'delegate' | 'officer';
            accessible_elections: string[];
            village_id?: string;
            is_used: boolean;
          } = {
            code: uniqueCode,
            code_type: codeType,
            accessible_elections: electionsToAccess,
            is_used: false,
          };

          if (codeType === 'delegate') {
            codeData.village_id = selectedVillage;
          }

          newCodes.push(codeData);
        }

        const { error } = await supabase
          .from('voter_codes')
          .insert(newCodes);

        if (!error) {
          // 성공!
          success = true;
          setAlertModal({
            isOpen: true,
            message: `${quantity}개의 참여코드가 생성되었습니다!`,
            title: '생성 완료'
          });
          setShowCreateModal(false);
          setSelectedElections([]);
          setSelectedVillage('');
          setQuantity(10);
          loadCodes();
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
          setAlertModal({
            isOpen: true,
            message: '코드 생성에 실패했습니다.',
            title: '오류'
          });
          break;
        }
      }
    } catch (error) {
      console.error('코드 생성 중 오류:', error);
      setAlertModal({
        isOpen: true,
        message: '코드 생성 중 오류가 발생했습니다.',
        title: '오류'
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      message: '정말 이 참여코드를 삭제하시겠습니까?',
      title: '코드 삭제',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from('voter_codes')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('코드 삭제 오류:', error);
          setAlertModal({
            isOpen: true,
            message: '코드 삭제에 실패했습니다.',
            title: '오류'
          });
          return;
        }

        loadCodes();
      }
    });
  };

  const toggleElectionSelection = (electionId: string) => {
    if (selectedElections.includes(electionId)) {
      setSelectedElections(selectedElections.filter(id => id !== electionId));
    } else {
      setSelectedElections([...selectedElections, electionId]);
    }
  };

  const filteredCodes = codes.filter(code => 
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.voter_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: codes.length,
    used: codes.filter(c => c.is_used).length,
    unused: codes.filter(c => !c.is_used).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto mb-6"></div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>코드 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      {/* Logo - 좌측 상단 고정 */}
      <div className="fixed top-6 left-6 z-50">
        <SystemLogo size="sm" linkToHome />
      </div>

      {/* Header */}
      <header className="glass-effect border-b" style={{ 
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: 'rgba(0, 0, 0, 0.05)'
      }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold mb-1" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                참여코드 관리
                {groupInfo && (
                  <span className="ml-3 text-xl text-gray-600">
                    • {groupInfo.title}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                {groupInfo 
                  ? `${groupInfo.group_type === 'delegate' ? '총대' : '임원'} 투표 그룹의 참여코드를 생성하고 관리합니다` 
                  : '투표 참여코드를 생성하고 관리합니다'}
              </p>
            </div>
            <div className="flex gap-3">
              {groupId && (
                <Link 
                  href={`/admin/election-groups/${groupId}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-200"
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.04)',
                    color: '#1d1d1f'
                  }}
                >
                  ← 그룹으로
                </Link>
              )}
              <Link 
                href="/admin/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-200"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.04)',
                  color: '#1d1d1f'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                대시보드
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="card-apple p-6 group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>전체 코드</p>
                <p className="text-4xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.03em' }}>
                  {stats.total}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card-apple p-6 group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>투표 완료</p>
                <p className="text-4xl font-semibold text-green-500" style={{ letterSpacing: '-0.03em' }}>
                  {stats.used}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card-apple p-6 group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>참석 확인</p>
                <p className="text-4xl font-semibold text-blue-500" style={{ letterSpacing: '-0.03em' }}>
                  {codes.filter(c => c.first_login_at && !c.is_used).length}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="card-apple p-6 group hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>미참석</p>
                <p className="text-4xl font-semibold" style={{ color: '#6b7280', letterSpacing: '-0.03em' }}>
                  {codes.filter(c => !c.first_login_at).length}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200" style={{ background: 'rgba(107, 114, 128, 0.1)' }}>
                <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 필터 및 액션 바 */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'all' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'all' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'all' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              전체
            </button>
            <button
              onClick={() => setFilter('voted')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'voted' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'voted' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'voted' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              투표 완료
            </button>
            <button
              onClick={() => setFilter('attended')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'attended' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'attended' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'attended' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              참석 확인
            </button>
            <button
              onClick={() => setFilter('not_attended')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'not_attended' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'not_attended' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'not_attended' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              미참석
            </button>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="코드 또는 이름 검색..."
              className="input-apple flex-1 sm:w-64"
            />
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-apple-primary inline-flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              코드 생성
            </button>
          </div>
        </div>

        {/* 코드 목록 */}
        {filteredCodes.length === 0 ? (
          <div className="card-apple p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
              참여코드가 없습니다
            </h3>
            <p className="text-gray-500 mb-8" style={{ letterSpacing: '-0.01em' }}>새로운 참여코드를 생성하세요</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-apple-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              코드 생성
            </button>
          </div>
        ) : (
          <div className="card-apple overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                <thead style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      코드
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      유형
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      마을
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      이름
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      상태
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      생성일
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase" style={{ letterSpacing: '0.05em' }}>
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                  {filteredCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-bold" style={{ color: '#1d1d1f', letterSpacing: '0.02em' }}>
                          {code.code}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                        {code.code_type === 'delegate' ? '총대' : '임원'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                        {code.villages?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                        {code.voter_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {code.is_used ? (
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full" style={{ 
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            letterSpacing: '-0.01em'
                          }}>
                            ✅ 투표 완료
                          </span>
                        ) : code.first_login_at ? (
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full" style={{ 
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            letterSpacing: '-0.01em'
                          }}>
                            🟢 참석 확인
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full" style={{ 
                            background: 'rgba(107, 114, 128, 0.1)',
                            color: '#6b7280',
                            letterSpacing: '-0.01em'
                          }}>
                            ⚠️ 미참석
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                        {new Date(code.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          disabled={code.is_used}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30"
                          style={{ 
                            background: code.is_used ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444'
                          }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 코드 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="card-apple max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 animate-[scale-in_0.2s_ease-out]">
            <h2 className="text-2xl font-semibold mb-6" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              참여코드 생성
            </h2>

            <div className="space-y-6">
              {/* 코드 유형 */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  코드 유형 <span className="text-red-500">*</span>
                  {groupId && groupInfo && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({groupInfo.group_type === 'delegate' ? '총대' : '임원'} 그룹)
                    </span>
                  )}
                </label>
                {groupId ? (
                  // 그룹 모드: 선택된 타입만 표시 (비활성화)
                  <div className="p-6 rounded-2xl font-semibold" style={{
                    border: '3px solid var(--color-secondary)',
                    background: 'rgba(0, 113, 227, 0.05)',
                    color: 'var(--color-secondary)',
                    letterSpacing: '-0.01em'
                  }}>
                    {codeType === 'delegate' ? '총대 코드' : '임원 코드'}
                    <p className="text-xs font-normal text-gray-600 mt-2">
                      그룹 유형에 따라 자동으로 선택되었습니다
                    </p>
                  </div>
                ) : (
                  // 일반 모드: 선택 가능
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCodeType('delegate');
                        setSelectedElections([]);
                      }}
                      className="p-6 rounded-2xl font-semibold transition-all duration-200"
                      style={{
                        border: codeType === 'delegate' ? '3px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.1)',
                        background: codeType === 'delegate' ? 'rgba(0, 113, 227, 0.05)' : 'white',
                        color: codeType === 'delegate' ? 'var(--color-secondary)' : '#1d1d1f',
                        letterSpacing: '-0.01em'
                      }}
                    >
                      총대 코드
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCodeType('officer');
                        setSelectedVillage('');
                        setSelectedElections([]);
                      }}
                      className="p-6 rounded-2xl font-semibold transition-all duration-200"
                      style={{
                        border: codeType === 'officer' ? '3px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.1)',
                        background: codeType === 'officer' ? 'rgba(0, 113, 227, 0.05)' : 'white',
                        color: codeType === 'officer' ? 'var(--color-secondary)' : '#1d1d1f',
                        letterSpacing: '-0.01em'
                      }}
                    >
                      임원 코드
                    </button>
                  </div>
                )}
              </div>

              {/* 생성 개수 */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  생성 개수 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  min="1"
                  max="1000"
                  className="input-apple"
                />
                <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                  최대 1000개까지 생성 가능합니다
                </p>
              </div>

              {/* 마을 선택 (총대 코드인 경우) */}
              {codeType === 'delegate' && (
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    마을 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedVillage}
                    onChange={(e) => setSelectedVillage(e.target.value)}
                    className="input-apple"
                  >
                    <option value="">마을을 선택하세요</option>
                    {villages.map((village) => (
                      <option key={village.id} value={village.id}>
                        {village.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 접근 가능한 투표 선택 */}
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  접근 가능한 투표 <span className="text-red-500">*</span>
                </label>
                
                {groupId ? (
                  // 그룹 기반: 자동으로 그룹의 모든 투표 선택
                  <div className="border-2 rounded-2xl p-4" style={{ 
                    borderColor: 'rgba(0, 113, 227, 0.3)',
                    background: 'rgba(0, 113, 227, 0.05)'
                  }}>
                    <div className="flex items-start gap-3 mb-3">
                      <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-gray-700" style={{ letterSpacing: '-0.01em' }}>
                        <p className="font-semibold mb-1">이 그룹의 모든 투표에 자동으로 접근 가능합니다</p>
                        <p className="text-xs text-gray-600">
                          생성된 코드로 그룹 내 {elections.length}개 투표 모두 참여 가능합니다
                        </p>
                      </div>
                    </div>
                    {elections.length > 0 && (
                      <div className="space-y-2 pl-8">
                        {elections.map((election) => (
                          <div key={election.id} className="text-sm text-gray-600 flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {election.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // 일반 모드: 수동 선택
                  <div className="border-2 rounded-2xl p-4 max-h-60 overflow-y-auto" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                    {elections.filter(e => e.election_type === codeType).length === 0 ? (
                      <div className="text-sm text-gray-600 text-center py-6" style={{ letterSpacing: '-0.01em' }}>
                        {codeType === 'delegate' ? '총대 선출' : '임원 선출'} 투표가 없습니다.
                        <br />
                        <span className="text-xs text-gray-400 mt-2 block">
                          (전체 투표: {elections.length}개, {codeType} 타입: {elections.filter(e => e.election_type === codeType).length}개)
                        </span>
                        <Link href="/admin/elections/create" className="font-medium hover:underline mt-2 inline-block" style={{ color: 'var(--color-secondary)' }}>
                          투표를 먼저 생성하세요
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {elections
                          .filter(e => e.election_type === codeType)
                          .map((election) => (
                            <label
                              key={election.id}
                              className="flex items-center p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedElections.includes(election.id)}
                                onChange={() => toggleElectionSelection(election.id)}
                                className="mr-3 h-5 w-5 rounded border-gray-300"
                                style={{ accentColor: 'var(--color-secondary)' }}
                              />
                              <span className="text-sm" style={{ letterSpacing: '-0.01em' }}>{election.title}</span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                
                {!groupId && (
                  <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    선택한 투표에만 이 코드로 참여할 수 있습니다
                  </p>
                )}
              </div>
            </div>

            {/* 버튼 */}
            <div className="mt-8 flex gap-3">
              <button
                onClick={handleGenerateCodes}
                disabled={generating}
                className="btn-apple-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    생성 중
                  </span>
                ) : '코드 생성'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedElections([]);
                  setSelectedVillage('');
                  setQuantity(10);
                }}
                className="px-8 py-3 rounded-2xl font-semibold transition-all duration-200"
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
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        title={alertModal.title}
      />

      {/* Confirm Modal */}
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

export default function CodesPage() {
  return (
    <Suspense fallback={
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
    }>
      <CodesPageContent />
    </Suspense>
  );
}
