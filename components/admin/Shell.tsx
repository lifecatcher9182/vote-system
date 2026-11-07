'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAdminAccess, signOut } from '@/lib/auth';
import SystemLogo from '@/components/SystemLogo';
import { useSystemConfig } from '@/lib/hooks/useSystemConfig';

const AdminCtx = createContext<{ email: string }>({ email: '' });
export const useAdmin = () => useContext(AdminCtx);

const NAV = [
  { href: '/admin/dashboard', label: '대시보드' },
  { href: '/admin/election-groups', label: '투표 그룹' },
  { href: '/admin/elections', label: '선거' },
  { href: '/admin/codes', label: '참여코드' },
  { href: '/admin/villages', label: '마을' },
  { href: '/admin/settings', label: '설정' },
];

// 관리자 화면 공통 틀. 인증은 여기서 한 번만 확인한다.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { systemName } = useSystemConfig();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) { router.replace('/admin'); return; }
      const { isAdmin } = await checkAdminAccess(user.email!);
      if (!isAdmin) { await signOut(); router.replace('/admin'); return; }
      if (alive) setEmail(user.email!);
    })();
    return () => { alive = false; };
  }, [router]);

  useEffect(() => { setOpen(false); }, [pathname]);

  if (email === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="spinner" aria-label="확인 중" />
      </div>
    );
  }

  const logout = async () => { await signOut(); router.replace('/admin'); };
  const nav = (
    <>
      <div className="brand">
        <SystemLogo size="sm" />
        <strong>{systemName}</strong>
      </div>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="nav-link" aria-current={pathname.startsWith(n.href) ? 'page' : undefined}>
          {n.label}
        </Link>
      ))}
      <div className="foot">
        <div>{email}</div>
        <div className="mt-2 flex gap-3">
          <Link href="/" className="underline">투표 화면</Link>
          <button onClick={logout} className="underline">로그아웃</button>
        </div>
      </div>
    </>
  );

  return (
    <AdminCtx.Provider value={{ email }}>
      <div className="shell">
        <aside className={`sidebar${open ? ' is-open' : ''}`}>{nav}</aside>
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <div className="min-w-0">
          <div className="topbar">
            <button onClick={() => setOpen(true)} className="btn btn-ghost btn-sm" aria-label="메뉴 열기">메뉴</button>
            <strong className="text-sm truncate">{systemName}</strong>
            <button onClick={logout} className="btn btn-ghost btn-sm">로그아웃</button>
          </div>
          <main className="content">{children}</main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
