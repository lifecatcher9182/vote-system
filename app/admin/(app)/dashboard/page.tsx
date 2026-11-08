'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Stat, Badge, StatusBadge, Empty, fmtDate } from '@/components/ui';

interface Group { id: string; title: string; status: string; created_at: string; }
interface Election { id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null; status: string; round: number; group_id: string | null; villages?: { name: string } | null; voters: number; }

export default function AdminDashboard() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [codes, setCodes] = useState<{ total: number; used: number }>({ total: 0, used: 0 });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: gs } = await supabase.from('election_groups').select('id, title, status, created_at').order('created_at', { ascending: false });
      const list = (gs || []) as Group[];
      setGroups(list);
      const current = list.find((g) => g.status !== 'closed');
      if (!current) return;
      const [{ data: es }, { data: cs }] = await Promise.all([
        supabase.from('elections').select('id, title, election_type, position, status, round, group_id, villages ( name )').eq('group_id', current.id).order('created_at'),
        supabase.from('voter_codes').select('id, is_used').eq('group_id', current.id),
      ]);
      const ids = (es || []).map((e) => e.id);
      const { data: votes } = ids.length ? await supabase.from('votes').select('election_id, voter_code_id').in('election_id', ids) : { data: [] };
      setElections(((es || []) as unknown as Omit<Election, 'voters'>[]).map((e) => ({
        ...e, voters: new Set((votes || []).filter((v) => v.election_id === e.id).map((v) => v.voter_code_id)).size,
      })));
      setCodes({ total: cs?.length || 0, used: cs?.filter((c) => c.is_used).length || 0 });
    })();
  }, []);

  if (groups === null) return <div className="py-16 flex justify-center"><span className="spinner" /></div>;

  const current = groups.find((g) => g.status !== 'closed');
  const past = groups.filter((g) => g !== current);
  const officers = elections.filter((e) => e.election_type === 'officer');
  const delegates = elections.filter((e) => e.election_type === 'delegate');

  return (
    <>
      <PageHead eyebrow="선거관리위원회" title="대시보드"
        actions={<Link href="/admin/election-groups/create" className="btn btn-primary">새 회차</Link>} />

      {!current ? (
        <Empty title="진행 중인 회차가 없습니다" desc="새 회차를 만들면 이 자리에 이번 선거 현황이 보입니다."
          action={<Link href="/admin/election-groups/create" className="btn btn-primary">새 회차 만들기</Link>} />
      ) : (
        <>
          <section className="panel">
            <div className="section-head">
              <h2 className="flex items-center gap-3 flex-wrap">{current.title} <Badge tone="ok">진행 중</Badge></h2>
              <Link href={`/admin/election-groups/${current.id}`} className="btn btn-secondary btn-sm">회차 관리</Link>
            </div>
            <div className="stats">
              <Stat label="임원 선거" value={officers.length} hint={`진행 ${officers.filter((e) => e.status === 'active').length} · 종료 ${officers.filter((e) => e.status === 'closed').length}`} />
              <Stat label="총대 선거" value={delegates.length} hint={`진행 ${delegates.filter((e) => e.status === 'active').length} · 종료 ${delegates.filter((e) => e.status === 'closed').length}`} />
              <Stat label="임원 참여코드" value={codes.total} hint={`투표 완료 ${codes.used}`} accent />
            </div>
          </section>

          {elections.length > 0 && (
            <section className="section">
              <h2>선거 현황</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>선거</th><th>구분</th><th className="num">차수</th><th className="num">투표자</th><th>상태</th><th></th></tr></thead>
                  <tbody>
                    {elections.map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium"><Link href={`/admin/elections/${e.id}`} className="hover:underline">{e.title}</Link></td>
                        <td className="muted">{e.election_type === 'officer' ? `임원 · ${e.position ?? ''}` : `총대 · ${e.villages?.name ?? ''}`}</td>
                        <td className="num">{e.round}차</td>
                        <td className="num">{e.voters}</td>
                        <td><StatusBadge status={e.status} /></td>
                        <td className="text-right whitespace-nowrap">
                          <Link href={`/admin/elections/${e.id}/monitor`} className="btn btn-ghost btn-sm">모니터</Link>
                          <Link href={`/admin/elections/${e.id}/results`} className="btn btn-ghost btn-sm">결과</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {past.length > 0 && (
        <section className="section">
          <h2>지난 회차</h2>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {past.map((g) => (
                  <tr key={g.id} className="is-link" onClick={() => router.push(`/admin/election-groups/${g.id}`)}>
                    <td className="font-medium">{g.title}</td>
                    <td><StatusBadge status={g.status === 'closed' ? 'closed' : g.status} /></td>
                    <td className="muted text-right">{fmtDate(g.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
