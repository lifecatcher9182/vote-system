'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import MainVoteQRCode from '@/components/MainVoteQRCode';
import LogoUploadSettings from '@/components/LogoUploadSettings';
import ColorThemeSettings from '@/components/ColorThemeSettings';
import SystemLogo from '@/components/SystemLogo';

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
  const [saving, setSaving] = useState(false);

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

    setCurrentUserEmail(user.email!);
    setLoading(false);
  }, [router]);

  const loadAdminEmails = useCallback(async () => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('admin_emails')
      .select('*')
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
      .select('system_name')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('시스템 설정 로딩 오류:', error);
      return;
    }

    if (data && data.system_name) {
      setSystemName(data.system_name);
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
      alert('이메일을 입력하세요.');
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      alert('올바른 이메일 형식이 아닙니다.');
      return;
    }

    // 중복 확인
    if (adminEmails.some(admin => admin.email === newEmail.trim())) {
      alert('이미 등록된 관리자입니다.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('admin_emails')
      .insert([{ email: newEmail.trim() }]);

    if (error) {
      console.error('관리자 추가 오류:', error);
      alert('관리자 추가에 실패했습니다.');
      return;
    }

    setNewEmail('');
    loadAdminEmails();
  };

  const handleDeleteAdmin = async (id: string, email: string) => {
    // 본인은 삭제 불가
    if (email === currentUserEmail) {
      alert('본인 계정은 삭제할 수 없습니다.');
      return;
    }

    // 마지막 관리자 삭제 방지
    if (adminEmails.length <= 1) {
      alert('최소 한 명의 관리자가 필요합니다.');
      return;
    }

    if (!confirm(`정말 ${email}을(를) 관리자에서 제거하시겠습니까?`)) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('admin_emails')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('관리자 삭제 오류:', error);
      alert('관리자 삭제에 실패했습니다.');
      return;
    }

    loadAdminEmails();
  };

  const handleSaveSystemName = async () => {
    if (!systemName.trim()) {
      alert('시스템 이름을 입력하세요.');
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
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      error = result.error;
    } else {
      // 새로 생성
      const result = await supabase
        .from('system_config')
        .insert([{
          system_name: systemName.trim()
        }]);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('시스템 이름 저장 오류:', error);
      alert('시스템 이름 저장에 실패했습니다.');
      return;
    }

    alert('시스템 이름이 저장되었습니다.');
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
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>설정을 불러오는 중...</p>
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

      {/* Header - Glass Effect */}
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
                시스템 설정
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                관리자 및 시스템 환경을 설정합니다
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽 섹션 - 시스템 설정 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 로고 업로드 */}
            <LogoUploadSettings />

            {/* 색상 테마 설정 */}
            <ColorThemeSettings />

            {/* 시스템 이름 설정 */}
            <div className="card-apple p-8">
              <h2 className="text-2xl font-semibold mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                시스템 이름
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-3" style={{ letterSpacing: '-0.01em' }}>
                    시스템 표시 이름
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

                <button
                  onClick={handleSaveSystemName}
                  disabled={saving}
                  className="btn-apple-primary w-full"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
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
                    className="btn-apple-primary px-8 whitespace-nowrap"
                  >
                    추가
                  </button>
                </div>
                <div className="mt-4 flex items-start gap-2">
                  <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    추가된 이메일로 로그인하면 관리자 권한을 사용할 수 있습니다
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
                        disabled={admin.email === currentUserEmail}
                        className="px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ 
                          background: admin.email === currentUserEmail ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444'
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

          {/* 오른쪽 섹션 - QR 코드 및 추가 설정 */}
          <div className="space-y-8">
            {/* QR 코드 다운로드 */}
            <MainVoteQRCode />

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
                    QR 코드
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                    메인 투표 페이지 QR 코드를 다운로드하여 주보나 포스터에 사용하세요
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-2" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    시스템 이름
                  </p>
                  <p className="text-gray-600 text-xs leading-relaxed" style={{ letterSpacing: '-0.01em' }}>
                    투표자 페이지 상단에 표시될 시스템 이름을 설정하세요
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
