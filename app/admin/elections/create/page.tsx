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
            <h1 className="text-3xl font-bold text-gray-900">투표 생성</h1>
            <Link 
              href="/admin/elections"
              className="text-blue-600 hover:text-blue-800"
            >
              ← 투표 목록으로
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
            {/* 투표 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                투표 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 2025년 1차 총대 선출"
                required
              />
            </div>

            {/* 투표 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                투표 유형 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setElectionType('delegate')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    electionType === 'delegate'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  총대 선출
                </button>
                <button
                  type="button"
                  onClick={() => setElectionType('officer')}
                  className={`p-4 border-2 rounded-lg font-medium transition-all ${
                    electionType === 'officer'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  임원 선출
                </button>
              </div>
            </div>

            {/* 마을 선택 (총대 선출인 경우) */}
            {electionType === 'delegate' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  마을 <span className="text-red-500">*</span>
                </label>
                <select
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <p className="mt-2 text-sm text-amber-600">
                    마을이 없습니다. <Link href="/admin/villages" className="underline">마을 관리</Link>에서 먼저 마을을 추가하세요.
                  </p>
                )}
              </div>
            )}

            {/* 직책 입력 (임원 선출인 경우) */}
            {electionType === 'officer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  직책 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 회장, 부회장, 총무"
                  required
                />
              </div>
            )}

            {/* 라운드 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  라운드
                </label>
                <input
                  type="number"
                  value={round}
                  onChange={(e) => setRound(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  최대 선택 수
                </label>
                <input
                  type="number"
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 후보자 입력 */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  후보자 <span className="text-red-500">*</span>
                  <span className="text-gray-500 text-xs ml-2">(최소 2명)</span>
                </label>
                <button
                  type="button"
                  onClick={addCandidate}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + 후보자 추가
                </button>
              </div>

              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <div key={candidate.id} className="flex gap-2">
                    <div className="flex-shrink-0 w-10 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => updateCandidateName(candidate.id, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="후보자 이름"
                    />
                    <button
                      type="button"
                      onClick={() => removeCandidate(candidate.id)}
                      className="flex-shrink-0 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={candidates.length <= 2}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 제출 버튼 */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? '생성 중...' : '투표 생성'}
              </button>
              <Link
                href="/admin/elections"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-center"
              >
                취소
              </Link>
            </div>
          </form>

          {/* 도움말 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 투표 생성 안내</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>총대 선출</strong>: 마을별 대표를 선출하는 투표입니다.</li>
              <li><strong>임원 선출</strong>: 회장, 부회장 등 특정 직책을 선출하는 투표입니다.</li>
              <li><strong>최대 선택 수</strong>: 투표자가 선택할 수 있는 후보자의 최대 수입니다.</li>
              <li><strong>라운드</strong>: 동일한 선출을 여러 차례 진행할 때 사용합니다 (예: 1차, 2차 투표).</li>
              <li>투표 생성 후에는 상태를 <strong>&apos;등록중&apos;</strong>으로 변경하여 참여코드를 발급받으세요.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
