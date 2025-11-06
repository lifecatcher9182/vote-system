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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <svg className="animate-spin h-16 w-16" style={{ color: 'var(--color-secondary)' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>마을 목록을 불러오는 중...</p>
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
                마을 관리
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                총대 선출을 위한 마을을 관리합니다
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
        <div className="mb-8">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-apple-primary inline-flex items-center gap-2 text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 마을 추가
          </button>
        </div>

        {villages.length === 0 ? (
          <div className="card-apple p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
              등록된 마을이 없습니다
            </h3>
            <p className="text-gray-500 mb-8" style={{ letterSpacing: '-0.01em' }}>총대 선출을 위한 마을을 추가하세요</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-apple-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              마을 추가
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {villages.map((village) => (
              <div 
                key={village.id}
                className="card-apple p-6 hover:scale-[1.02] transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl" style={{ background: 'var(--color-secondary)' }}>
                    {village.name.charAt(0)}
                  </div>
                  <button
                    onClick={() => handleDeleteVillage(village.id)}
                    className="p-2 rounded-xl transition-all duration-200 hover:scale-110"
                    style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                    title="삭제"
                  >
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                  {village.name}
                </h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="font-mono font-semibold">{village.code}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{new Date(village.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                </div>
              </div>
            ))}
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
                  className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.04)',
                    color: '#1d1d1f',
                    letterSpacing: '-0.01em'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn-apple-primary flex-1"
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
