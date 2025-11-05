'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';

interface Village {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export default function VillagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState<Village[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVillage, setNewVillage] = useState({ name: '', code: '' });

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

  const loadVillages = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('villages')
      .select('*')
      .order('name');

    if (error) {
      console.error('마을 로딩 오류:', error);
      return;
    }

    setVillages(data || []);
  }, []);

  useEffect(() => {
    const initializeVillages = async () => {
      await checkAuth();
      await loadVillages();
    };
    
    initializeVillages();
  }, [checkAuth, loadVillages]);

  const handleAddVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newVillage.name || !newVillage.code) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('villages')
      .insert([{ name: newVillage.name, code: newVillage.code }]);

    if (error) {
      console.error('마을 추가 오류:', error);
      alert('마을 추가에 실패했습니다. 코드가 중복되었을 수 있습니다.');
      return;
    }

    setNewVillage({ name: '', code: '' });
    setShowAddModal(false);
    loadVillages();
  };

  const handleDeleteVillage = async (id: string) => {
    if (!confirm('정말 이 마을을 삭제하시겠습니까?')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('villages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('마을 삭제 오류:', error);
      alert('마을 삭제에 실패했습니다.');
      return;
    }

    loadVillages();
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
            <h1 className="text-3xl font-bold text-gray-900">마을 관리</h1>
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
          <div className="mb-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              + 새 마을 추가
            </button>
          </div>

          {villages.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">마을이 없습니다</h3>
              <p className="mt-1 text-gray-500">총대 선출을 위한 마을을 추가하세요.</p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      마을 이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      코드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      등록일
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {villages.map((village) => (
                    <tr key={village.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {village.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {village.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(village.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteVillage(village.id)}
                          className="text-red-600 hover:text-red-900"
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

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">새 마을 추가</h2>
            <form onSubmit={handleAddVillage}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    마을 이름
                  </label>
                  <input
                    type="text"
                    value={newVillage.name}
                    onChange={(e) => setNewVillage({ ...newVillage, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 갈보리"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    마을 코드
                  </label>
                  <input
                    type="text"
                    value={newVillage.code}
                    onChange={(e) => setNewVillage({ ...newVillage, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: GAL"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewVillage({ name: '', code: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
