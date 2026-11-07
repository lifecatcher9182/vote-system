'use client';

import { useState } from 'react';
import { Badge, Pager, type Tone } from '@/components/ui';

export interface CodeRow { id: string; code: string; label: string; tone?: Tone; }

// 참여코드 목록: 페이지, 복사, 개별/선택 삭제. 필터링은 부모가 한다.
export default function CodeList({ rows, onDelete, emptyText = '코드가 없습니다.' }: {
  rows: CodeRow[]; onDelete: (ids: string[]) => void; emptyText?: string;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const view = rows.slice((safePage - 1) * perPage, safePage * perPage);
  const allOnPage = view.length > 0 && view.every((r) => selected.includes(r.id));

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1200);
  };

  if (rows.length === 0) return <p className="muted text-sm py-6 text-center">{emptyText}</p>;

  return (
    <div className="table-wrap">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div className="flex items-center gap-2 text-sm muted">
          {rows.length}개
          {selecting ? (
            <>
              <button onClick={() => setSelected(allOnPage ? selected.filter((id) => !view.some((r) => r.id === id)) : [...new Set([...selected, ...view.map((r) => r.id)])])} className="btn btn-ghost btn-sm">
                {allOnPage ? '페이지 선택 해제' : '페이지 전체 선택'}
              </button>
              <button onClick={() => { onDelete(selected); setSelected([]); setSelecting(false); }} disabled={selected.length === 0} className="btn btn-danger btn-sm">
                선택 삭제 ({selected.length})
              </button>
              <button onClick={() => { setSelecting(false); setSelected([]); }} className="btn btn-ghost btn-sm">취소</button>
            </>
          ) : (
            <button onClick={() => setSelecting(true)} className="btn btn-ghost btn-sm">여러 개 삭제</button>
          )}
        </div>
        <div className="tabs" role="tablist">
          {[10, 30, 50].map((n) => <button key={n} role="tab" aria-selected={perPage === n} onClick={() => { setPerPage(n); setPage(1); }}>{n}개씩</button>)}
        </div>
      </div>
      <table className="table">
        <tbody>
          {view.map((r) => (
            <tr key={r.id}>
              {selecting && (
                <td style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.includes(r.id)} style={{ accentColor: 'var(--danger)' }}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id))} />
                </td>
              )}
              <td className="mono font-semibold text-base" style={{ width: 140 }}>{r.code}</td>
              <td><Badge tone={r.tone}>{r.label}</Badge></td>
              <td className="text-right whitespace-nowrap">
                {!selecting && (
                  <>
                    <button onClick={() => copy(r.code)} className="btn btn-ghost btn-sm">{copied === r.code ? '복사됨' : '복사'}</button>
                    <button onClick={() => onDelete([r.id])} className="btn btn-ghost btn-sm danger">삭제</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={safePage} total={totalPages} onChange={setPage} />
    </div>
  );
}
