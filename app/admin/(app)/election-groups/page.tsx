'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Badge, Empty, fmtDate } from '@/components/ui';

interface Round {
  id: string; title: string; description: string | null; group_type: string; status: string; created_at: string;
  officers: number; delegates: number; villages: number;
}

export default function RoundsPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: gs }, { data: es }, { data: vs }] = await Promise.all([
        supabase.from('election_groups').select('id, title, description, group_type, status, created_at').order('created_at', { ascending: false }),
        supabase.from('elections').select('id, election_type, group_id'),
        supabase.from('villages').select('id, group_id'),
      ]);
      setRounds((gs || []).map((g) => ({
        ...g,
        officers: (es || []).filter((e) => e.group_id === g.id && e.election_type === 'officer').length,
        delegates: (es || []).filter((e) => e.group_id === g.id && e.election_type === 'delegate').length,
        villages: (vs || []).filter((v) => v.group_id === g.id).length,
      })));
    })();
  }, []);

  return (
    <>
      <PageHead eyebrow="선거 관리" title="회차" desc="회차 하나가 한 번의 선거입니다. 마을·직책·선거·참여코드·결과가 회차 안에 모두 남습니다."
        actions={<Link href="/admin/election-groups/create" className="btn btn-primary">새 회차</Link>} />

      {rounds === null ? (
        <div className="py-16 flex justify-center"><span className="spinner" /></div>
      ) : rounds.length === 0 ? (
        <Empty title="회차가 없습니다" action={<Link href="/admin/election-groups/create" className="btn btn-primary">첫 회차 만들기</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>회차</th><th>상태</th><th className="num">임원 선거</th><th className="num">총대 선거</th><th className="num">마을</th><th>생성일</th></tr></thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id} className="is-link" onClick={() => router.push(`/admin/election-groups/${r.id}`)}>
                  <td>
                    <div className="font-medium">{r.title}</div>
                    {r.description && <div className="text-xs muted mt-0.5 truncate max-w-md">{r.description}</div>}
                  </td>
                  <td>{r.status === 'closed' ? <Badge>보관</Badge> : <Badge tone="ok">진행 중</Badge>}</td>
                  <td className="num">{r.officers}</td>
                  <td className="num">{r.delegates}</td>
                  <td className="num">{r.villages || (r.group_type === 'delegate' ? '–' : 0)}</td>
                  <td className="muted">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
