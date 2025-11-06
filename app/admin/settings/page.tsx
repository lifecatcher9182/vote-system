'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import MainVoteQRCode from '@/components/MainVoteQRCode';
import LogoUploadSettings from '@/components/LogoUploadSettings';
import ColorThemeSettings from '@/components/ColorThemeSettings';

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
            <h1 className="text-3xl font-bold text-gray-900">⚙️ 시스템 설정</h1>
            <Link 
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-800 px-4 py-2"
            >
              🏠 대시보드
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 왼쪽 섹션 - 시스템 설정 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 로고 업로드 */}
              <LogoUploadSettings />

              {/* 색상 테마 설정 */}
              <ColorThemeSettings />

              {/* 시스템 이름 설정 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">시스템 설정</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시스템 이름
                    </label>
                    <input
                      type="text"
                      value={systemName}
                      onChange={(e) => setSystemName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="청년국 투표 시스템"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      투표 페이지 상단에 표시되는 시스템 이름입니다.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveSystemName}
                    disabled={saving}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? '저장 중...' : '💾 저장'}
                  </button>
                </div>
              </div>

              {/* 관리자 이메일 목록 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">
                  관리자 목록 ({adminEmails.length}명)
                </h2>

                {/* 관리자 추가 폼 */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    새 관리자 추가
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddAdmin();
                        }
                      }}
                    />
                    <button
                      onClick={handleAddAdmin}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                    >
                      추가
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    💡 추가된 이메일로 로그인하면 관리자 권한을 사용할 수 있습니다.
                  </p>
                </div>

                {/* 관리자 목록 */}
                {adminEmails.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    등록된 관리자가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {adminEmails.map((admin) => (
                      <div 
                        key={admin.id}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          admin.email === currentUserEmail
                            ? 'bg-green-50 border-2 border-green-200'
                            : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {admin.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{admin.email}</span>
                              {admin.email === currentUserEmail && (
                                <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                                  본인
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              등록일: {new Date(admin.created_at).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                          disabled={admin.email === currentUserEmail}
                          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ 주의사항</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>본인 계정은 삭제할 수 없습니다</li>
                    <li>최소 한 명의 관리자가 필요합니다</li>
                    <li>삭제된 관리자는 즉시 접근 권한을 잃습니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 오른쪽 섹션 - QR 코드 및 추가 설정 */}
            <div className="space-y-6">
              {/* QR 코드 다운로드 */}
              <MainVoteQRCode />

              {/* 시스템 정보 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  📊 시스템 정보
                </h2>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">현재 사용자</span>
                    <span className="font-medium">{currentUserEmail}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">등록된 관리자</span>
                    <span className="font-medium">{adminEmails.length}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">시스템 버전</span>
                    <span className="font-medium">v1.0.0</span>
                  </div>
                </div>
              </div>

              {/* 도움말 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  💡 도움말
                </h2>
                
                <div className="space-y-3 text-sm text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">관리자 추가</p>
                    <p>이메일 주소를 입력하여 새 관리자를 추가할 수 있습니다.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">QR 코드</p>
                    <p>메인 투표 페이지 QR 코드를 다운로드하여 주보나 포스터에 사용하세요.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">시스템 이름</p>
                    <p>투표자 페이지 상단에 표시될 시스템 이름을 설정하세요.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
