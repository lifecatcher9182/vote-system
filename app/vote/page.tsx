'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SystemLogo from '@/components/SystemLogo';

export default function VotePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim()) {
      setError('참여코드를 입력하세요.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // 참여코드 확인
      const { data: voterCode, error: codeError } = await supabase
        .from('voter_codes')
        .select('*')
        .eq('code', code.trim())
        .single();

      if (codeError || !voterCode) {
        setError('올바르지 않은 참여코드입니다.');
        setLoading(false);
        return;
      }

      // 모든 투표가 완료되었는지 확인
      // accessible_elections의 모든 투표에 대해 이미 투표했는지 체크
      const { data: votedElections } = await supabase
        .from('votes')
        .select('election_id')
        .eq('voter_code_id', voterCode.id);

      const votedElectionIds = new Set(votedElections?.map(v => v.election_id) || []);
      const allElectionsCompleted = voterCode.accessible_elections.every((electionId: string) => 
        votedElectionIds.has(electionId)
      );

      if (allElectionsCompleted && voterCode.accessible_elections.length > 0) {
        setError('이미 모든 투표를 완료한 참여코드입니다.');
        setLoading(false);
        return;
      }

      // 투표 페이지로 이동
      router.push(`/vote/${code.trim()}`);
    } catch (error) {
      console.error('코드 확인 오류:', error);
      setError('코드 확인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      {/* Logo - 좌측 상단 */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50">
        <SystemLogo size="sm" linkToHome />
      </div>

      <div className="max-w-md w-full">
        {/* Card with Apple style */}
        <div className="card-apple p-6 sm:p-10">
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-semibold mb-2 sm:mb-3" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.03em',
              lineHeight: '1.1'
            }}>
              투표 참여
            </h1>
            <p className="text-base sm:text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>
              참여코드를 입력해주세요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label 
                htmlFor="code" 
                className="block text-sm font-medium text-gray-700 mb-3"
                style={{ letterSpacing: '-0.01em' }}
              >
                참여코드
              </label>
              <input
                type="text"
                id="code"
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCD123456"
                className="input-apple uppercase text-center text-lg tracking-widest"
                disabled={loading}
                style={{ letterSpacing: '0.1em' }}
              />
              {error && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ 
                background: 'var(--color-secondary)',
                boxShadow: '0 4px 16px rgba(0, 113, 227, 0.25)',
                letterSpacing: '-0.01em'
              }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  확인 중
                </>
              ) : '참여하기'}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 text-center">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-2xl font-medium transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ 
                background: 'rgba(0, 0, 0, 0.06)',
                color: '#1d1d1f',
                letterSpacing: '-0.01em'
              }}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              홈으로 돌아가기
            </Link>
          </div>
        </div>

        {/* Info card */}
        <div className="mt-4 sm:mt-6 p-4 sm:p-6 rounded-2xl" style={{ 
          background: 'rgba(0, 0, 0, 0.03)',
          backdropFilter: 'blur(20px)'
        }}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0, 113, 227, 0.1)' }}>
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: 'var(--color-secondary)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">참여코드가 없으신가요?</p>
              <p className="text-sm text-gray-600" style={{ letterSpacing: '-0.01em' }}>
                관리자에게 문의하여 참여코드를 받으세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
