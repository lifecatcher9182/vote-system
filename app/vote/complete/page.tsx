'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useKiosk, trapBack } from '@/lib/kiosk';

const KIOSK_RETURN_SECONDS = 8;

function Complete() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const electionTitle = searchParams.get('election') || '';
  const kiosk = useKiosk();
  const [left, setLeft] = useState(KIOSK_RETURN_SECONDS);

  useEffect(() => {
    if (!kiosk) return;
    const untrap = trapBack();
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => { untrap(); clearInterval(t); };
  }, [kiosk]);

  useEffect(() => {
    if (kiosk && left <= 0) router.replace('/vote');
  }, [kiosk, left, router]);

  return (
    <main className="min-h-screen flex items-center px-5 sm:px-8">
      <div className="w-full max-w-md mx-auto py-16">
        <p className="eyebrow">제출 완료</p>
        <h1 className="mt-3 text-4xl">투표가 접수되었습니다</h1>
        {electionTitle && (
          <p className="mt-4 text-lg" style={{ color: 'var(--ink-2)' }}>{electionTitle}</p>
        )}

        <hr className="rule mt-10" />
        <ul className="mt-6 space-y-2 text-sm" style={{ color: 'var(--ink-2)' }}>
          <li>이 참여코드는 더 이상 사용할 수 없습니다.</li>
          <li>결과는 투표 종료 후 선거관리위원회가 발표합니다.</li>
        </ul>

        {kiosk ? (
          <button onClick={() => router.replace('/vote')} className="btn btn-primary btn-lg w-full mt-10">
            다음 투표자 ({Math.max(left, 0)}초 후 자동)
          </button>
        ) : (
          <Link href="/" className="btn btn-secondary w-full mt-10">처음으로</Link>
        )}
      </div>
    </main>
  );
}

export default function VoteCompletePage() {
  return (
    <Suspense fallback={null}>
      <Complete />
    </Suspense>
  );
}
