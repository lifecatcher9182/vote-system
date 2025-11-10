'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';

interface ElectionGroup {
  id: string;
  title: string;
  description: string | null;
  group_type: 'delegate' | 'officer';
  status: 'waiting' | 'active' | 'closed';
  created_at: string;
  updated_at: string;
  election_count?: number;
  active_elections?: number;
}

export default function ElectionGroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ElectionGroup[]>([]);

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

  const loadGroups = useCallback(async () => {
    const supabase = createClient();

    // 모든 그룹 조회
    const { data: groupsData, error: groupsError } = await supabase
      .from('election_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('그룹 로딩 오류:', groupsError);
      return;
    }

    // 각 그룹별 투표 개수 조회
    const groupsWithCounts = await Promise.all(
      (groupsData || []).map(async (group) => {
        const { data: elections } = await supabase
          .from('elections')
          .select('id, status')
          .eq('group_id', group.id);

        return {
          ...group,
          election_count: elections?.length || 0,
          active_elections: elections?.filter(e => e.status === 'active').length || 0,
        };
      })
    );

    setGroups(groupsWithCounts);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;

      await loadGroups();
      setLoading(false);
    };

    initialize();
  }, [checkAuth, loadGroups]);

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

  const delegateGroups = groups.filter(g => g.group_type === 'delegate');
  const officerGroups = groups.filter(g => g.group_type === 'officer');

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
                  투표 그룹 관리
                </h1>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  총대 투표와 임원 투표를 그룹으로 관리합니다
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/election-groups/create"
                className="btn-apple-primary text-sm"
              >
                + 새 그룹 만들기
              </Link>
              <Link 
                href="/admin/dashboard"
                className="btn-apple-secondary text-sm"
              >
                🏠 대시보드
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 총대 투표 그룹 */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              📋 총대 투표 그룹
            </h2>
          </div>

          {delegateGroups.length === 0 ? (
            <div className="card-apple p-12 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-600 mb-6">총대 투표 그룹이 없습니다.</p>
              <Link 
                href="/admin/election-groups/create"
                className="btn-apple-primary inline-block"
              >
                첫 그룹 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {delegateGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/admin/election-groups/${group.id}`}
                  className="card-apple p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl">📋</div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      group.status === 'active' ? 'bg-green-100 text-green-700' :
                      group.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {group.status === 'active' ? '진행중' :
                       group.status === 'closed' ? '종료' : '대기'}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold mb-2" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em'
                  }}>
                    {group.title}
                  </h3>

                  {group.description && (
                    <p className="text-sm text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                      {group.description}
                    </p>
                  )}

                  <div className="flex gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--color-secondary)' }}>
                        {group.election_count}
                      </span>
                      <span className="ml-1">개 투표</span>
                    </div>
                    {group.active_elections! > 0 && (
                      <div>
                        <span className="font-semibold text-green-600">
                          {group.active_elections}
                        </span>
                        <span className="ml-1">개 진행중</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      {new Date(group.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 임원 투표 그룹 */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              👔 임원 투표 그룹
            </h2>
          </div>

          {officerGroups.length === 0 ? (
            <div className="card-apple p-12 text-center">
              <div className="text-6xl mb-4">👔</div>
              <p className="text-gray-600 mb-6">임원 투표 그룹이 없습니다.</p>
              <Link 
                href="/admin/election-groups/create"
                className="btn-apple-primary inline-block"
              >
                첫 그룹 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {officerGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/admin/election-groups/${group.id}`}
                  className="card-apple p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl">👔</div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      group.status === 'active' ? 'bg-green-100 text-green-700' :
                      group.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {group.status === 'active' ? '진행중' :
                       group.status === 'closed' ? '종료' : '대기'}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold mb-2" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em'
                  }}>
                    {group.title}
                  </h3>

                  {group.description && (
                    <p className="text-sm text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                      {group.description}
                    </p>
                  )}

                  <div className="flex gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--color-secondary)' }}>
                        {group.election_count}
                      </span>
                      <span className="ml-1">개 투표</span>
                    </div>
                    {group.active_elections! > 0 && (
                      <div>
                        <span className="font-semibold text-green-600">
                          {group.active_elections}
                        </span>
                        <span className="ml-1">개 진행중</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      {new Date(group.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
