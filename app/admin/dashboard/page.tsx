'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { signOut, checkAdminAccess } from '@/lib/auth';
import type { User } from '@supabase/supabase-js';
import SystemLogo from '@/components/SystemLogo';
import AlertModal from '@/components/AlertModal';

interface Stats {
  totalElections: number;
  activeVillages: number;
  activeElections: number;
  totalGroups: number;
}

interface RecentActivity {
  id: string;
  type: 'group' | 'election' | 'vote';
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalElections: 0,
    activeVillages: 0,
    activeElections: 0,
    totalGroups: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [activitySort, setActivitySort] = useState<'created_at' | 'updated_at'>('updated_at'); // 최근 활동순이 기본

  // Alert modal state
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ 
    isOpen: false, 
    message: '', 
    title: '알림' 
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
      setAlertModal({
        isOpen: true,
        message: '관리자 권한이 없습니다.',
        title: '접근 권한 없음'
      });
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
      .eq('status', 'active');

    // 투표 그룹 수
    const { count: groupsCount } = await supabase
      .from('election_groups')
      .select('*', { count: 'exact', head: true });

    // 활성화된 마을 수 (is_active가 true인 마을)
    const { count: activeVillagesCount } = await supabase
      .from('villages')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    setStats({
      totalElections: electionsCount || 0,
      activeVillages: activeVillagesCount || 0,
      activeElections: activeCount || 0,
      totalGroups: groupsCount || 0,
    });

    // 최근 그룹 로드 (정렬은 클라이언트에서 처리) - 필요한 컬럼만 선택
    const { data: groups } = await supabase
      .from('election_groups')
      .select('id, title, group_type, created_at, updated_at')
      .limit(10);

    if (groups) {
      // 최근 활동 생성
      const activities: RecentActivity[] = groups.map((group: {
        id: string;
        title: string;
        group_type: 'delegate' | 'officer';
        created_at: string;
        updated_at: string;
      }) => ({
        id: group.id,
        type: 'group' as const,
        title: group.title,
        description: group.group_type === 'delegate' ? '총대 투표 그룹' : '임원 투표 그룹',
        timestamp: activitySort === 'created_at' ? group.created_at : group.updated_at,
        icon: group.group_type === 'delegate' ? '🏘️' : '👔',
        color: group.group_type === 'delegate' ? 'bg-blue-500' : 'bg-purple-500'
      }));

      // 정렬 후 상위 2개만 표시
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities.slice(0, 2));
    }
  }, [activitySort]);

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
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto mb-6"></div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>대시보드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      {/* Header - Glass Effect */}
      <header className="glass-effect border-b" style={{ 
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: 'rgba(0, 0, 0, 0.05)'
      }}>
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Logo - 대시보드 텍스트 옆으로 이동 */}
            <SystemLogo size="md" linkToHome />
            <div className="border-l pl-3" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
              <h1 className="text-2xl font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                대시보드
              </h1>
              <p className="text-xs text-gray-500 mt-0.5" style={{ letterSpacing: '-0.01em' }}>
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="px-6 py-2.5 rounded-full font-medium transition-all duration-200 hover:scale-105"
            style={{ 
              background: 'rgba(0, 0, 0, 0.04)',
              color: '#1d1d1f'
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-6">
        {/* Hero Welcome Card */}
        <div className="card-apple p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                환영합니다! 👋
              </h2>
              <p className="text-lg text-gray-600 mb-6" style={{ letterSpacing: '-0.01em' }}>
                청년국 투표 관리 시스템에서 투표 그룹과 선거를 손쉽게 관리하세요.
              </p>
              <button
                onClick={() => router.push('/admin/election-groups/create')}
                className="px-8 py-3 rounded-full font-semibold text-white transition-all duration-200 hover:scale-105 shadow-lg"
                style={{ 
                  background: 'var(--color-secondary)',
                }}
              >
                ✨ 새 투표 그룹 만들기
              </button>
            </div>
            <div className="hidden lg:block text-8xl">
              🗳️
            </div>
          </div>
        </div>

        {/* Stats Grid - Modern Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* 투표 그룹 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200 overflow-hidden relative" style={{
            background: '#ffffff',
            border: '2px solid rgba(168, 85, 247, 0.3)'
          }}>
            <div className="absolute -right-4 -top-4 text-6xl opacity-5">📦</div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                  <span className="text-2xl">📦</span>
                </div>
                <p className="text-sm font-bold" style={{ 
                  color: 'rgb(147, 51, 234)',
                  letterSpacing: '-0.01em' 
                }}>투표 그룹</p>
              </div>
              <p className="text-5xl font-bold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.totalGroups || 0}
              </p>
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>총대/임원 투표 그룹</p>
            </div>
          </div>

          {/* 전체 투표 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200 overflow-hidden relative" style={{
            background: '#ffffff',
            border: '2px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div className="absolute -right-4 -top-4 text-6xl opacity-5">📋</div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                  <span className="text-2xl">📋</span>
                </div>
                <p className="text-sm font-bold" style={{ 
                  color: 'rgb(37, 99, 235)',
                  letterSpacing: '-0.01em' 
                }}>전체 투표</p>
              </div>
              <p className="text-5xl font-bold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.totalElections}
              </p>
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>생성된 총 투표 수</p>
            </div>
          </div>

          {/* 활성 투표 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200 overflow-hidden relative" style={{
            background: '#ffffff',
            border: '2px solid rgba(34, 197, 94, 0.3)'
          }}>
            <div className="absolute -right-4 -top-4 text-6xl opacity-5">✅</div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.15)' }}>
                  <span className="text-2xl">✅</span>
                </div>
                <p className="text-sm font-bold" style={{ 
                  color: 'rgb(22, 163, 74)',
                  letterSpacing: '-0.01em' 
                }}>활성 투표</p>
              </div>
              <p className="text-5xl font-bold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.activeElections}
              </p>
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>현재 진행 중인 투표</p>
            </div>
          </div>

          {/* 활성화된 마을 */}
          <div className="card-apple p-6 group hover:scale-105 transition-transform duration-200 overflow-hidden relative" style={{
            background: '#ffffff',
            border: '2px solid rgba(249, 115, 22, 0.3)'
          }}>
            <div className="absolute -right-4 -top-4 text-6xl opacity-5">🏘️</div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.15)' }}>
                  <span className="text-2xl">🏘️</span>
                </div>
                <p className="text-sm font-bold" style={{ 
                  color: 'rgb(234, 88, 12)',
                  letterSpacing: '-0.01em' 
                }}>활성화된 마을</p>
              </div>
              <p className="text-5xl font-bold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                {stats.activeVillages}
              </p>
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>현재 활성 중인 마을</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Left Column - Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-apple p-6">
              <h2 className="text-2xl font-bold mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                🚀 빠른 작업
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => router.push('/admin/election-groups/create')}
                  className="group p-6 text-left transition-all duration-200 hover:scale-105 rounded-2xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    border: '2px solid rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm" style={{ 
                    background: 'var(--color-secondary)'
                  }}>
                    <span className="text-2xl">✨</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em'
                  }}>
                    새 투표 그룹
                  </h3>
                  <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    총대/임원 그룹 생성
                  </p>
                </button>

                <button 
                  onClick={() => router.push('/admin/election-groups')}
                  className="group p-6 text-left transition-all duration-200 hover:scale-105 rounded-2xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    border: '2px solid rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
                    <span className="text-2xl">📁</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em'
                  }}>
                    투표 그룹 관리
                  </h3>
                  <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    그룹 보기 및 편집
                  </p>
                </button>

                <button 
                  onClick={() => router.push('/admin/villages')}
                  className="group p-6 text-left transition-all duration-200 hover:scale-105 rounded-2xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    border: '2px solid rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(249, 115, 22, 0.15)' }}>
                    <span className="text-2xl">🏘️</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em'
                  }}>
                    마을 관리
                  </h3>
                  <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    총대 선출 마을 정보
                  </p>
                </button>

                <button 
                  onClick={() => router.push('/admin/settings')}
                  className="group p-6 text-left transition-all duration-200 hover:scale-105 rounded-2xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    border: '2px solid rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(100, 116, 139, 0.15)' }}>
                    <span className="text-2xl">⚙️</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em'
                  }}>
                    시스템 설정
                  </h3>
                  <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                    관리자 및 환경설정
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="flex flex-col h-full">
            <div className="card-apple p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  📊 최근 활동
                </h2>
                
                {/* 정렬 토글 */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setActivitySort('updated_at')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activitySort === 'updated_at' ? 'text-white' : 'text-gray-600'
                    }`}
                    style={{ 
                      background: activitySort === 'updated_at' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)'
                    }}
                    title="최근 수정된 순서"
                  >
                    🕒
                  </button>
                  <button
                    onClick={() => setActivitySort('created_at')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activitySort === 'created_at' ? 'text-white' : 'text-gray-600'
                    }`}
                    style={{ 
                      background: activitySort === 'created_at' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.04)'
                    }}
                    title="생성된 순서"
                  >
                    📅
                  </button>
                </div>
              </div>
              
              {recentActivities.length > 0 ? (
                <div className="space-y-3 flex-1">
                  {recentActivities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => router.push(`/admin/election-groups/${activity.id}`)}
                      className="w-full p-3.5 rounded-xl text-left transition-all duration-200 hover:scale-105"
                      style={{
                        background: 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${activity.color}`}>
                          {activity.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-0.5 truncate" style={{ color: '#1d1d1f' }}>
                            {activity.title}
                          </h3>
                          <p className="text-xs text-gray-500 mb-0.5">
                            {activity.description}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(activity.timestamp).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 flex-1 flex flex-col items-center justify-center">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm text-gray-500">
                    아직 활동이 없습니다
                  </p>
                </div>
              )}

              {/* Quick Info - 같은 카드 안에 */}
              <div className="mt-5 pt-5 border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}>
                <h2 className="text-lg font-bold mb-3" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  💡 빠른 정보
                </h2>
                
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                    <span className="text-sm text-gray-600">활성화율</span>
                    <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>
                      {stats.totalElections > 0 
                        ? Math.round((stats.activeElections / stats.totalElections) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                    <span className="text-sm text-gray-600">그룹당 평균 투표</span>
                    <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>
                      {stats.totalGroups > 0 
                        ? (stats.totalElections / stats.totalGroups).toFixed(1)
                        : 0}개
                    </span>
                  </div>
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
    </div>
  );
}
