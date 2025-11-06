'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import { nanoid } from 'nanoid';

interface VoterCode {
  id: string;
  code: string;
  code_type: 'delegate' | 'officer';
  accessible_elections: string[];
  village_id: string | null;
  is_used: boolean;
  voter_name: string | null;
  used_at: string | null;
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

export default function CodesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<VoterCode[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 생성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [codeType, setCodeType] = useState<'delegate' | 'officer'>('delegate');
  const [quantity, setQuantity] = useState(10);
  const [selectedElections, setSelectedElections] = useState<string[]>([]);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [generating, setGenerating] = useState(false);

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

  const loadCodes = useCallback(async () => {
    const supabase = createClient();
    
    let query = supabase
      .from('voter_codes')
      .select(`
        *,
        villages (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (filter === 'used') {
      query = query.eq('is_used', true);
    } else if (filter === 'unused') {
      query = query.eq('is_used', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('코드 로딩 오류:', error);
      return;
    }

    setCodes(data || []);
  }, [filter]);

  const loadElections = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('elections')
      .select('id, title, election_type, status')
      .in('status', ['registering', 'active'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('투표 로딩 오류:', error);
      return;
    }

    setElections(data || []);
  }, []);

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
      await loadElections();
      await loadVillages();
    };

    initialize();
  }, [checkAuth, loadElections, loadVillages]);

  useEffect(() => {
    if (!loading) {
      loadCodes();
    }
  }, [filter, loading, loadCodes]);

  const handleGenerateCodes = async () => {
    if (selectedElections.length === 0) {
      alert('접근 가능한 투표를 최소 1개 선택하세요.');
      return;
    }

    if (codeType === 'delegate' && !selectedVillage) {
      alert('총대 코드는 마을을 선택해야 합니다.');
      return;
    }

    if (quantity < 1 || quantity > 1000) {
      alert('생성 개수는 1~1000개 사이여야 합니다.');
      return;
    }

    setGenerating(true);

    try {
      const supabase = createClient();
      const newCodes = [];

      for (let i = 0; i < quantity; i++) {
        const codeData: {
          code: string;
          code_type: 'delegate' | 'officer';
          accessible_elections: string[];
          village_id?: string;
          is_used: boolean;
        } = {
          code: nanoid(10),
          code_type: codeType,
          accessible_elections: selectedElections,
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

      if (error) {
        console.error('코드 생성 오류:', error);
        alert('코드 생성에 실패했습니다.');
        setGenerating(false);
        return;
      }

      alert(`${quantity}개의 참여코드가 생성되었습니다!`);
      setShowCreateModal(false);
      setSelectedElections([]);
      setSelectedVillage('');
      setQuantity(10);
      loadCodes();
    } catch (error) {
      console.error('코드 생성 중 오류:', error);
      alert('코드 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('정말 이 참여코드를 삭제하시겠습니까?')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('voter_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('코드 삭제 오류:', error);
      alert('코드 삭제에 실패했습니다.');
      return;
    }

    loadCodes();
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
          <div className="w-16 h-16 mx-auto mb-6">
            <svg className="animate-spin h-16 w-16" style={{ color: 'var(--color-secondary)' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>코드 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
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
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                투표 참여코드를 생성하고 관리합니다
              </p>
            </div>
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
                <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>사용됨</p>
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
                <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>미사용</p>
                <p className="text-4xl font-semibold" style={{ color: '#6b7280', letterSpacing: '-0.03em' }}>
                  {stats.unused}
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
              onClick={() => setFilter('unused')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'unused' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'unused' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'unused' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              미사용
            </button>
            <button
              onClick={() => setFilter('used')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'used' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'used' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'used' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              사용됨
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
                            사용됨
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-semibold rounded-full" style={{ 
                            background: 'rgba(107, 114, 128, 0.1)',
                            color: '#6b7280',
                            letterSpacing: '-0.01em'
                          }}>
                            미사용
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
                </label>
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
                <div className="border-2 rounded-2xl p-4 max-h-60 overflow-y-auto" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                  {elections.filter(e => e.election_type === codeType).length === 0 ? (
                    <div className="text-sm text-gray-600 text-center py-6" style={{ letterSpacing: '-0.01em' }}>
                      {codeType === 'delegate' ? '총대 선출' : '임원 선출'} 투표가 없습니다.
                      <br />
                      <Link href="/admin/elections/create" className="font-medium hover:underline" style={{ color: 'var(--color-secondary)' }}>
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
                <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                  선택한 투표에만 이 코드로 참여할 수 있습니다
                </p>
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
    </div>
  );
}
