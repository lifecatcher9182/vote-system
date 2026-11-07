'use client';

import { useEffect } from 'react';

// 관리자 화면 공용 조각. 스타일은 globals.css 의 클래스가 전부다.

export function PageHead({ eyebrow, title, desc, actions }: {
  eyebrow?: string; title: React.ReactNode; desc?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {desc && <p className="desc">{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`stat${accent ? ' is-accent' : ''}`}>
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {hint && <div className="h">{hint}</div>}
    </div>
  );
}

export type Tone = 'ok' | 'warn' | 'danger' | 'accent' | 'plain' | undefined;
export function Badge({ tone, children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`badge${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  waiting: { label: '대기', tone: undefined },
  registering: { label: '진행중', tone: 'ok' },
  active: { label: '진행중', tone: 'ok' },
  closed: { label: '종료', tone: 'danger' },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.waiting;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Tabs<T extends string>({ value, onChange, items }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)}>{i.label}</button>
      ))}
    </div>
  );
}

export function Field({ label, required, hint, children, htmlFor }: {
  label: React.ReactNode; required?: boolean; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>{label}{required && <span className="req">*</span>}</label>
      {children}
      {hint && <p className="help">{hint}</p>}
    </div>
  );
}

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
      {desc && <p className="mt-1 text-sm">{desc}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, size }: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; size?: 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className={`modal${size === 'lg' ? ' lg' : ''}`} role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === total || Math.abs(p - page) <= 2);
  return (
    <div className="pager">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}>이전</button>
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - pages[i - 1] > 1 && <span className="faint px-1">…</span>}
          <button onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}>{p}</button>
        </span>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === total}>다음</button>
    </div>
  );
}

export const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
export const fmtTime = (s: string | Date) => new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
