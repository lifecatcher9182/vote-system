'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Tabs, StatusBadge, Empty, fmtDate } from '@/components/ui';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface Election {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null;
  max_selections: number; round: number; status: 'waiting' | 'active' | 'closed'; created_at: string;
  villages?: { name: string } | null;
}

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [alert, setAlert] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = createClient().from('elections').select('*, villages ( name )').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) { console.error(error); return; }
    setElections((data as Election[]) || []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await createClient().from('elections').delete().eq('id', toDelete);
    if (error) { setAlert('선거 삭제에 실패했습니다.'); return; }
    load();
  };

  return (
    <>
      <PageHead eyebrow="선거 관리" title="선거" desc="모든 선거를 한 곳에서 봅니다. 상태 변경과 후보 관리는 각 선거 페이지에서 합니다."
        actions={<Link href="/admin/elections/create" className="btn btn-primary">새 선거</Link>} />

      <div className="mb-4">
        <Tabs value={filter} onChange={setFilter} items={[{ value: 'all', label: '전체' }, { value: 'active', label: '진행중' }, { value: 'closed', label: '종료' }]} />
      </div>

      {elections === null ? (
        <div className="py-16 flex justify-center"><span className="spinner" /></div>
      ) : elections.length === 0 ? (
        <Empty title="선거가 없습니다" desc="투표 그룹에서 일괄 생성하거나 새 선거를 만드세요."
          action={<Link href="/admin/elections/create" className="btn btn-primary">새 선거</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>제목</th><th>유형</th><th>대상</th><th className="num">차수</th><th>상태</th><th>생성일</th><th></th></tr>
            </thead>
            <tbody>
              {elections.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium"><Link href={`/admin/elections/${e.id}`} className="hover:underline">{e.title}</Link></td>
                  <td className="muted">{e.election_type === 'delegate' ? '총대' : '임원'}</td>
                  <td className="muted">{e.election_type === 'delegate' ? e.villages?.name || '–' : e.position || '–'}</td>
                  <td className="num">{e.round}차</td>
                  <td><StatusBadge status={e.status} /></td>
                  <td className="muted">{fmtDate(e.created_at)}</td>
                  <td className="text-right whitespace-nowrap">
                    <Link href={`/admin/elections/${e.id}/monitor`} className="btn btn-ghost btn-sm">모니터</Link>
                    <Link href={`/admin/elections/${e.id}/results`} className="btn btn-ghost btn-sm">결과</Link>
                    <button onClick={() => setToDelete(e.id)} className="btn btn-ghost btn-sm danger">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="오류" />
      <ConfirmModal isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} variant="danger" title="선거 삭제"
        message="이 선거를 삭제하시겠습니까? 후보와 투표 기록이 함께 삭제됩니다." confirmText="삭제" />
    </>
  );
}
