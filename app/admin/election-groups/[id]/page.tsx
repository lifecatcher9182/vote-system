'use client';

import { useEffect, useState, useCallback, use } from 'react';
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
}

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  village_id: string | null;
  max_selections: number;
  status: 'waiting' | 'registering' | 'active' | 'closed';
  created_at: string;
  villages?: {
    name: string;
  };
  _count?: {
    candidates: number;
    votes: number;
  };
}

export default function ElectionGroupDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<ElectionGroup | null>(null);
  const [elections, setElections] = useState<Election[]>([]);

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

  const loadGroup = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('election_groups')
      .select('*')
      .eq('id', resolvedParams.id)
      .single();

    if (error || !data) {
      console.error('그룹 로딩 오류:', error);
      alert('그룹을 찾을 수 없습니다.');
      router.push('/admin/election-groups');
      return;
    }

    setGroup(data);
  }, [resolvedParams.id, router]);

  const loadElections = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .eq('group_id', resolvedParams.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('투표 로딩 오류:', error);
      return;
    }

    // 각 투표별 후보자 수와 투표 수 조회
    const electionsWithCounts = await Promise.all(
      (data || []).map(async (election) => {
        const { data: candidates } = await supabase
          .from('candidates')
          .select('id')
          .eq('election_id', election.id);

        const { data: votes } = await supabase
          .from('votes')
          .select('id')
          .eq('election_id', election.id);

        return {
          ...election,
          _count: {
            candidates: candidates?.length || 0,
            votes: votes?.length || 0,
          },
        };
      })
    );

    setElections(electionsWithCounts);
  }, [resolvedParams.id]);

  const handleStatusChange = async (newStatus: 'waiting' | 'active' | 'closed') => {
    if (!group) return;

    const confirmMessage = 
      newStatus === 'active' ? '이 그룹을 활성화하시겠습니까?' :
      newStatus === 'closed' ? '이 그룹을 종료하시겠습니까? (되돌릴 수 없습니다)' :
      '이 그룹을 대기 상태로 변경하시겠습니까?';

    if (!confirm(confirmMessage)) return;

    const supabase = createClient();

    const { error } = await supabase
      .from('election_groups')
      .update({ status: newStatus })
      .eq('id', group.id);

    if (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경에 실패했습니다.');
      return;
    }

    alert('상태가 변경되었습니다.');
    await loadGroup();
  };

  const handleDelete = async () => {
    if (!group) return;

    if (elections.length > 0) {
      alert('하위 투표가 있는 그룹은 삭제할 수 없습니다. 먼저 투표들을 삭제해주세요.');
      return;
    }

    if (!confirm('정말로 이 그룹을 삭제하시겠습니까?')) return;

    const supabase = createClient();

    const { error } = await supabase
      .from('election_groups')
      .delete()
      .eq('id', group.id);

    if (error) {
      console.error('그룹 삭제 오류:', error);
      alert('그룹 삭제에 실패했습니다.');
      return;
    }

    alert('그룹이 삭제되었습니다.');
    router.push('/admin/election-groups');
  };

  useEffect(() => {
    const initialize = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) return;

      await loadGroup();
      await loadElections();
      setLoading(false);
    };

    initialize();
  }, [checkAuth, loadGroup, loadElections]);

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  const totalVotes = elections.reduce((sum, e) => sum + (e._count?.votes || 0), 0);
  const activeElections = elections.filter(e => e.status === 'active').length;
  const completedElections = elections.filter(e => e.status === 'closed').length;

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
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold" style={{ 
                    color: '#1d1d1f',
                    letterSpacing: '-0.03em'
                  }}>
                    {group.title}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    group.status === 'active' ? 'bg-green-100 text-green-700' :
                    group.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {group.status === 'active' ? '진행중' :
                     group.status === 'closed' ? '종료' : '대기'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  {group.group_type === 'delegate' ? '📋 총대 투표 그룹' : '👔 임원 투표 그룹'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/election-groups"
                className="btn-apple-secondary text-sm"
              >
                ← 목록으로
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 그룹 정보 카드 */}
        <div className="card-apple p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                그룹 정보
              </h2>
              {group.description && (
                <p className="text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                  {group.description}
                </p>
              )}
              <div className="flex gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-semibold">생성일:</span>{' '}
                  {new Date(group.created_at).toLocaleDateString('ko-KR')}
                </div>
                <div>
                  <span className="font-semibold">마지막 수정:</span>{' '}
                  {new Date(group.updated_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            </div>

            {/* 상태 변경 버튼 */}
            <div className="flex gap-2">
              {group.status === 'waiting' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  className="btn-apple-primary text-sm"
                >
                  활성화
                </button>
              )}
              {group.status === 'active' && (
                <>
                  <button
                    onClick={() => handleStatusChange('waiting')}
                    className="btn-apple-secondary text-sm"
                  >
                    대기로 변경
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed')}
                    className="btn-apple-secondary text-sm"
                  >
                    종료
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                그룹 삭제
              </button>
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">총 투표 수</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-secondary)' }}>
                {elections.length}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">진행중</div>
              <div className="text-2xl font-bold text-green-600">
                {activeElections}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">완료</div>
              <div className="text-2xl font-bold text-gray-600">
                {completedElections}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">총 투표 수</div>
              <div className="text-2xl font-bold text-blue-600">
                {totalVotes}
              </div>
            </div>
          </div>
        </div>

        {/* 일괄 투표 생성 안내 */}
        {elections.length === 0 && (
          <div className="card-apple p-8 mb-6" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)',
            border: '2px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div className="flex gap-4">
              <div className="text-5xl">🚀</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-2" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  일괄 투표 생성
                </h3>
                <p className="text-gray-600 mb-4" style={{ letterSpacing: '-0.01em' }}>
                  {group.group_type === 'delegate' 
                    ? '활성화된 모든 마을에 대해 총대 투표를 자동으로 생성할 수 있습니다.'
                    : '선택한 직책들에 대해 임원 투표를 자동으로 생성할 수 있습니다.'}
                </p>
                <button className="btn-apple-primary">
                  {group.group_type === 'delegate' ? '총대 투표 일괄 생성' : '임원 투표 일괄 생성'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 하위 투표 목록 */}
        <div className="card-apple p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              하위 투표 목록 ({elections.length})
            </h2>
            <Link
              href={`/admin/elections/create?group_id=${group.id}`}
              className="btn-apple-secondary text-sm"
            >
              + 투표 추가
            </Link>
          </div>

          {elections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <p>아직 투표가 없습니다.</p>
              <p className="text-sm mt-2">일괄 생성 기능을 사용하거나 개별적으로 추가하세요.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">투표 제목</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                      {group.group_type === 'delegate' ? '마을' : '직책'}
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">선발 인원</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">후보자</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">투표 수</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">상태</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {elections.map((election) => (
                    <tr key={election.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/elections/${election.id}`}
                          className="font-medium text-gray-900 hover:text-[var(--color-secondary)]"
                        >
                          {election.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {group.group_type === 'delegate' 
                          ? election.villages?.name || '-'
                          : election.position || '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {election.max_selections}명
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {election._count?.candidates || 0}명
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-semibold text-blue-600">
                        {election._count?.votes || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          election.status === 'active' ? 'bg-green-100 text-green-700' :
                          election.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                          election.status === 'registering' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {election.status === 'active' ? '진행중' :
                           election.status === 'closed' ? '종료' :
                           election.status === 'registering' ? '등록중' : '대기'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/admin/elections/${election.id}`}
                          className="text-sm text-[var(--color-secondary)] hover:underline"
                        >
                          관리
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
