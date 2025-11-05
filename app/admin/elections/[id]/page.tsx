'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import { use } from 'react';

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

interface Candidate {
  id: string;
  name: string;
  vote_count: number;
}

export default function ElectionDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');

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

  const loadElection = useCallback(async () => {
    const supabase = createClient();
    
    const { data: electionData, error: electionError } = await supabase
      .from('elections')
      .select(`
        *,
        villages (
          name
        )
      `)
      .eq('id', resolvedParams.id)
      .single();

    if (electionError) {
      console.error('투표 로딩 오류:', electionError);
      alert('투표를 불러오지 못했습니다.');
      router.push('/admin/elections');
      return;
    }

    setElection(electionData);

    const { data: candidatesData, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .eq('election_id', resolvedParams.id)
      .order('name', { ascending: true });

    if (candidatesError) {
      console.error('후보자 로딩 오류:', candidatesError);
      return;
    }

    setCandidates(candidatesData || []);
  }, [resolvedParams.id, router]);

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      await loadElection();
    };

    initialize();
  }, [checkAuth, loadElection]);

  const handleStatusChange = async (newStatus: Election['status']) => {
    if (!election) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('elections')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', election.id);

    if (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경에 실패했습니다.');
      return;
    }

    setElection({ ...election, status: newStatus });
  };

  const handleAddCandidate = async () => {
    if (!newCandidateName.trim()) {
      alert('후보자 이름을 입력하세요.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('candidates')
      .insert([{
        election_id: resolvedParams.id,
        name: newCandidateName.trim(),
        vote_count: 0,
      }]);

    if (error) {
      console.error('후보자 추가 오류:', error);
      alert('후보자 추가에 실패했습니다.');
      return;
    }

    setNewCandidateName('');
    setShowAddCandidate(false);
    loadElection();
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm('정말 이 후보자를 삭제하시겠습니까?')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId);

    if (error) {
      console.error('후보자 삭제 오류:', error);
      alert('후보자 삭제에 실패했습니다.');
      return;
    }

    loadElection();
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
      <span className={`px-3 py-1 text-sm font-semibold rounded ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading || !election) {
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
            <h1 className="text-3xl font-bold text-gray-900">투표 상세</h1>
            <Link 
              href="/admin/elections"
              className="text-blue-600 hover:text-blue-800"
            >
              ← 투표 목록으로
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 투표 정보 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">투표 정보</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between border-b pb-3">
                    <span className="font-medium text-gray-700">제목</span>
                    <span className="text-gray-900">{election.title}</span>
                  </div>
                  
                  <div className="flex justify-between border-b pb-3">
                    <span className="font-medium text-gray-700">유형</span>
                    <span className="text-gray-900">
                      {election.election_type === 'delegate' ? '총대 선출' : '임원 선출'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between border-b pb-3">
                    <span className="font-medium text-gray-700">대상</span>
                    <span className="text-gray-900">
                      {election.election_type === 'delegate' 
                        ? election.villages?.name || '-'
                        : election.position || '-'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between border-b pb-3">
                    <span className="font-medium text-gray-700">라운드</span>
                    <span className="text-gray-900">{election.round}차</span>
                  </div>
                  
                  <div className="flex justify-between border-b pb-3">
                    <span className="font-medium text-gray-700">최대 선택 수</span>
                    <span className="text-gray-900">{election.max_selections}명</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">생성일</span>
                    <span className="text-gray-900">
                      {new Date(election.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 후보자 목록 */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">후보자 목록 ({candidates.length}명)</h2>
                  <button
                    onClick={() => setShowAddCandidate(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    + 후보자 추가
                  </button>
                </div>

                {showAddCandidate && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCandidateName}
                        onChange={(e) => setNewCandidateName(e.target.value)}
                        placeholder="후보자 이름"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCandidate();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddCandidate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        추가
                      </button>
                      <button
                        onClick={() => {
                          setShowAddCandidate(false);
                          setNewCandidateName('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {candidates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    후보자가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {candidates.map((candidate, index) => (
                      <div 
                        key={candidate.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-gray-400">
                            {index + 1}
                          </span>
                          <span className="font-medium">{candidate.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">
                            득표: {candidate.vote_count}표
                          </span>
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 상태 관리 */}
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">상태 관리</h2>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">현재 상태</span>
                    {getStatusBadge(election.status)}
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleStatusChange('waiting')}
                    disabled={election.status === 'waiting'}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    대기
                  </button>
                  <button
                    onClick={() => handleStatusChange('registering')}
                    disabled={election.status === 'registering'}
                    className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    등록중
                  </button>
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={election.status === 'active'}
                    className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    진행중
                  </button>
                  <button
                    onClick={() => handleStatusChange('closed')}
                    disabled={election.status === 'closed'}
                    className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    종료
                  </button>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                  <p className="font-semibold mb-1">상태 설명</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><strong>대기</strong>: 투표 준비 중</li>
                    <li><strong>등록중</strong>: 참여코드 발급 가능</li>
                    <li><strong>진행중</strong>: 투표 진행 중</li>
                    <li><strong>종료</strong>: 투표 마감</li>
                  </ul>
                </div>
              </div>

              {/* 빠른 작업 */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">빠른 작업</h2>
                <div className="space-y-2">
                  <Link
                    href={`/admin/elections/${election.id}/monitor`}
                    className="block w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-center text-sm font-medium"
                  >
                    📊 실시간 모니터링
                  </Link>
                  <Link
                    href={`/admin/elections/${election.id}/results`}
                    className="block w-full px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-center text-sm font-medium"
                  >
                    📈 결과 보기
                  </Link>
                  <Link
                    href="/admin/codes"
                    className="block w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-center text-sm font-medium"
                  >
                    🎟️ 참여코드 관리
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
