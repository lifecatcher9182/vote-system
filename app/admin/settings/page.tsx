'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import LogoUploadSettings from '@/components/LogoUploadSettings';
import FaviconUploadSettings from '@/components/FaviconUploadSettings';
import ColorThemeSettings from '@/components/ColorThemeSettings';
import SystemLogo from '@/components/SystemLogo';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface AdminEmail {
  id: string;
  email: string;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [adminEmails, setAdminEmails] = useState<AdminEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [systemName, setSystemName] = useState('청년국 투표 시스템');
  const [systemDescription, setSystemDescription] = useState('투명하고 안전한 온라인 투표 시스템');
  const [saving, setSaving] = useState(false);

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

    setCurrentUserEmail(user.email!);
    setLoading(false);
  }, [router]);

  const loadAdminEmails = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('admin_emails')
      .select('id, email, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('관리자 목록 로딩 오류:', error);
      return;
    }

    setAdminEmails(data || []);
  }, []);

  const loadSystemConfig = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('system_config')
      .select('system_name, system_description')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('시스템 설정 로딩 오류:', error);
      return;
    }

    if (data) {
      if (data.system_name) {
        setSystemName(data.system_name);
      }
      if (data.system_description) {
        setSystemDescription(data.system_description);
      }
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      await loadAdminEmails();
      await loadSystemConfig();
    };

    initialize();
  }, [checkAuth, loadAdminEmails, loadSystemConfig]);

  const handleAddAdmin = async () => {
    if (!newEmail.trim()) {
      setAlertModal({
        isOpen: true,
        message: '이메일을 입력하세요.',
        title: '입력 오류'
      });
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setAlertModal({
        isOpen: true,
        message: '올바른 이메일 형식이 아닙니다.',
        title: '입력 오류'
      });
      return;
    }

    // 중복 확인
    if (adminEmails.some(admin => admin.email === newEmail.trim())) {
      setAlertModal({
        isOpen: true,
        message: '이미 등록된 관리자입니다.',
        title: '등록 불가'
      });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('admin_emails')
      .insert([{ email: newEmail.trim() }])
      .select();

    if (error) {
      console.error('관리자 추가 오류:', error);
      setAlertModal({
        isOpen: true,
        message: `관리자 추가에 실패했습니다.\n오류: ${error.message}`,
        title: '오류'
      });
      return;
    }

    setAlertModal({
      isOpen: true,
      message: `${newEmail.trim()}이(가) 관리자로 추가되었습니다.\n해당 이메일로 Google 로그인하면 관리자 페이지에 접근할 수 있습니다.`,
      title: '추가 완료'
    });
    setNewEmail('');
    loadAdminEmails();
  };

  const handleDeleteAdmin = async (id: string, email: string) => {
    // 시스템 관리자 보호
    if (email === 'lifecatcher9182@gmail.com') {
      setAlertModal({
        isOpen: true,
        message: '시스템 관리자 계정은 삭제할 수 없습니다.',
        title: '삭제 불가'
      });
      return;
    }

    // 본인은 삭제 불가
    if (email === currentUserEmail) {
      setAlertModal({
        isOpen: true,
        message: '본인 계정은 삭제할 수 없습니다.',
        title: '삭제 불가'
      });
      return;
    }

    // 마지막 관리자 삭제 방지
    if (adminEmails.length <= 1) {
      setAlertModal({
        isOpen: true,
        message: '최소 한 명의 관리자가 필요합니다.',
        title: '삭제 불가'
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      message: `정말 ${email}을(를) 관리자에서 제거하시겠습니까?`,
      title: '관리자 제거',
      variant: 'danger',
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase
          .from('admin_emails')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('관리자 삭제 오류:', error);
          setAlertModal({
            isOpen: true,
            message: '관리자 삭제에 실패했습니다.',
            title: '오류'
          });
          return;
        }

        loadAdminEmails();
      }
    });
  };

  const handleSaveSystemName = async () => {
    if (!systemName.trim()) {
      setAlertModal({
        isOpen: true,
        message: '시스템 이름을 입력하세요.',
        title: '입력 오류'
      });
      return;
    }

    if (!systemDescription.trim()) {
      setAlertModal({
        isOpen: true,
        message: '시스템 설명을 입력하세요.',
        title: '입력 오류'
      });
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // 첫 번째 row를 가져오거나 생성
    const { data: existing } = await supabase
      .from('system_config')
      .select('id')
      .limit(1)
      .single();

    let error;
    if (existing) {
      // 업데이트
      const result = await supabase
        .from('system_config')
        .update({ 
          system_name: systemName.trim(),
          system_description: systemDescription.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      error = result.error;
    } else {
      // 새로 생성
      const result = await supabase
        .from('system_config')
        .insert([{
          system_name: systemName.trim(),
          system_description: systemDescription.trim()
        }]);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('시스템 설정 저장 오류:', error);
      setAlertModal({
        isOpen: true,
        message: '시스템 설정 저장에 실패했습니다.',
        title: '오류'
      });
      return;
    }

    setAlertModal({
      isOpen: true,
      message: '시스템 설정이 저장되었습니다.',
      title: '저장 완료'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin mx-auto mb-6" style={{ borderTopColor: 'var(--color-secondary)' }} />
          <p className="text-lg font-medium text-gray-600 mt-6" style={{ letterSpacing: '-0.01em' }}>설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      {/* Header - Glass Effect */}
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
                  시스템 설정
                </h1>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  관리자 및 시스템 환경을 설정합니다
                </p>
              </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽 섹션 - 시스템 설정 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 로고 업로드 */}
            <LogoUploadSettings />

            {/* Favicon 설정 */}
            <FaviconUploadSettings />

            {/* 색상 테마 설정 */}
            <ColorThemeSettings />

            {/* 시스템 이름 설정 */}
            <div className="card-apple p-8">
              <h2 className="text-2xl font-semibold mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                시스템 정보
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
                    시스템 이름
                  </label>
                  <input
                    type="text"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    className="input-apple"
                    placeholder="청년국 투표 시스템"
                  />
                  <p className="mt-2 text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    투표 페이지 상단에 표시되는 시스템 이름입니다
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
                    시스템 설명
                  </label>
                  <input
                    type="text"
                    value={systemDescription}
                    onChange={(e) => setSystemDescription(e.target.value)}
                    className="input-apple"
                    placeholder="투명하고 안전한 온라인 투표 시스템"
                  />
                  <p className="mt-2 text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    시스템 이름 하단에 표시되는 짧은 설명입니다
                  </p>
                </div>

                <button
                  onClick={handleSaveSystemName}
                  disabled={saving}
                  className="w-full px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: 'var(--color-secondary)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      저장 중
                    </span>
                  ) : '저장'}
                </button>
              </div>
            </div>

            {/* 관리자 이메일 목록 */}
            <div className="card-apple p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  관리자 목록
                </h2>
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ 
                  background: 'rgba(0, 113, 227, 0.1)',
                  color: 'var(--color-secondary)'
                }}>
                  {adminEmails.length}명
                </span>
              </div>

              {/* 관리자 추가 폼 */}
              <div className="mb-8 p-6 rounded-2xl" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
                  새 관리자 추가
                </label>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="input-apple flex-1"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddAdmin();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddAdmin}
                    className="px-8 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105 whitespace-nowrap"
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
                <div className="mt-4 flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    추가된 이메일로 Google 로그인하면 관리자 권한을 사용할 수 있습니다
                  </p>
                </div>
              </div>

              {/* 관리자 목록 */}
              {adminEmails.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500" style={{ letterSpacing: '-0.01em' }}>등록된 관리자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminEmails.map((admin) => (
                    <div 
                      key={admin.id}
                      className="flex items-center justify-between p-5 rounded-2xl transition-all duration-200"
                      style={{ 
                        background: admin.email === currentUserEmail 
                          ? 'rgba(0, 113, 227, 0.05)' 
                          : 'rgba(0, 0, 0, 0.02)',
                        border: admin.email === currentUserEmail 
                          ? '2px solid rgba(0, 113, 227, 0.2)' 
                          : '2px solid transparent'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg" style={{ background: 'var(--color-secondary)' }}>
                          {admin.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                              {admin.email}
                            </span>
                            {admin.email === currentUserEmail && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: 'var(--color-secondary)' }}>
                                본인
                              </span>
                            )}
                            {admin.email === 'lifecatcher9182@gmail.com' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: 'rgb(34, 197, 94)' }}>
                                시스템 관리자
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            등록일: {new Date(admin.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                        disabled={admin.email === currentUserEmail || admin.email === 'lifecatcher9182@gmail.com'}
                        className="px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{ 
                          background: (admin.email === currentUserEmail || admin.email === 'lifecatcher9182@gmail.com') ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          letterSpacing: '-0.01em'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 p-5 rounded-2xl" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                    <svg className="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 mb-2">주의사항</p>
                    <ul className="space-y-1.5 text-xs text-amber-800" style={{ letterSpacing: '-0.01em' }}>
                      <li className="flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>본인 계정은 삭제할 수 없습니다</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>시스템 관리자 계정(lifecatcher9182@gmail.com)은 보호됩니다</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>최소 한 명의 관리자가 필요합니다</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1">•</span>
                        <span>삭제된 관리자는 즉시 접근 권한을 잃습니다</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽 섹션 - 시스템 정보 */}
          <div className="space-y-8">
            {/* 시스템 정보 */}
            <div className="card-apple p-6">
              <h2 className="text-lg font-semibold mb-5" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                시스템 정보
              </h2>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                  <span className="text-gray-600">현재 사용자</span>
                  <span className="font-medium" style={{ color: '#1d1d1f' }}>{currentUserEmail}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                  <span className="text-gray-600">등록된 관리자</span>
                  <span className="font-medium" style={{ color: '#1d1d1f' }}>{adminEmails.length}명</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">시스템 버전</span>
                  <span className="font-medium" style={{ color: '#1d1d1f' }}>v1.0.0</span>
                </div>
              </div>
            </div>

            {/* 도움말 */}
            <div className="card-apple p-6">
              <h2 className="text-lg font-semibold mb-5" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                도움말
              </h2>
              
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold mb-2" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    관리자 추가
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                    이메일 주소를 입력하여 새 관리자를 추가할 수 있습니다
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    시스템 정보
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                    투표자 페이지에 표시될 시스템 이름과 설명을 설정하세요
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    투표 QR 코드
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                    각 투표의 QR 코드는 투표 모니터 페이지에서 다운로드할 수 있습니다
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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
