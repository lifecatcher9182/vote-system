'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';
import { use } from 'react';
import QRCodeSection from '@/components/QRCodeSection';
import { nanoid } from 'nanoid';

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

interface VoterCode {
  id: string;
  code: string;
  code_type: 'delegate' | 'officer';
  accessible_elections: string[];
  village_id: string | null;
  is_used: boolean;
  voter_name: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  created_at: string;
  villages?: {
    name: string;
  };
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
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'monitor' | 'results'>('overview');
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  
  // 코드 관리 상태
  const [codes, setCodes] = useState<VoterCode[]>([]);
  const [codeFilter, setCodeFilter] = useState<'all' | 'voted' | 'attended' | 'not_attended'>('all');
  const [showCreateCodeModal, setShowCreateCodeModal] = useState(false);
  const [codeQuantity, setCodeQuantity] = useState(10);
  const [generatingCodes, setGeneratingCodes] = useState(false);

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

  const handleGenerateCodes = async () => {
    if (!election) return;
    if (codeQuantity < 1 || codeQuantity > 100) {
      alert('코드는 1-100개까지 생성 가능합니다.');
      return;
    }

    setGeneratingCodes(true);

    try {
      const supabase = createClient();
      const newCodes = [];

      for (let i = 0; i < codeQuantity; i++) {
        newCodes.push({
          code: nanoid(10).toUpperCase(),
          code_type: 'delegate' as const,
          accessible_elections: [election.id],
          village_id: election.village_id,
          is_used: false,
        });
      }

      const { error } = await supabase
        .from('voter_codes')
        .insert(newCodes);

      if (error) {
        console.error('코드 생성 오류:', error);
        alert('코드 생성에 실패했습니다.');
        return;
      }

      alert(`${codeQuantity}개의 코드가 생성되었습니다.`);
      setShowCreateCodeModal(false);
      setCodeQuantity(10);
      // 코드 목록 새로고침은 나중에 구현
    } catch (error) {
      console.error('코드 생성 오류:', error);
      alert('코드 생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingCodes(false);
    }
  };

  const getStatusBadge = (status: Election['status']) => {
    const badges = {
      waiting: { text: '대기', color: 'bg-gray-100 text-gray-800' },
      registering: { text: '등록중', color: 'bg-[var(--color-secondary)] bg-opacity-10 text-gray-700' },
      active: { text: '진행중', color: 'bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]' },
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-semibold" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.03em'
            }}>
              투표 관리
            </h1>
            <div className="flex gap-3">
              <Link 
                href="/admin/elections"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                ← 투표 목록
              </Link>
              <Link 
                href="/admin/dashboard"
                className="text-[var(--color-secondary)] hover:opacity-80 px-4 py-2"
              >
                🏠 대시보드
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 탭 네비게이션 */}
          <div className="card-apple p-2 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'overview' ? 'text-white' : 'text-gray-700'
                }`}
                style={{
                  background: activeTab === 'overview' ? 'var(--color-secondary)' : 'transparent',
                  letterSpacing: '-0.01em'
                }}
              >
                📋 개요
              </button>
              <button
                onClick={() => setActiveTab('codes')}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'codes' ? 'text-white' : 'text-gray-700'
                }`}
                style={{
                  background: activeTab === 'codes' ? 'var(--color-secondary)' : 'transparent',
                  letterSpacing: '-0.01em'
                }}
              >
                🎫 코드 관리
              </button>
              <button
                onClick={() => setActiveTab('monitor')}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'monitor' ? 'text-white' : 'text-gray-700'
                }`}
                style={{
                  background: activeTab === 'monitor' ? 'var(--color-secondary)' : 'transparent',
                  letterSpacing: '-0.01em'
                }}
              >
                📊 모니터링
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === 'results' ? 'text-white' : 'text-gray-700'
                }`}
                style={{
                  background: activeTab === 'results' ? 'var(--color-secondary)' : 'transparent',
                  letterSpacing: '-0.01em'
                }}
              >
                📈 결과
              </button>
            </div>
          </div>

          {/* 개요 탭 */}
          {activeTab === 'overview' && (
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
                    className="px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 text-sm"
                  >
                    + 후보자 추가
                  </button>
                </div>

                {showAddCandidate && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
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
                        className="px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90"
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
              {/* QR 코드 섹션 */}
              <QRCodeSection 
                electionId={election.id}
                title={election.title}
              />

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
                    className="w-full px-4 py-2 bg-[var(--color-secondary)] bg-opacity-10 text-gray-600 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    등록중
                  </button>
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={election.status === 'active'}
                    className="w-full px-4 py-2 bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)] rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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

                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-700">
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
                    className="block w-full px-4 py-2 bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)] rounded-lg hover:bg-purple-200 text-center text-sm font-medium"
                  >
                    📊 실시간 모니터링
                  </Link>
                  <Link
                    href={`/admin/elections/${election.id}/results`}
                    className="block w-full px-4 py-2 bg-[var(--color-secondary)] bg-opacity-10 text-[var(--color-secondary)] rounded-lg hover:bg-indigo-200 text-center text-sm font-medium"
                  >
                    📈 결과 보기
                  </Link>
                  <Link
                    href="/admin/codes"
                    className="block w-full px-4 py-2 bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)] rounded-lg hover:bg-green-200 text-center text-sm font-medium"
                  >
                    🎟️ 참여코드 관리
                  </Link>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* 코드 관리 탭 */}
          {activeTab === 'codes' && election && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setCodeFilter('all')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'all' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'all' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'all' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setCodeFilter('voted')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'voted' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'voted' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'voted' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    투표 완료
                  </button>
                  <button
                    onClick={() => setCodeFilter('attended')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'attended' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'attended' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'attended' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    참석 확인
                  </button>
                  <button
                    onClick={() => setCodeFilter('not_attended')}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      codeFilter === 'not_attended' ? 'text-white' : 'text-gray-700'
                    }`}
                    style={{ 
                      background: codeFilter === 'not_attended' ? 'var(--color-secondary)' : 'white',
                      boxShadow: codeFilter === 'not_attended' ? '0 2px 8px rgba(0, 113, 227, 0.25)' : 'var(--shadow-sm)',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    미참석
                  </button>
                </div>
                
                <button
                  onClick={() => setShowCreateCodeModal(true)}
                  className="btn-apple-primary inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  코드 생성
                </button>
              </div>

              <div className="card-apple p-8">
                <h2 className="text-2xl font-semibold mb-4" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  참여 코드 관리
                </h2>
                <p className="text-gray-600 mb-8" style={{ letterSpacing: '-0.01em' }}>
                  이 투표({election.title})의 참여 코드를 생성하고 관리합니다.
                </p>
                
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                    생성된 코드가 없습니다
                  </h3>
                  <p className="text-gray-500 mb-8" style={{ letterSpacing: '-0.01em' }}>
                    &ldquo;코드 생성&rdquo; 버튼을 눌러 참여 코드를 만드세요
                  </p>
                  <button
                    onClick={() => setShowCreateCodeModal(true)}
                    className="btn-apple-primary inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    코드 생성
                  </button>
                </div>
              </div>

              {/* 코드 생성 모달 */}
              {showCreateCodeModal && (
                <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
                  <div className="card-apple max-w-md w-full p-8 animate-[scale-in_0.2s_ease-out]">
                    <h2 className="text-2xl font-semibold mb-6" style={{ 
                      color: '#1d1d1f',
                      letterSpacing: '-0.02em'
                    }}>
                      참여 코드 생성
                    </h2>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                        생성 개수
                      </label>
                      <input
                        type="number"
                        value={codeQuantity}
                        onChange={(e) => setCodeQuantity(parseInt(e.target.value) || 1)}
                        min="1"
                        max="100"
                        className="input-apple"
                        placeholder="생성할 코드 개수"
                      />
                      <p className="mt-2 text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                        1-100개까지 생성 가능합니다
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateCodeModal(false);
                          setCodeQuantity(10);
                        }}
                        className="flex-1 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                        style={{ 
                          background: 'rgba(0, 0, 0, 0.04)',
                          color: '#1d1d1f',
                          letterSpacing: '-0.01em'
                        }}
                        disabled={generatingCodes}
                      >
                        취소
                      </button>
                      <button
                        onClick={handleGenerateCodes}
                        className="btn-apple-primary flex-1"
                        disabled={generatingCodes}
                      >
                        {generatingCodes ? '생성 중...' : '생성'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 모니터링 탭 */}
          {activeTab === 'monitor' && (
            <div className="card-apple p-8">
              <h2 className="text-2xl font-semibold mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                실시간 모니터링
              </h2>
              <div className="text-center py-12">
                <Link 
                  href={`/admin/elections/${election.id}/monitor`}
                  className="btn-apple-primary inline-flex items-center gap-2 text-lg"
                >
                  📊 모니터링 페이지로 이동
                </Link>
              </div>
            </div>
          )}

          {/* 결과 탭 */}
          {activeTab === 'results' && (
            <div className="card-apple p-8">
              <h2 className="text-2xl font-semibold mb-6" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                투표 결과
              </h2>
              <div className="text-center py-12">
                <Link 
                  href={`/admin/elections/${election.id}/results`}
                  className="btn-apple-primary inline-flex items-center gap-2 text-lg"
                >
                  📈 결과 페이지로 이동
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
