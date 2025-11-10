'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signOut, checkAdminAccess } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import SystemLogo from '@/components/SystemLogo';

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <svg className="animate-spin h-16 w-16" style={{ color: 'var(--color-secondary)' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>대시보드를 불러오는 중...</p>
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
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold mb-1" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.03em'
            }}>
              대시보드
            </h1>
            <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-6 py-2.5 rounded-full font-medium transition-all duration-200"
            style={{ 
              background: 'rgba(0, 0, 0, 0.04)',
              color: '#1d1d1f'
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* Stats Grid - Apple Card Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* 전체 투표 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1" style={{ letterSpacing: '-0.01em' }}>전체 투표</p>
              <p className="text-4xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.totalElections}
              </p>
            </div>
          </div>

          {/* 활성 투표 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1" style={{ letterSpacing: '-0.01em' }}>활성 투표</p>
              <p className="text-4xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.activeElections}
              </p>
            </div>
          </div>

          {/* 참여코드 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1" style={{ letterSpacing: '-0.01em' }}>참여코드</p>
              <p className="text-4xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.totalCodes}
              </p>
            </div>
          </div>

          {/* 마을 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.1)' }}>
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1" style={{ letterSpacing: '-0.01em' }}>마을</p>
              <p className="text-4xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.totalVillages}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6" style={{ 
            color: '#1d1d1f',
            letterSpacing: '-0.02em'
          }}>
            빠른 작업
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button 
              onClick={() => router.push('/admin/elections')}
              className="group card-apple p-8 text-left transition-all duration-200 hover:scale-105"
            >
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                투표 목록
              </h3>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                생성된 모든 투표를 확인하고 관리합니다
              </p>
            </button>

            <button 
              onClick={() => router.push('/admin/election-groups/create')}
              className="group card-apple p-8 text-left transition-all duration-200 hover:scale-105"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--color-secondary)' }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                새 투표 그룹 생성
              </h3>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                총대 또는 임원 투표 그룹을 생성하고 일괄 관리합니다
              </p>
            </button>

            <button 
              onClick={() => router.push('/admin/election-groups')}
              className="group card-apple p-8 text-left transition-all duration-200 hover:scale-105"
            >
              <div className="text-4xl mb-4">📁</div>
              <h3 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                투표 그룹
              </h3>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                총대/임원 투표 그룹을 관리합니다
              </p>
            </button>

            <button 
              onClick={() => router.push('/admin/villages')}
              className="group card-apple p-8 text-left transition-all duration-200 hover:scale-105"
            >
              <div className="text-4xl mb-4">🏘️</div>
              <h3 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                마을 관리
              </h3>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                총대 선출을 위한 마을 정보를 관리합니다
              </p>
            </button>

            <button 
              onClick={() => router.push('/admin/results')}
              className="group card-apple p-8 text-left transition-all duration-200 hover:scale-105"
            >
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                결과 보기
              </h3>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                완료된 투표의 결과를 확인합니다
              </p>
            </button>

            <button 
              onClick={() => router.push('/admin/settings')}
              className="group card-apple p-8 text-left transition-all duration-200 hover:scale-105"
            >
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                시스템 설정
              </h3>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                관리자 및 시스템 설정을 관리합니다
              </p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
