'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';
import AlertModal from '@/components/AlertModal';

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
  
  // 필터링 및 정렬 상태
  const [filterType, setFilterType] = useState<'all' | 'delegate' | 'officer'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // 모달 상태
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string }>({ 
    isOpen: false, message: '', title: '알림' 
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

  const loadGroups = useCallback(async () => {
    const supabase = createClient();

    // 모든 그룹 조회
    const { data: groupsData, error: groupsError } = await supabase
      .from('election_groups')
      .select('id, title, description, group_type, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('그룹 로딩 오류:', groupsError);
      return;
    }

    if (!groupsData || groupsData.length === 0) {
      setGroups([]);
      return;
    }

    // 모든 그룹의 elections를 한 번에 조회 (N+1 문제 해결)
    const groupIds = groupsData.map(g => g.id);
    const { data: allElections, error: electionsError } = await supabase
      .from('elections')
      .select('id, status, group_id')
      .in('group_id', groupIds);

    if (electionsError) {
      console.error('투표 조회 오류:', electionsError);
      setGroups(groupsData.map(g => ({ ...g, election_count: 0, active_elections: 0 })));
      return;
    }

    // 그룹별로 통계 계산
    const groupsWithCounts = groupsData.map((group) => {
      const groupElections = allElections?.filter(e => e.group_id === group.id) || [];
      return {
        ...group,
        election_count: groupElections.length,
        active_elections: groupElections.filter(e => e.status === 'active').length,
      };
    });

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
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' 
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

  // 필터링
  let filteredGroups = groups;
  
  if (filterType !== 'all') {
    filteredGroups = filteredGroups.filter(g => g.group_type === filterType);
  }
  
  // 정렬
  filteredGroups = [...filteredGroups].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title, 'ko');
        break;
      case 'type':
        comparison = a.group_type.localeCompare(b.group_type);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // 페이징
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);
  
  // 정렬 변경 핸들러
  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

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
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                style={{
                  background: 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '-0.01em',
                  boxShadow: 'var(--shadow-secondary)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>새 그룹 만들기</span>
              </Link>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                style={{ 
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: '#1d1d1f',
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 필터 및 정렬 */}
        <div className="card-apple p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* 투표 유형 필터 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">유형:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setFilterType('all'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === 'all' 
                      ? 'bg-[var(--color-secondary)] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => { setFilterType('delegate'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === 'delegate' 
                      ? 'bg-[var(--color-secondary)] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📋 총대
                </button>
                <button
                  onClick={() => { setFilterType('officer'); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterType === 'officer' 
                      ? 'bg-[var(--color-secondary)] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  👔 임원
                </button>
              </div>
            </div>

            {/* 검색 결과 표시 */}
            <div className="ml-auto text-sm text-gray-600">
              총 <span className="font-semibold text-[var(--color-secondary)]">{filteredGroups.length}</span>개 그룹
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="card-apple overflow-hidden">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">
                {filterType === 'delegate' ? '📋' : filterType === 'officer' ? '👔' : '📁'}
              </div>
              <p className="text-gray-600 mb-6">
                {filterType === 'all'
                  ? '투표 그룹이 없습니다.' 
                  : '조건에 맞는 그룹이 없습니다.'}
              </p>
              <Link 
                href="/admin/election-groups/create"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 hover:scale-105"
                style={{
                  background: 'var(--color-secondary)',
                  color: 'white',
                  letterSpacing: '-0.01em',
                  boxShadow: 'var(--shadow-secondary)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>새 그룹 만들기</span>
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th 
                        className="text-left py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-2">
                          유형
                          {sortBy === 'type' && (
                            <span className="text-[var(--color-secondary)]">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-left py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('title')}
                      >
                        <div className="flex items-center gap-2">
                          제목
                          {sortBy === 'title' && (
                            <span className="text-[var(--color-secondary)]">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">
                        설명
                      </th>
                      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">
                        투표 수
                      </th>
                      <th 
                        className="text-center py-4 px-6 text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center justify-center gap-2">
                          생성일
                          {sortBy === 'date' && (
                            <span className="text-[var(--color-secondary)]">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedGroups.map((group) => (
                      <tr 
                        key={group.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/election-groups/${group.id}`)}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              {group.group_type === 'delegate' ? '📋' : '👔'}
                            </span>
                            <span className="text-sm font-medium text-gray-700">
                              {group.group_type === 'delegate' ? '총대' : '임원'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-gray-900" style={{ letterSpacing: '-0.01em' }}>
                            {group.title}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm text-gray-600 max-w-md truncate">
                            {group.description || '-'}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">
                              <span className="font-semibold text-[var(--color-secondary)]">
                                {group.election_count}
                              </span>
                              <span className="text-gray-600 text-xs ml-1">개</span>
                            </div>
                            {group.active_elections! > 0 && (
                              <div className="text-xs text-green-600">
                                ({group.active_elections}개 진행중)
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center text-sm text-gray-600">
                          {new Date(group.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <Link
                            href={`/admin/election-groups/${group.id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            관리 →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 페이징 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-6 border-t border-gray-200">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: currentPage === 1 ? '#f3f4f6' : 'white',
                      border: '1px solid #e5e7eb',
                      color: '#374151'
                    }}
                  >
                    ← 이전
                  </button>

                  <div className="flex gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // 현재 페이지 주변만 표시
                        return page === 1 || page === totalPages || 
                               (page >= currentPage - 2 && page <= currentPage + 2);
                      })
                      .map((page, index, arr) => {
                        // ... 표시
                        if (index > 0 && page - arr[index - 1] > 1) {
                          return (
                            <span key={`ellipsis-${page}`} className="px-2 py-2 text-gray-400">
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: currentPage === page ? 'var(--color-secondary)' : 'white',
                              border: currentPage === page ? 'none' : '1px solid #e5e7eb',
                              color: currentPage === page ? 'white' : '#374151'
                            }}
                          >
                            {page}
                          </button>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: currentPage === totalPages ? '#f3f4f6' : 'white',
                      border: '1px solid #e5e7eb',
                      color: '#374151'
                    }}
                  >
                    다음 →
                  </button>
                </div>
              )}
            </>
          )}
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
