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
            <h1 className="text-3xl font-bold text-gray-900">참여코드 관리</h1>
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
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 코드</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🎟️</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">사용됨</p>
                  <p className="text-3xl font-bold text-green-600">{stats.used}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">미사용</p>
                  <p className="text-3xl font-bold text-gray-600">{stats.unused}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
              </div>
            </div>
          </div>

          {/* 필터 및 액션 바 */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="flex gap-2">
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
                onClick={() => setFilter('unused')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'unused'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                미사용
              </button>
              <button
                onClick={() => setFilter('used')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'used'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                사용됨
              </button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="코드 또는 이름 검색..."
                className="flex-1 sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap"
              >
                + 코드 생성
              </button>
            </div>
          </div>

          {/* 코드 목록 */}
          {filteredCodes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">참여코드가 없습니다</h3>
              <p className="mt-1 text-gray-500">새로운 참여코드를 생성하세요.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + 코드 생성
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      코드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      유형
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      마을
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-bold text-gray-900">
                          {code.code}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {code.code_type === 'delegate' ? '총대' : '임원'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {code.villages?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {code.voter_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {code.is_used ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                            사용됨
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800">
                            미사용
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(code.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={code.is_used}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 코드 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">참여코드 생성</h2>

              <div className="space-y-6">
                {/* 코드 유형 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    코드 유형 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCodeType('delegate');
                        setSelectedElections([]);
                      }}
                      className={`p-4 border-2 rounded-lg font-medium transition-all ${
                        codeType === 'delegate'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
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
                      className={`p-4 border-2 rounded-lg font-medium transition-all ${
                        codeType === 'officer'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      임원 코드
                    </button>
                  </div>
                </div>

                {/* 생성 개수 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    생성 개수 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    min="1"
                    max="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">최대 1000개까지 생성 가능합니다.</p>
                </div>

                {/* 마을 선택 (총대 코드인 경우) */}
                {codeType === 'delegate' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      마을 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedVillage}
                      onChange={(e) => setSelectedVillage(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    접근 가능한 투표 <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {elections.filter(e => e.election_type === codeType).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        {codeType === 'delegate' ? '총대 선출' : '임원 선출'} 투표가 없습니다.
                        <br />
                        <Link href="/admin/elections/create" className="text-blue-600 hover:underline">
                          투표를 먼저 생성하세요.
                        </Link>
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {elections
                          .filter(e => e.election_type === codeType)
                          .map((election) => (
                            <label
                              key={election.id}
                              className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedElections.includes(election.id)}
                                onChange={() => toggleElectionSelection(election.id)}
                                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-sm">{election.title}</span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    선택한 투표에만 이 코드로 참여할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* 버튼 */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleGenerateCodes}
                  disabled={generating}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {generating ? '생성 중...' : '코드 생성'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedElections([]);
                    setSelectedVillage('');
                    setQuantity(10);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
