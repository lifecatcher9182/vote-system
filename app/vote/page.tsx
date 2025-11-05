'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

      // 이미 사용된 코드인지 확인
      if (voterCode.is_used) {
        setError('이미 사용된 참여코드입니다.');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            투표 참여
          </h1>
          <p className="text-gray-600">
            참여코드를 입력하여 투표에 참여하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label 
              htmlFor="code" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              참여코드
            </label>
            <input
              type="text"
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="예: AbCd123456"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              disabled={loading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '확인 중...' : '참여하기'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link 
            href="/" 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>참여코드가 없으신가요?</strong><br />
            관리자에게 문의하여 참여코드를 받으세요.
          </p>
        </div>
      </div>
    </div>
  );
}
