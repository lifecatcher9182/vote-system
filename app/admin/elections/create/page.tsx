'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import { WinningCriteria } from '@/lib/database.types';
import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';
import AlertModal from '@/components/AlertModal';

interface Village {
  id: string;
  name: string;
  is_active: boolean;
}

interface Candidate {
  id: string;
  name: string;
}

function CreateElectionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams?.get('group_id');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [villages, setVillages] = useState<Village[]>([]);
  const [groupInfo, setGroupInfo] = useState<{ title: string; group_type: 'delegate' | 'officer' } | null>(null);

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

  // 당선 기준 상태
  const [criteriaType, setCriteriaType] = useState<'plurality' | 'absolute_majority' | 'percentage'>('plurality');
  const [percentage, setPercentage] = useState(66.67);
  const [base, setBase] = useState<'attended' | 'issued'>('attended');

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

    setLoading(false);
  }, [router]);

  const loadVillages = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('villages')
      .select('id, name, is_active')
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
      
      // group_id가 있으면 그룹 정보 로딩 및 타입 자동 설정
      if (groupId) {
        const supabase = createClient();
        const { data } = await supabase
          .from('election_groups')
          .select('title, group_type')
          .eq('id', groupId)
          .single();
        
        if (data) {
          setGroupInfo(data);
          setElectionType(data.group_type); // 그룹 타입에 맞게 자동 설정
        }
      }
      
      await loadVillages();
    };

    initialize();
  }, [checkAuth, loadVillages, groupId]);

  const addCandidate = () => {
    const newId = (candidates.length + 1).toString();
    setCandidates([...candidates, { id: newId, name: '' }]);
  };

  const removeCandidate = (id: string) => {
    if (candidates.length <= 2) {
      setAlertModal({
        isOpen: true,
        message: '최소 2명의 후보자가 필요합니다.',
        title: '입력 오류'
      });
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
      setAlertModal({
        isOpen: true,
        message: '투표 제목을 입력하세요.',
        title: '입력 오류'
      });
      return false;
    }

    if (electionType === 'delegate' && !villageId) {
      setAlertModal({
        isOpen: true,
        message: '마을을 선택하세요.',
        title: '입력 오류'
      });
      return false;
    }

    if (electionType === 'officer' && !position.trim()) {
      setAlertModal({
        isOpen: true,
        message: '직책을 입력하세요.',
        title: '입력 오류'
      });
      return false;
    }

    const validCandidates = candidates.filter(c => c.name.trim());
    if (validCandidates.length < 2) {
      setAlertModal({
        isOpen: true,
        message: '최소 2명의 후보자를 입력하세요.',
        title: '입력 오류'
      });
      return false;
    }

    if (maxSelections < 1) {
      setAlertModal({
        isOpen: true,
        message: '최대 선택 수는 1 이상이어야 합니다.',
        title: '입력 오류'
      });
      return false;
    }

    if (maxSelections > validCandidates.length) {
      setAlertModal({
        isOpen: true,
        message: '최대 선택 수는 후보자 수보다 클 수 없습니다.',
        title: '입력 오류'
      });
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
        winning_criteria: WinningCriteria;
        village_id?: string;
        position?: string;
        group_id?: string;
      } = {
        title: title.trim(),
        election_type: electionType,
        max_selections: maxSelections,
        round: round,
        status: 'waiting',
        winning_criteria: 
          criteriaType === 'plurality' ? { type: 'plurality' } :
          criteriaType === 'absolute_majority' ? { type: 'absolute_majority' } :
          { type: 'percentage', percentage, base },
      };

      // group_id가 있으면 추가
      if (groupId) {
        electionData.group_id = groupId;
      }

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
        setAlertModal({
          isOpen: true,
          message: '투표 생성에 실패했습니다.',
          title: '오류'
        });
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
        setAlertModal({
          isOpen: true,
          message: '후보자 생성에 실패했습니다.',
          title: '오류'
        });
        setSubmitting(false);
        return;
      }

      // 3. 임원 투표이고 그룹에 속한 경우, 기존 코드의 accessible_elections 업데이트
      if (groupId && electionType === 'officer') {
        // 그룹의 모든 투표 ID 가져오기
        const { data: groupElections } = await supabase
          .from('elections')
          .select('id')
          .eq('group_id', groupId);

        if (groupElections) {
          const allElectionIds = groupElections.map(e => e.id);

          // 이 그룹의 기존 코드 가져오기 (하나라도 그룹의 투표 ID를 포함한 코드)
          const { data: existingCodes } = await supabase
            .from('voter_codes')
            .select('id, accessible_elections')
            .eq('code_type', 'officer');

          if (existingCodes) {
            // 이 그룹에 속한 코드만 필터링
            const groupCodes = existingCodes.filter(code => {
              const accessible = (code.accessible_elections as string[]) || [];
              return allElectionIds.some(id => accessible.includes(id));
            });

            // ✅ 최적화: 각 코드의 accessible_elections를 한 번에 업데이트
            if (groupCodes.length > 0) {
              const codeIds = groupCodes.map(c => c.id);
              await supabase
                .from('voter_codes')
                .update({ accessible_elections: allElectionIds })
                .in('id', codeIds);
            }
          }
        }
      }

      setAlertModal({
        isOpen: true,
        message: '투표가 성공적으로 생성되었습니다!',
        title: '생성 완료'
      });
      
      // 그룹에서 들어왔으면 그룹 페이지로, 아니면 대시보드로
      if (groupId) {
        router.push(`/admin/election-groups/${groupId}`);
      } else {
        router.push('/admin/dashboard');
      }
    } catch (error) {
      console.error('투표 생성 중 오류:', error);
      setAlertModal({
        isOpen: true,
        message: '투표 생성 중 오류가 발생했습니다.',
        title: '오류'
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto mb-6"></div>
          <p className="text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>준비 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Logo - 좌측 상단 고정 */}
      <div className="fixed top-6 left-6 z-50">
        <SystemLogo size="sm" linkToHome />
      </div>

      {/* Header */}
      <header className="glass-effect border-b" style={{ 
        background: 'rgba(255, 255, 255, 0.7)',
        
        borderColor: 'rgba(0, 0, 0, 0.05)'
      }}>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold mb-1" style={{ 
                color: 'var(--ink)',
                letterSpacing: '-0.03em'
              }}>
                새 투표 생성
                {groupInfo && (
                  <span className="ml-3 text-xl text-gray-600">
                    • {groupInfo.title}
                  </span>
                )}
              </h1>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                투표 정보와 후보자를 입력하세요
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
              style={{ 
                background: 'rgba(0, 0, 0, 0.06)',
                color: 'var(--ink)',
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
      </header>

      <main className="max-w-4xl mx-auto py-12 px-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 투표 제목 */}
          <div className="card-apple p-8">
            <h2 className="text-xl font-semibold mb-6" style={{ 
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              기본 정보
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              투표 유형
              {groupInfo && (
                <span className="ml-3 text-sm font-normal text-gray-600">
                  ({groupInfo.title})
                </span>
              )}
            </h2>
            
            {groupInfo ? (
              // 그룹에서 들어온 경우: 타입 고정, 변경 불가
              <div className="p-6 rounded-2xl" style={{
                background: 'color-mix(in oklch, var(--accent) 6%, transparent)',
                border: '2px solid color-mix(in oklch, var(--accent) 22%, transparent)'
              }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{
                    background: 'var(--color-secondary)'
                  }}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {groupInfo.group_type === 'delegate' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      )}
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-lg" style={{ color: 'var(--color-secondary)' }}>
                      {groupInfo.group_type === 'delegate' ? '총대 선출' : '임원 선출'}
                    </p>
                    <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                      이 그룹의 투표 유형이 자동으로 선택되었습니다
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // 일반 생성: 타입 선택 가능
              <div className="grid grid-cols-2 gap-5">
                <button
                  type="button"
                  onClick={() => setElectionType('delegate')}
                  className="p-8 rounded-2xl font-semibold text-lg transition-all duration-200"
                  style={{
                    border: electionType === 'delegate' ? '3px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.1)',
                    background: electionType === 'delegate' ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'white',
                    color: electionType === 'delegate' ? 'var(--color-secondary)' : 'var(--ink)',
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
                    background: electionType === 'officer' ? 'color-mix(in oklch, var(--accent) 6%, transparent)' : 'white',
                    color: electionType === 'officer' ? 'var(--color-secondary)' : 'var(--ink)',
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
            )}

            {/* 마을/직책 선택 */}
            <div className="mt-6">
              {electionType === 'delegate' && (
                <div>
                  <label className="block text-sm font-medium mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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
                  <label className="block text-sm font-medium mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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
              color: 'var(--ink)',
              letterSpacing: '-0.02em'
            }}>
              투표 설정
            </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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

            {/* 당선 기준 설정 */}
            <div className="pt-6 border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}>
              <label className="block text-base font-semibold mb-4" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                당선 기준 <span className="text-red-500">*</span>
              </label>
              
              <div className="space-y-3 mb-5">
                <label className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01]" style={{
                  border: criteriaType === 'plurality' ? '2px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.08)',
                  background: criteriaType === 'plurality' ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'white'
                }}>
                  <input
                    type="radio"
                    name="criteria"
                    value="plurality"
                    checked={criteriaType === 'plurality'}
                    onChange={(e) => setCriteriaType(e.target.value as 'plurality')}
                    className="mt-1"
                    style={{ accentColor: 'var(--color-secondary)' }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                      최다 득표
                    </div>
                    <div className="text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                      가장 많은 표를 받은 후보가 당선됩니다 (3차 투표 권장)
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01]" style={{
                  border: criteriaType === 'absolute_majority' ? '2px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.08)',
                  background: criteriaType === 'absolute_majority' ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'white'
                }}>
                  <input
                    type="radio"
                    name="criteria"
                    value="absolute_majority"
                    checked={criteriaType === 'absolute_majority'}
                    onChange={(e) => setCriteriaType(e.target.value as 'absolute_majority')}
                    className="mt-1"
                    style={{ accentColor: 'var(--color-secondary)' }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                      절대 과반수
                    </div>
                    <div className="text-xs text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                      50% 초과 득표 필요 (참석자의 과반)
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01]" style={{
                  border: criteriaType === 'percentage' ? '2px solid var(--color-secondary)' : '2px solid rgba(0, 0, 0, 0.08)',
                  background: criteriaType === 'percentage' ? 'color-mix(in oklch, var(--accent) 4%, transparent)' : 'white'
                }}>
                  <input
                    type="radio"
                    name="criteria"
                    value="percentage"
                    checked={criteriaType === 'percentage'}
                    onChange={(e) => setCriteriaType(e.target.value as 'percentage')}
                    className="mt-1"
                    style={{ accentColor: 'var(--color-secondary)' }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                      득표율 기준
                    </div>
                    <div className="text-xs text-gray-600 mb-3" style={{ letterSpacing: '-0.01em' }}>
                      특정 득표율 이상 필요 (1, 2차 투표 권장)
                    </div>

                    {criteriaType === 'percentage' && (
                      <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}>
                        <div>
                          <label className="block text-xs font-medium mb-2 text-gray-700" style={{ letterSpacing: '-0.01em' }}>
                            필요 득표율 (%)
                          </label>
                          <div className="grid grid-cols-4 gap-2 mb-2">
                            {[50, 60, 66.67, 75].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setPercentage(val)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                                style={{
                                  background: percentage === val ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.05)',
                                  color: percentage === val ? 'white' : '#6b7280'
                                }}
                              >
                                {val === 66.67 ? '2/3' : val === 50 ? '과반' : `${val}%`}
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            value={percentage}
                            onChange={(e) => setPercentage(parseFloat(e.target.value) || 50)}
                            min="0"
                            max="100"
                            step="0.01"
                            className="input-apple text-sm"
                            placeholder="예: 66.67 (2/3)"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-2 text-gray-700" style={{ letterSpacing: '-0.01em' }}>
                            기준 인원
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setBase('attended')}
                              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                background: base === 'attended' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.05)',
                                color: base === 'attended' ? 'white' : '#6b7280'
                              }}
                            >
                              참석자 기준 ⭐
                            </button>
                            <button
                              type="button"
                              onClick={() => setBase('issued')}
                              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                background: base === 'issued' ? 'var(--color-secondary)' : 'rgba(0, 0, 0, 0.05)',
                                color: base === 'issued' ? 'white' : '#6b7280'
                              }}
                            >
                              발급 코드 기준
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2" style={{ letterSpacing: '-0.01em' }}>
                            {base === 'attended' 
                              ? '💡 현장에서 실제 참석한 인원을 기준으로 계산합니다 (권장)'
                              : '📋 미리 발급한 코드 수를 기준으로 계산합니다'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* 미리보기 */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold mb-1 text-blue-900" style={{ letterSpacing: '-0.01em' }}>
                      당선 기준 미리보기
                    </div>
                    <div className="text-xs text-blue-700" style={{ letterSpacing: '-0.01em' }}>
                      {criteriaType === 'plurality' && '최다 득표자가 당선됩니다'}
                      {criteriaType === 'absolute_majority' && '참석자의 50% 초과 득표 필요'}
                      {criteriaType === 'percentage' && (
                        <>
                          {base === 'attended' ? '참석자' : '발급 코드'}의 {percentage}% 이상 득표 필요
                          {percentage === 66.67 && ' (2/3)'}
                          {percentage === 50 && ' (과반)'}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 후보자 입력 */}
          <div className="card-apple p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold" style={{ 
                  color: 'var(--ink)',
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
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200"
                style={{
                  background: 'var(--color-secondary)',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  letterSpacing: '-0.01em'
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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
                    className="flex-shrink-0 px-5 py-3 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-30"
                    style={{ 
                      background: candidates.length <= 2 ? 'rgba(0, 0, 0, 0.06)' : 'rgba(239, 68, 68, 0.1)',
                      color: candidates.length <= 2 ? '#9ca3af' : '#ef4444',
                      letterSpacing: '-0.01em'
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
              className="flex-1 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: 'var(--color-secondary)',
                color: 'white',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                letterSpacing: '-0.01em'
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  생성 중
                </span>
              ) : '투표 생성'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-200"
              style={{ 
                background: 'rgba(0, 0, 0, 0.06)',
                color: 'var(--ink)',
                letterSpacing: '-0.01em'
              }}
            >
              취소
            </button>
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
              <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>
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

export default function CreateElectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: 'var(--paper)' 
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium" style={{ letterSpacing: '-0.01em' }}>
            로딩 중...
          </p>
        </div>
      </div>
    }>
      <CreateElectionPageContent />
    </Suspense>
  );
}
