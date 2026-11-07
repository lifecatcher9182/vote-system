'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Stat, Tabs, Badge, fmtTime } from '@/components/ui';

interface Stats { totalElections: number; activeElections: number; totalGroups: number; activeVillages: number; }
interface Group { id: string; title: string; group_type: 'delegate' | 'officer'; created_at: string; updated_at: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sort, setSort] = useState<'updated_at' | 'created_at'>('updated_at');

  useEffect(() => {
    const supabase = createClient();
    const count = async (table: string, filter?: [string, string]) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (filter) q = q.eq(filter[0], filter[1]);
      return (await q).count || 0;
    };
    Promise.all([
      count('elections'), count('elections', ['status', 'active']), count('election_groups'), count('villages', ['is_active', 'true']),
      supabase.from('election_groups').select('id, title, group_type, created_at, updated_at').limit(10),
    ]).then(([totalElections, activeElections, totalGroups, activeVillages, g]) => {
      setStats({ totalElections, activeElections, totalGroups, activeVillages });
      setGroups((g.data as Group[]) || []);
    });
  }, []);

  const recent = [...groups].sort((a, b) => new Date(b[sort]).getTime() - new Date(a[sort]).getTime()).slice(0, 5);

  return (
    <>
      <PageHead eyebrow="선거관리위원회" title="대시보드"
        actions={<Link href="/admin/election-groups/create" className="btn btn-primary">새 투표 그룹</Link>} />

      <div className="stats">
        <Stat label="투표 그룹" value={stats?.totalGroups ?? '–'} />
        <Stat label="전체 선거" value={stats?.totalElections ?? '–'} />
        <Stat label="진행 중" value={stats?.activeElections ?? '–'} accent />
        <Stat label="활성 마을" value={stats?.activeVillages ?? '–'} />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>최근 투표 그룹</h2>
          <Tabs value={sort} onChange={setSort} items={[{ value: 'updated_at', label: '최근 수정' }, { value: 'created_at', label: '최근 생성' }]} />
        </div>
        {recent.length === 0 ? (
          <p className="muted text-sm">아직 투표 그룹이 없습니다. 오른쪽 위에서 첫 그룹을 만드세요.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>제목</th><th>유형</th><th>{sort === 'updated_at' ? '수정' : '생성'}</th></tr></thead>
              <tbody>
                {recent.map((g) => (
                  <tr key={g.id} className="is-link" onClick={() => router.push(`/admin/election-groups/${g.id}`)}>
                    <td className="font-medium">{g.title}</td>
                    <td><Badge tone="plain">{g.group_type === 'delegate' ? '총대' : '임원'}</Badge></td>
                    <td className="muted">{fmtTime(g[sort])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>바로 가기</h2>
        <div className="choice">
          <Link href="/admin/election-groups" className="row"><strong>투표 그룹</strong><span>총대·임원 선거를 묶어 관리</span></Link>
          <Link href="/admin/codes" className="row"><strong>참여코드</strong><span>투표자에게 나눠줄 코드 발급</span></Link>
          <Link href="/admin/villages" className="row"><strong>마을</strong><span>총대 선출 단위 관리</span></Link>
          <Link href="/admin/settings" className="row"><strong>설정</strong><span>로고·색상·관리자 계정</span></Link>
        </div>
      </section>
    </>
  );
}
