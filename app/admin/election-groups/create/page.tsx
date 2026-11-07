'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import SystemLogo from '@/components/SystemLogo';
import AlertModal from '@/components/AlertModal';

export default function CreateElectionGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [alertModal, setAlertModal] = useState<{ 
    isOpen: boolean; 
    message: string; 
    title?: string;
  }>({ 
    isOpen: false, 
    message: '', 
    title: '알림' 
  });

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
      setAlertModal({ isOpen: true, message: '관리자 권한이 없습니다.', title: '접근 권한 없음' });
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
      setAlertModal({ isOpen: true, message: '그룹 제목을 입력해주세요.', title: '입력 오류' });
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
        setAlertModal({ isOpen: true, message: '그룹 생성에 실패했습니다.', title: '오류' });
        return;
      }

      setAlertModal({ isOpen: true, message: '그룹이 생성되었습니다!', title: '생성 완료' });
      router.push(`/admin/election-groups/${data.id}`);
    } catch (error) {
      console.error('그룹 생성 오류:', error);
      setAlertModal({ isOpen: true, message: '그룹 생성에 실패했습니다.', title: '오류' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
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

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 50%, #ffffff 100%)' }}>
      {/* 헤더 */}
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.85)',
        
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div className="max-w-6xl mx-auto px-6 py-5 sm:px-8 lg:px-12">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <SystemLogo size="md" linkToHome />
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold" style={{ 
                  color: 'var(--ink)',
                  letterSpacing: '-0.03em'
                }}>
                  새 투표 그룹 만들기
                </h1>
                <p className="text-sm text-gray-600 mt-0.5" style={{ letterSpacing: '-0.01em' }}>
                  총대 투표 또는 임원 투표 그룹을 생성합니다
                </p>
              </div>
            </div>
            <button
              onClick={() => router.back()}
              className="hidden sm:flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
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
      </header>

      <main className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        {/* 상단 설명 카드 */}
        <div className="mb-8 rounded-3xl p-6 sm:p-8" style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.15)'
        }}>
          <div className="flex items-start gap-4">
            <div className="text-4xl">✨</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2" style={{ 
                color: 'var(--ink)',
                letterSpacing: '-0.02em'
              }}>
                투표 그룹이란?
              </h3>
              <p className="text-sm leading-relaxed text-gray-700" style={{ letterSpacing: '-0.01em' }}>
                여러 개의 관련된 투표를 하나의 그룹으로 묶어서 관리할 수 있습니다. 
                참여자는 하나의 코드로 그룹 내 모든 투표에 순차적으로 참여할 수 있어요.
              </p>
            </div>
          </div>
        </div>

        {/* 메인 폼 카드 */}
        <form onSubmit={handleSubmit} className="card-apple p-8 sm:p-12">
          {/* 그룹 타입 선택 */}
          <div className="mb-12">
            <label className="block text-lg font-semibold mb-5" style={{ 
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              그룹 타입 <span className="text-red-500 text-base">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, group_type: 'delegate' })}
                className={`group p-8 rounded-3xl border-2 transition-all duration-300 text-left transform ${
                  formData.group_type === 'delegate'
                    ? 'border-[var(--color-secondary)] shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
                style={{
                  background: formData.group_type === 'delegate' 
                    ? 'var(--color-primary)'
                    : 'white'
                }}
              >
                <div className="text-5xl mb-4 transition-transform duration-300 ">📋</div>
                <div className="font-bold text-xl mb-2.5" style={{ 
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em'
                }}>
                  총대 투표
                </div>
                <div className="text-sm leading-relaxed text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                  마을별 총대 선출 투표를<br />그룹으로 관리
                </div>
                {formData.group_type === 'delegate' && (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#1e40af'
                  }}>
                    <span>✓</span>
                    <span>선택됨</span>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, group_type: 'officer' })}
                className={`group p-8 rounded-3xl border-2 transition-all duration-300 text-left transform ${
                  formData.group_type === 'officer'
                    ? 'border-[var(--color-secondary)] shadow-lg'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
                style={{
                  background: formData.group_type === 'officer' 
                    ? 'var(--color-primary)'
                    : 'white'
                }}
              >
                <div className="text-5xl mb-4 transition-transform duration-300 ">👔</div>
                <div className="font-bold text-xl mb-2.5" style={{ 
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em'
                }}>
                  임원 투표
                </div>
                <div className="text-sm leading-relaxed text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                  직책별 임원 선출 투표를<br />그룹으로 관리
                </div>
                {formData.group_type === 'officer' && (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#1e40af'
                  }}>
                    <span>✓</span>
                    <span>선택됨</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* 그룹 제목 */}
          <div className="mb-10">
            <label htmlFor="title" className="block text-base font-semibold mb-3" style={{ 
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              그룹 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 2025년 상반기 총대 투표"
              className="input-apple text-lg"
              required
              style={{ padding: '16px 20px' }}
            />
            <p className="text-xs text-gray-500 mt-2.5" style={{ letterSpacing: '-0.01em' }}>
              💡 그룹 전체를 대표하는 명확한 제목을 입력하세요
            </p>
          </div>

          {/* 그룹 설명 */}
          <div className="mb-12">
            <label htmlFor="description" className="block text-base font-semibold mb-3" style={{ 
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              그룹 설명 <span className="text-gray-400 text-sm font-normal ml-1">(선택사항)</span>
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="이 그룹에 대한 간단한 설명을 입력하세요"
              className="input-apple resize-none text-base leading-relaxed"
              rows={5}
              style={{ padding: '16px 20px' }}
            />
          </div>

          {/* 다음 단계 안내 */}
          <div className="rounded-2xl p-6 mb-10" style={{ 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div className="flex gap-4">
              <div className="text-3xl">🔔</div>
              <div className="flex-1">
                <h4 className="font-semibold text-base mb-2" style={{ 
                  color: '#065f46',
                  letterSpacing: '-0.01em'
                }}>
                  그룹 생성 후 다음 작업
                </h4>
                <p className="text-sm leading-relaxed" style={{ 
                  color: '#047857',
                  letterSpacing: '-0.01em'
                }}>
                  그룹을 생성한 후, <strong>일괄 투표 생성 기능</strong>을 사용하여 
                  {formData.group_type === 'delegate' 
                    ? ' 마을별 총대 투표를 자동으로 생성할 수 있습니다.' 
                    : ' 직책별 임원 투표를 자동으로 생성할 수 있습니다.'}
                </p>
              </div>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="sm:w-36 px-8 py-4 rounded-2xl font-semibold text-center transition-all duration-200"
              style={{ 
                background: 'rgba(0, 0, 0, 0.05)',
                color: 'var(--ink)',
                letterSpacing: '-0.01em'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: submitting 
                  ? 'rgba(0, 0, 0, 0.4)'
                  : 'var(--color-secondary)',
                color: 'white',
                letterSpacing: '-0.01em',
                boxShadow: submitting ? 'none' : '0 4px 12px rgba(0, 102, 204, 0.25)'
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>생성 중...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>✓</span>
                  <span>그룹 생성</span>
                </span>
              )}
            </button>
          </div>
        </form>

        {/* 하단 모바일 네비게이션 */}
        <div className="sm:hidden mt-6">
          <button 
            onClick={() => router.back()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold transition-all duration-200"
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
      </main>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        message={alertModal.message}
        title={alertModal.title}
      />
    </div>
  );
}
