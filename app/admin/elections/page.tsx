'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';

interface Election {
  id: string;
  title: string;
  election_type: 'delegate' | 'officer';
  position: string | null;
  village_id: string | null;
  max_selections: number;
  round: number;
  status: 'waiting' | 'registering' | 'active' | 'closed';
  created_at: string;
  villages?: {
    name: string;
  };
}

export default function ElectionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [elections, setElections] = useState<Election[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

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

    setLoading(false);
  }, [router]);

  const loadElections = useCallback(async () => {
    const supabase = createClient();
    
    let query = supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query = query.in('status', ['registering', 'active']);
    } else if (filter === 'closed') {
      query = query.eq('status', 'closed');
    }

    const { data, error } = await query;

    if (error) {
      console.error('투표 로딩 오류:', error);
      return;
    }

    setElections(data || []);
  }, [filter]);

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      await loadElections();
    };
    
    initialize();
  }, [checkAuth, loadElections]);

  const handleDeleteElection = async (id: string) => {
    if (!confirm('정말 이 투표를 삭제하시겠습니까? 관련된 모든 데이터가 삭제됩니다.')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('elections')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('투표 삭제 오류:', error);
      alert('투표 삭제에 실패했습니다.');
      return;
    }

    loadElections();
  };

  const getStatusBadge = (status: Election['status']) => {
    const badges = {
      waiting: { text: '대기', color: 'bg-gray-100 text-gray-800' },
      registering: { text: '등록중', color: 'bg-blue-100 text-blue-800' },
      active: { text: '진행중', color: 'bg-green-100 text-green-800' },
      closed: { text: '종료', color: 'bg-red-100 text-red-800' },
    };

    const badge = badges[status];
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const getTypeText = (type: Election['election_type']) => {
    return type === 'delegate' ? '총대 선출' : '임원 선출';
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
            <h1 className="text-3xl font-bold text-gray-900">투표 관리</h1>
            <Link 
              href="/admin/dashboard"
              className="text-blue-600 hover:text-blue-800"
            >
              ← 대시보드로
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 상단 액션 바 */}
          <div className="mb-6 flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                진행중
              </button>
              <button
                onClick={() => setFilter('closed')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'closed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                종료
              </button>
            </div>

            <Link
              href="/admin/elections/create"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              + 새 투표 생성
            </Link>
          </div>

          {elections.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">투표가 없습니다</h3>
              <p className="mt-1 text-gray-500">새로운 투표를 생성하세요.</p>
              <div className="mt-6">
                <Link
                  href="/admin/elections/create"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + 투표 생성
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      투표 제목
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      유형
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      대상
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      라운드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {elections.map((election) => (
                    <tr key={election.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {election.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getTypeText(election.election_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {election.election_type === 'delegate' 
                          ? election.villages?.name || '-'
                          : election.position || '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {election.round}차
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(election.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(election.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/admin/elections/${election.id}`}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          상세
                        </Link>
                        <button
                          onClick={() => handleDeleteElection(election.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </button>
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
