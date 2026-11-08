'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SystemLogo from '@/components/SystemLogo';
import { enableKiosk, useKiosk } from '@/lib/kiosk';
import { stashCodeInfo, type CodeInfo } from '@/lib/voterSession';

function VoteEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kiosk = useKiosk();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('kiosk') === '1') enableKiosk();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('참여코드를 입력하세요.'); return; }

    setLoading(true);
    const { data, error: rpcError } = await createClient().rpc('enter_code', { p_code: trimmed });
    if (rpcError || !data) {
      setError('올바르지 않은 참여코드입니다.');
      setLoading(false);
      return;
    }

    const info = data as CodeInfo;
    if (info.accessible_elections.length > 0 && info.accessible_elections.every((id) => info.voted.includes(id))) {
      setError('이미 모든 투표를 완료한 참여코드입니다.');
      setLoading(false);
      return;
    }

    stashCodeInfo(trimmed, info); // 투표 화면이 재조회하지 않도록 넘긴다
    router.push(`/vote/${trimmed}`);
  };

  return (
    <main className="min-h-screen flex items-center px-5 sm:px-8">
      <div className="w-full max-w-md mx-auto py-16">
        {!kiosk && <SystemLogo size="sm" linkToHome />}

        <p className="eyebrow mt-8">전자투표</p>
        <h1 className="mt-3 text-4xl">참여코드 입력</h1>
        <p className="mt-3" style={{ color: 'var(--ink-2)' }}>
          {kiosk ? '접수처에서 받은 코드를 입력해 주세요.' : '관리자에게 받은 참여코드를 입력해 주세요.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-10">
          <label htmlFor="code" className="block text-sm font-medium mb-2">참여코드</label>
          <input
            id="code"
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="AB1234"
            maxLength={8}
            disabled={loading}
            className="input text-center"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: '0.18em', minHeight: 64 }}
            aria-invalid={!!error}
            aria-describedby={error ? 'code-error' : undefined}
          />
          {error && <p id="code-error" className="notice is-error mt-3" role="alert">{error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full mt-5">
            {loading ? <><span className="spinner" style={{ borderTopColor: 'var(--accent-ink)' }} /> 확인 중</> : '투표 시작'}
          </button>
        </form>

        {!kiosk && (
          <p className="mt-8 text-sm" style={{ color: 'var(--ink-3)' }}>
            참여코드가 없으면 관리자에게 문의하세요. <Link href="/" className="underline">처음으로</Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function VotePage() {
  return (
    <Suspense fallback={null}>
      <VoteEntry />
    </Suspense>
  );
}
