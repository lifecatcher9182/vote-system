'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signOut, checkAdminAccess } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';

interface Stats {
  totalElections: number;
  totalCodes: number;
  totalVillages: number;
  activeElections: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalElections: 0,
    totalCodes: 0,
    totalVillages: 0,
    activeElections: 0,
  });

  const checkAuth = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin');
      return;
    }

    // 관리자 권한 확인
    const { isAdmin } = await checkAdminAccess(user.email!);
    if (!isAdmin) {
      alert('관리자 권한이 없습니다.');
      await signOut();
      router.push('/admin');
      return;
    }

    setUser(user);
    setLoading(false);
  }, [router]);

  const loadStats = useCallback(async () => {
    const supabase = createClient();

    // 투표 수
    const { count: electionsCount } = await supabase
      .from('elections')
      .select('*', { count: 'exact', head: true });

    // 활성 투표 수
    const { count: activeCount } = await supabase
      .from('elections')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'registering']);

    // 참여코드 수
    const { count: codesCount } = await supabase
      .from('voter_codes')
      .select('*', { count: 'exact', head: true });

    // 마을 수
    const { count: villagesCount } = await supabase
      .from('villages')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalElections: electionsCount || 0,
      totalCodes: codesCount || 0,
      totalVillages: villagesCount || 0,
      activeElections: activeCount || 0,
    });
  }, []);

  useEffect(() => {
    const initializeDashboard = async () => {
      await checkAuth();
      await loadStats();
    };
    
    initializeDashboard();
  }, [checkAuth, loadStats]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/admin');
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            관리자 대시보드
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* 통계 카드 */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        전체 투표
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalElections}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        활성 투표
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.activeElections}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        참여코드
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalCodes}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        마을
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900">
                        {stats.totalVillages}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 빠른 액션 */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">빠른 작업</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button 
                onClick={() => router.push('/admin/elections')}
                className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--color-secondary)] transition-colors text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  📋 투표 목록
                </h3>
                <p className="text-sm text-gray-600">
                  생성된 모든 투표를 확인하고 관리합니다
                </p>
              </button>

              <button 
                onClick={() => router.push('/admin/elections/create')}
                className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--color-secondary)] transition-colors text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  + 새 투표 생성
                </h3>
                <p className="text-sm text-gray-600">
                  총대 또는 임원 선출 투표를 생성합니다
                </p>
              </button>

              <button 
                onClick={() => router.push('/admin/codes')}
                className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--color-secondary)] transition-colors text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  + 참여코드 생성
                </h3>
                <p className="text-sm text-gray-600">
                  투표자를 위한 참여코드를 일괄 생성합니다
                </p>
              </button>

              <button 
                onClick={() => router.push('/admin/villages')}
                className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--color-secondary)] transition-colors text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🏘️ 마을 관리
                </h3>
                <p className="text-sm text-gray-600">
                  총대 선출을 위한 마을 정보를 관리합니다
                </p>
              </button>

              <button 
                onClick={() => router.push('/admin/results')}
                className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--color-secondary)] transition-colors text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  📊 결과 보기
                </h3>
                <p className="text-sm text-gray-600">
                  완료된 투표의 결과를 확인합니다
                </p>
              </button>

              <button 
                onClick={() => router.push('/admin/settings')}
                className="p-6 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[var(--color-secondary)] transition-colors text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ⚙️ 시스템 설정
                </h3>
                <p className="text-sm text-gray-600">
                  관리자 및 시스템 설정을 관리합니다
                </p>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
