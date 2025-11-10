'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';

export default function CreateElectionGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    group_type: 'delegate' as 'delegate' | 'officer',
  });

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

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;
      setLoading(false);
    };

    initialize();
  }, [checkAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('그룹 제목을 입력해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('election_groups')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          group_type: formData.group_type,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) {
        console.error('그룹 생성 오류:', error);
        alert('그룹 생성에 실패했습니다.');
        return;
      }

      alert('그룹이 생성되었습니다!');
      router.push(`/admin/election-groups/${data.id}`);
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      alert('그룹 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
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
            <div className="flex items-center gap-4">
              <SystemLogo size="md" linkToHome />
              <div>
                <h1 className="text-3xl font-semibold" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.03em'
                }}>
                  새 투표 그룹 만들기
                </h1>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  총대 투표 또는 임원 투표 그룹을 생성합니다
                </p>
              </div>
            </div>
            <Link 
              href="/admin/election-groups"
              className="btn-apple-secondary text-sm"
            >
              ← 목록으로
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-12 px-6">
        <form onSubmit={handleSubmit} className="card-apple p-8">
          {/* 그룹 타입 선택 */}
          <div className="mb-8">
            <label className="block text-sm font-semibold mb-3" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.01em'
            }}>
              그룹 타입 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, group_type: 'delegate' })}
                className={`p-6 rounded-xl border-2 transition-all ${
                  formData.group_type === 'delegate'
                    ? 'border-[var(--color-secondary)] bg-[var(--color-primary)] bg-opacity-5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-4xl mb-2">📋</div>
                <div className="font-semibold text-lg mb-1">총대 투표</div>
                <div className="text-sm text-gray-600">
                  마을별 총대 선출 투표를 그룹으로 관리
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, group_type: 'officer' })}
                className={`p-6 rounded-xl border-2 transition-all ${
                  formData.group_type === 'officer'
                    ? 'border-[var(--color-secondary)] bg-[var(--color-primary)] bg-opacity-5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-4xl mb-2">👔</div>
                <div className="font-semibold text-lg mb-1">임원 투표</div>
                <div className="text-sm text-gray-600">
                  직책별 임원 선출 투표를 그룹으로 관리
                </div>
              </button>
            </div>
          </div>

          {/* 그룹 제목 */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-semibold mb-2" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.01em'
            }}>
              그룹 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 2025년 상반기 총대 투표"
              className="input-apple"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              그룹 전체를 대표하는 제목을 입력하세요
            </p>
          </div>

          {/* 그룹 설명 */}
          <div className="mb-8">
            <label htmlFor="description" className="block text-sm font-semibold mb-2" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.01em'
            }}>
              그룹 설명 (선택)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="그룹에 대한 간단한 설명을 입력하세요"
              className="input-apple"
              rows={3}
            />
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
            <div className="flex gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-blue-900 mb-1">다음 단계</h4>
                <p className="text-sm text-blue-700">
                  그룹을 생성한 후, 일괄 투표 생성 기능을 사용하여 
                  {formData.group_type === 'delegate' 
                    ? ' 마을별 총대 투표를 자동으로 생성할 수 있습니다.' 
                    : ' 직책별 임원 투표를 자동으로 생성할 수 있습니다.'}
                </p>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <Link
              href="/admin/election-groups"
              className="btn-apple-secondary flex-1"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="btn-apple-primary flex-1"
            >
              {submitting ? '생성 중...' : '그룹 생성'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
