'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';

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
      waiting: { text: '대기', bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' },
      registering: { text: '등록중', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' },
      active: { text: '진행중', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' },
      closed: { text: '종료', bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' },
    };

    const badge = badges[status];
    return (
      <span 
        className="px-3 py-1.5 text-xs font-semibold rounded-full"
        style={{ 
          background: badge.bg,
          color: badge.color,
          letterSpacing: '-0.01em'
        }}
      >
        {badge.text}
      </span>
    );
  };

  const getTypeText = (type: Election['election_type']) => {
    return type === 'delegate' ? '총대 선출' : '임원 선출';
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
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>투표 목록을 불러오는 중...</p>
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
                투표 관리
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                모든 투표를 관리하고 모니터링합니다
              </p>
            </div>
            <div className="flex gap-3">
              <Link 
                href="/admin/results"
                className="btn-apple-primary inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                결과 보기
              </Link>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        {/* 필터 & 생성 버튼 */}
        <div className="mb-8 flex justify-between items-center">
          <div className="flex gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'all'
                  ? 'text-white'
                  : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'all' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'all' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              전체
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'active'
                  ? 'text-white'
                  : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'active' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'active' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              진행중
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                filter === 'closed'
                  ? 'text-white'
                  : 'text-gray-700'
              }`}
              style={{ 
                background: filter === 'closed' ? 'var(--color-secondary)' : 'white',
                boxShadow: filter === 'closed' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                letterSpacing: '-0.01em'
              }}
            >
              종료
            </button>
          </div>

          <Link
            href="/admin/elections/create"
            className="btn-apple-primary inline-flex items-center gap-2 text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            새 투표 생성
          </Link>
        </div>

        {elections.length === 0 ? (
          <div className="card-apple p-16 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
              투표가 없습니다
            </h3>
            <p className="text-gray-500 mb-8" style={{ letterSpacing: '-0.01em' }}>새로운 투표를 생성하여 시작하세요</p>
            <Link
              href="/admin/elections/create"
              className="btn-apple-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              투표 생성
            </Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {elections.map((election) => (
              <div 
                key={election.id}
                className="card-apple p-6 hover:scale-[1.01] transition-transform duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <h3 className="text-xl font-semibold" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                        {election.title}
                      </h3>
                      {getStatusBadge(election.status)}
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {getTypeText(election.election_type)}
                      </span>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {election.election_type === 'delegate' 
                          ? election.villages?.name || '-'
                          : election.position || '-'
                        }
                      </span>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {election.round}차
                      </span>
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(election.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/elections/${election.id}/monitor`}
                      className="p-3 rounded-xl transition-all duration-200 hover:scale-110"
                      style={{ background: 'rgba(59, 130, 246, 0.1)' }}
                      title="실시간 모니터링"
                    >
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </Link>
                    <Link
                      href={`/admin/elections/${election.id}/results`}
                      className="p-3 rounded-xl transition-all duration-200 hover:scale-110"
                      style={{ background: 'rgba(16, 185, 129, 0.1)' }}
                      title="결과 보기"
                    >
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </Link>
                    <Link
                      href={`/admin/elections/${election.id}`}
                      className="btn-apple-secondary px-5 py-2.5"
                    >
                      관리
                    </Link>
                    <button
                      onClick={() => handleDeleteElection(election.id)}
                      className="p-3 rounded-xl transition-all duration-200 hover:scale-110"
                      style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                      title="삭제"
                    >
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
