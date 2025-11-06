'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import Link from 'next/link';

interface Village {
  id: string;
  name: string;
  code: string;
}

interface Candidate {
  id: string;
  name: string;
}

export default function CreateElectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [villages, setVillages] = useState<Village[]>([]);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [electionType, setElectionType] = useState<'delegate' | 'officer'>('delegate');
  const [villageId, setVillageId] = useState('');
  const [position, setPosition] = useState('');
  const [round, setRound] = useState(1);
  const [maxSelections, setMaxSelections] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', name: '' },
    { id: '2', name: '' },
  ]);

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

  const loadVillages = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('villages')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('마을 로딩 오류:', error);
      return;
    }

    setVillages(data || []);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      await loadVillages();
    };

    initialize();
  }, [checkAuth, loadVillages]);

  const addCandidate = () => {
    const newId = (candidates.length + 1).toString();
    setCandidates([...candidates, { id: newId, name: '' }]);
  };

  const removeCandidate = (id: string) => {
    if (candidates.length <= 2) {
      alert('최소 2명의 후보자가 필요합니다.');
      return;
    }
    setCandidates(candidates.filter(c => c.id !== id));
  };

  const updateCandidateName = (id: string, name: string) => {
    setCandidates(candidates.map(c => 
      c.id === id ? { ...c, name } : c
    ));
  };

  const validateForm = () => {
    if (!title.trim()) {
      alert('투표 제목을 입력하세요.');
      return false;
    }

    if (electionType === 'delegate' && !villageId) {
      alert('마을을 선택하세요.');
      return false;
    }

    if (electionType === 'officer' && !position.trim()) {
      alert('직책을 입력하세요.');
      return false;
    }

    const validCandidates = candidates.filter(c => c.name.trim());
    if (validCandidates.length < 2) {
      alert('최소 2명의 후보자를 입력하세요.');
      return false;
    }

    if (maxSelections < 1) {
      alert('최대 선택 수는 1 이상이어야 합니다.');
      return false;
    }

    if (maxSelections > validCandidates.length) {
      alert('최대 선택 수는 후보자 수보다 클 수 없습니다.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();

      // 1. 투표 생성
      const electionData: {
        title: string;
        election_type: 'delegate' | 'officer';
        max_selections: number;
        round: number;
        status: string;
        village_id?: string;
        position?: string;
      } = {
        title: title.trim(),
        election_type: electionType,
        max_selections: maxSelections,
        round: round,
        status: 'waiting',
      };

      if (electionType === 'delegate') {
        electionData.village_id = villageId;
      } else {
        electionData.position = position.trim();
      }

      const { data: election, error: electionError } = await supabase
        .from('elections')
        .insert([electionData])
        .select()
        .single();

      if (electionError) {
        console.error('투표 생성 오류:', electionError);
        alert('투표 생성에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      // 2. 후보자 생성
      const validCandidates = candidates
        .filter(c => c.name.trim())
        .map(c => ({
          election_id: election.id,
          name: c.name.trim(),
          vote_count: 0,
        }));

      const { error: candidatesError } = await supabase
        .from('candidates')
        .insert(validCandidates);

      if (candidatesError) {
        console.error('후보자 생성 오류:', candidatesError);
        alert('후보자 생성에 실패했습니다.');
        setSubmitting(false);
        return;
      }

      alert('투표가 성공적으로 생성되었습니다!');
      router.push('/admin/dashboard');
    } catch (error) {
      console.error('투표 생성 중 오류:', error);
      alert('투표 생성 중 오류가 발생했습니다.');
      setSubmitting(false);
    }
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
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>준비 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      {/* Header */}
      <header className="glass-effect border-b" style={{ 
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: 'rgba(0, 0, 0, 0.05)'
      }}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold mb-1" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.03em'
              }}>
                새 투표 생성
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                투표 정보와 후보자를 입력하세요
              </p>
            </div>
            <Link 
              href="/admin/elections"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all duration-200"
              style={{ 
                background: 'rgba(0, 0, 0, 0.04)',
                color: '#1d1d1f'
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              투표 목록
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 투표 제목 */}
          <div className="card-apple p-8">
            <h2 className="text-xl font-semibold mb-6" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              기본 정보
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                투표 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-apple"
                placeholder="예: 2025년 1차 총대 선출"
                required
              />
            </div>
          </div>

          {/* 투표 유형 */}
          <div className="card-apple p-8">
            <h2 className="text-xl font-semibold mb-6" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              투표 유형
            </h2>
            
            <div className="grid grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setElectionType('delegate')}
                className="p-8 rounded-2xl font-semibold text-lg transition-all duration-200"
                style={{
                  border: electionType === 'delegate' ? '3px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.1)',
                  background: electionType === 'delegate' ? 'rgba(0, 113, 227, 0.05)' : 'white',
                  color: electionType === 'delegate' ? 'var(--color-secondary)' : '#1d1d1f',
                  letterSpacing: '-0.01em',
                  transform: electionType === 'delegate' ? 'scale(1.02)' : 'scale(1)'
                }}
              >
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{
                  background: electionType === 'delegate' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.05)'
                }}>
                  <svg className="w-7 h-7" style={{ color: electionType === 'delegate' ? 'white' : '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                총대 선출
              </button>
              <button
                type="button"
                onClick={() => setElectionType('officer')}
                className="p-8 rounded-2xl font-semibold text-lg transition-all duration-200"
                style={{
                  border: electionType === 'officer' ? '3px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.1)',
                  background: electionType === 'officer' ? 'rgba(0, 113, 227, 0.05)' : 'white',
                  color: electionType === 'officer' ? 'var(--color-secondary)' : '#1d1d1f',
                  letterSpacing: '-0.01em',
                  transform: electionType === 'officer' ? 'scale(1.02)' : 'scale(1)'
                }}
              >
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{
                  background: electionType === 'officer' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.05)'
                }}>
                  <svg className="w-7 h-7" style={{ color: electionType === 'officer' ? 'white' : '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                임원 선출
              </button>
            </div>

            {/* 마을/직책 선택 */}
            <div className="mt-6">
              {electionType === 'delegate' && (
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    마을 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={villageId}
                    onChange={(e) => setVillageId(e.target.value)}
                    className="input-apple"
                    required
                  >
                    <option value="">마을을 선택하세요</option>
                    {villages.map((village) => (
                      <option key={village.id} value={village.id}>
                        {village.name}
                      </option>
                    ))}
                  </select>
                  {villages.length === 0 && (
                    <div className="mt-4 p-4 rounded-2xl" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
                      <p className="text-sm text-amber-800" style={{ letterSpacing: '-0.01em' }}>
                        마을이 없습니다. <Link href="/admin/villages" className="underline font-medium">마을 관리</Link>에서 먼저 마을을 추가하세요.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {electionType === 'officer' && (
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                    직책 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="input-apple"
                    placeholder="예: 회장, 부회장, 총무"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          {/* 투표 설정 */}
          <div className="card-apple p-8">
            <h2 className="text-xl font-semibold mb-6" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.02em'
            }}>
              투표 설정
            </h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  라운드
                </label>
                <input
                  type="number"
                  value={round}
                  onChange={(e) => setRound(parseInt(e.target.value) || 1)}
                  min="1"
                  className="input-apple"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  최대 선택 수
                </label>
                <input
                  type="number"
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(parseInt(e.target.value) || 1)}
                  min="1"
                  className="input-apple"
                />
              </div>
            </div>
          </div>

          {/* 후보자 입력 */}
          <div className="card-apple p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold" style={{ 
                  color: '#1d1d1f',
                  letterSpacing: '-0.02em'
                }}>
                  후보자 <span className="text-red-500">*</span>
                </h2>
                <p className="text-sm text-gray-600 mt-1" style={{ letterSpacing: '-0.01em' }}>
                  최소 2명 이상 입력하세요
                </p>
              </div>
              <button
                type="button"
                onClick={addCandidate}
                className="btn-apple-secondary inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                후보자 추가
              </button>
            </div>

            <div className="space-y-4">
              {candidates.map((candidate, index) => (
                <div key={candidate.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl text-base font-semibold text-white" style={{ background: 'var(--color-secondary)' }}>
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={candidate.name}
                    onChange={(e) => updateCandidateName(candidate.id, e.target.value)}
                    className="input-apple flex-1"
                    placeholder="후보자 이름"
                  />
                  <button
                    type="button"
                    onClick={() => removeCandidate(candidate.id)}
                    className="flex-shrink-0 px-5 py-3 rounded-xl font-medium transition-all duration-200 disabled:opacity-30"
                    style={{ 
                      background: candidates.length <= 2 ? 'rgba(0, 0, 0, 0.03)' : 'rgba(239, 68, 68, 0.1)',
                      color: candidates.length <= 2 ? '#9ca3af' : '#ef4444'
                    }}
                    disabled={candidates.length <= 2}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="btn-apple-primary flex-1 text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  생성 중
                </span>
              ) : '투표 생성'}
            </button>
            <Link
              href="/admin/elections"
              className="px-8 py-4 rounded-2xl font-semibold text-lg text-center transition-all duration-200"
              style={{ 
                background: 'rgba(0, 0, 0, 0.04)',
                color: '#1d1d1f',
                letterSpacing: '-0.01em'
              }}
            >
              취소
            </Link>
          </div>
        </form>

        {/* 도움말 */}
        <div className="mt-8 card-apple p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-3" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                투표 생성 안내
              </h3>
              <ul className="space-y-2 text-sm text-gray-700" style={{ letterSpacing: '-0.01em' }}>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>총대 선출</strong>: 마을별 대표를 선출하는 투표입니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>임원 선출</strong>: 회장, 부회장 등 특정 직책을 선출하는 투표입니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>최대 선택 수</strong>: 투표자가 선택할 수 있는 후보자의 최대 수입니다</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>투표 생성 후에는 상태를 <strong>&apos;등록중&apos;</strong>으로 변경하여 참여코드를 발급받으세요</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
