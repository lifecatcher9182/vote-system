'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import SystemLogo from '@/components/SystemLogo';

interface Village {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export default function VillagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [villages, setVillages] = useState<Village[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newVillage, setNewVillage] = useState({ name: '', code: '' });
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);

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

  const handleEditVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingVillage || !editingVillage.name || !editingVillage.code) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('villages')
      .update({ 
        name: editingVillage.name, 
        code: editingVillage.code 
      })
      .eq('id', editingVillage.id);

    if (error) {
      console.error('마을 수정 오류:', error);
      alert('마을 수정에 실패했습니다. 코드가 중복되었을 수 있습니다.');
      return;
    }

    setEditingVillage(null);
    setShowEditModal(false);
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

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('villages')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경에 실패했습니다.');
      return;
    }

    loadVillages();
  };

  const filteredVillages = villages.filter(v => {
    if (filter === 'active') return v.is_active;
    if (filter === 'inactive') return !v.is_active;
    return true;
  });

  // 정렬 적용
  const sortedVillages = [...filteredVillages].sort((a, b) => {
    let compareValue = 0;
    
    if (sortBy === 'name') {
      compareValue = a.name.localeCompare(b.name, 'ko');
    } else if (sortBy === 'code') {
      compareValue = a.code.localeCompare(b.code);
    } else if (sortBy === 'created_at') {
      compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  const handleSort = (column: 'name' | 'code' | 'created_at') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin mx-auto mb-6" style={{ borderTopColor: 'var(--color-secondary)' }} />
          <p className="text-lg font-medium text-gray-600 mt-6" style={{ letterSpacing: '-0.01em' }}>마을 목록을 불러오는 중...</p>
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
                마을 관리
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                총대 선출을 위한 마을을 관리합니다
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
              style={{ 
                background: 'rgba(0, 0, 0, 0.06)',
                color: '#1d1d1f',
                letterSpacing: '-0.01em'
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              뒤로가기
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-8">
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
              전체 ({villages.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'active' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'active' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'active' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              활성화 ({villages.filter(v => v.is_active).length})
            </button>
            <button
              onClick={() => setFilter('inactive')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'inactive' ? 'text-white' : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'inactive' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'inactive' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              비활성화 ({villages.filter(v => !v.is_active).length})
            </button>
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--color-secondary)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              letterSpacing: '-0.01em'
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            새 마을 추가
          </button>
        </div>

        {sortedVillages.length === 0 ? (
          <div className="card-apple p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
              {filter === 'active' ? '활성화된 마을이 없습니다' : 
               filter === 'inactive' ? '비활성화된 마을이 없습니다' :
               '등록된 마을이 없습니다'}
            </h3>
            <p className="text-gray-500 mb-8" style={{ letterSpacing: '-0.01em' }}>총대 선출을 위한 마을을 추가하세요</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
              style={{
                background: 'var(--color-secondary)',
                color: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                letterSpacing: '-0.01em'
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              마을 추가
            </button>
          </div>
        ) : (
          <div className="card-apple overflow-hidden">
            <table className="w-full">
              <thead style={{ background: 'rgba(0, 0, 0, 0.02)', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-gray-900 transition-colors"
                      style={{ color: sortBy === 'name' ? '#1d1d1f' : '#6b7280', letterSpacing: '-0.01em' }}
                    >
                      마을 이름
                      {sortBy === 'name' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortOrder === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('code')}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-gray-900 transition-colors"
                      style={{ color: sortBy === 'code' ? '#1d1d1f' : '#6b7280', letterSpacing: '-0.01em' }}
                    >
                      마을 코드
                      {sortBy === 'code' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortOrder === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    상태
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center gap-2 text-sm font-semibold hover:text-gray-900 transition-colors"
                      style={{ color: sortBy === 'created_at' ? '#1d1d1f' : '#6b7280', letterSpacing: '-0.01em' }}
                    >
                      생성일
                      {sortBy === 'created_at' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortOrder === 'asc' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedVillages.map((village, index) => (
                  <tr 
                    key={village.id}
                    style={{ 
                      borderBottom: index < sortedVillages.length - 1 ? '1px solid rgba(0, 0, 0, 0.04)' : 'none'
                    }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--color-secondary)' }}>
                          {village.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>
                          {village.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-gray-700" style={{ letterSpacing: '0.05em' }}>
                        {village.code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(village.id, village.is_active)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 hover:scale-105"
                        style={{ 
                          background: village.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                          color: village.is_active ? '#22c55e' : '#6b7280',
                          letterSpacing: '-0.01em'
                        }}
                      >
                        {village.is_active ? '✓ 활성화' : '✕ 비활성화'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                      {new Date(village.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingVillage(village);
                            setShowEditModal(true);
                          }}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                          style={{ 
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            letterSpacing: '-0.01em'
                          }}
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteVillage(village.id)}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                          style={{ 
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            letterSpacing: '-0.01em'
                          }}
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
      </main>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="card-apple max-w-md w-full p-8 animate-[scale-in_0.2s_ease-out]">
            <h2 className="text-2xl font-semibold mb-6" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              새 마을 추가
            </h2>
            
            <form onSubmit={handleAddVillage}>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    마을 이름
                  </label>
                  <input
                    type="text"
                    value={newVillage.name}
                    onChange={(e) => setNewVillage({ ...newVillage, name: e.target.value })}
                    className="input-apple"
                    placeholder="예: 갈보리"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    마을 코드
                  </label>
                  <input
                    type="text"
                    value={newVillage.code}
                    onChange={(e) => setNewVillage({ ...newVillage, code: e.target.value.toUpperCase() })}
                    className="input-apple font-mono"
                    placeholder="예: GAL"
                  />
                  <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    영문 대문자로 입력하세요
                  </p>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewVillage({ name: '', code: '' });
                  }}
                  className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.06)',
                    color: '#1d1d1f',
                    letterSpacing: '-0.01em'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'var(--color-secondary)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && editingVillage && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="card-apple max-w-md w-full p-8 animate-[scale-in_0.2s_ease-out]">
            <h2 className="text-2xl font-semibold mb-6" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              마을 수정
            </h2>
            
            <form onSubmit={handleEditVillage}>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    마을 이름
                  </label>
                  <input
                    type="text"
                    value={editingVillage.name}
                    onChange={(e) => setEditingVillage({ ...editingVillage, name: e.target.value })}
                    className="input-apple"
                    placeholder="예: 갈보리"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    마을 코드
                  </label>
                  <input
                    type="text"
                    value={editingVillage.code}
                    onChange={(e) => setEditingVillage({ ...editingVillage, code: e.target.value.toUpperCase() })}
                    className="input-apple font-mono"
                    placeholder="예: GAL"
                  />
                  <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    영문 대문자로 입력하세요
                  </p>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingVillage(null);
                  }}
                  className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.06)',
                    color: '#1d1d1f',
                    letterSpacing: '-0.01em'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'var(--color-secondary)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
