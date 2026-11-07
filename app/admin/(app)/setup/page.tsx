'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Badge } from '@/components/ui';

interface Status { tablesExist: boolean; adminCount: number; error?: string; }

function Row({ ok, label, children }: { ok: boolean | null; label: string; children?: React.ReactNode }) {
  return (
    <div className="py-4 flex gap-4 items-start" style={{ borderBottom: '1px solid var(--rule)' }}>
      <Badge tone={ok === null ? undefined : ok ? 'ok' : 'danger'}>{ok === null ? '확인 중' : ok ? '완료' : '필요'}</Badge>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        {children && <div className="text-sm muted mt-1">{children}</div>}
      </div>
    </div>
  );
}

export default function SetupCheckPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('https://', '').split('.')[0];

  const check = useCallback(async () => {
    const { count, error } = await createClient().from('admin_emails').select('*', { count: 'exact', head: true });
    setStatus(error ? { tablesExist: false, adminCount: 0, error: error.message } : { tablesExist: true, adminCount: count || 0 });
  }, []);
  useEffect(() => { check(); }, [check]);

  return (
    <>
      <PageHead eyebrow="환경" title="설치 점검" desc="처음 배포했을 때 한 번 확인하는 화면입니다."
        actions={<button onClick={() => { setStatus(null); check(); }} className="btn btn-secondary">다시 확인</button>} />

      <div className="panel max-w-2xl">
        <Row ok={true} label="Supabase 연결">{process.env.NEXT_PUBLIC_SUPABASE_URL}</Row>
        <Row ok={status ? status.tablesExist : null} label="데이터베이스 테이블">
          {status && !status.tablesExist && (
            <>
              SQL Editor 에서 <code>supabase-schema.sql</code> 과 <code>migrations/</code> 의 파일을 순서대로 실행하세요.
              {ref && <> <a className="underline" href={`https://supabase.com/dashboard/project/${ref}/sql`} target="_blank" rel="noreferrer">SQL Editor 열기</a></>}
              {status.error && <p className="mt-1 text-xs faint">{status.error}</p>}
            </>
          )}
        </Row>
        <Row ok={status ? status.adminCount > 0 : null} label="관리자 이메일 등록">
          {status?.tablesExist && status.adminCount === 0 ? (
            <pre className="mt-2 p-3 rounded-md text-xs" style={{ background: 'var(--paper-2)' }}>{`insert into admin_emails (email) values ('your-email@gmail.com');`}</pre>
          ) : status ? `${status.adminCount}개 계정` : null}
        </Row>
        <Row ok={null} label="Google 로그인">
          Supabase 대시보드의 Authentication → Providers 에서 Google 을 켜고, Google Cloud Console 의 리디렉션 URI 에
          {ref && <code className="mx-1">https://{ref}.supabase.co/auth/v1/callback</code>}
          을 등록하세요. 자세한 절차는 <code>docs/GOOGLE_LOGIN_SETUP.md</code> 에 있습니다.
        </Row>
        <div className="flex gap-2 mt-5">
          <Link href="/admin/dashboard" className="btn btn-primary">대시보드로</Link>
        </div>
      </div>
    </>
  );
}
