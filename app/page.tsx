'use client';

import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';
import { useSystemConfig } from '@/lib/hooks/useSystemConfig';

export default function Home() {
  const { systemName, systemDescription, loading } = useSystemConfig();

  return (
    <main className="min-h-screen flex items-center px-5 sm:px-8">
      <div className="w-full max-w-2xl mx-auto py-16">
        <SystemLogo size="md" />

        <p className="eyebrow mt-10">신일교회 청년부</p>
        <h1 className="mt-3 text-4xl sm:text-5xl" style={{ minHeight: '1.2em' }}>
          {loading ? <span className="inline-block w-56 h-10 rounded" style={{ background: 'var(--paper-2)' }} /> : systemName}
        </h1>
        <p className="mt-4 text-lg" style={{ color: 'var(--ink-2)', minHeight: '1.6em' }}>
          {loading ? '' : systemDescription}
        </p>

        <hr className="rule mt-12" />

        <Link href="/vote" className="row mt-4 no-underline" style={{ minHeight: 88 }}>
          <div className="flex-1">
            <p className="text-lg font-semibold">투표 참여</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-2)' }}>참여코드를 받으신 분</p>
          </div>
          <span aria-hidden className="text-2xl" style={{ color: 'var(--accent)' }}>→</span>
        </Link>

        <Link href="/admin" className="row mt-3 no-underline" style={{ minHeight: 72 }}>
          <div className="flex-1">
            <p className="font-semibold">관리자</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ink-2)' }}>선거관리위원 전용</p>
          </div>
          <span aria-hidden className="text-2xl" style={{ color: 'var(--ink-3)' }}>→</span>
        </Link>
      </div>
    </main>
  );
}
