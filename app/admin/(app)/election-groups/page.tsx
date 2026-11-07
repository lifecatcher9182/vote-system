'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Tabs, Badge, Empty, Pager, fmtDate } from '@/components/ui';

interface ElectionGroup {
  id: string; title: string; description: string | null;
  group_type: 'delegate' | 'officer'; status: 'waiting' | 'active' | 'closed';
  created_at: string; updated_at: string;
  election_count: number; active_elections: number;
}

type SortKey = 'date' | 'title' | 'type';
const PER_PAGE = 30;

export default function ElectionGroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<ElectionGroup[] | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'delegate' | 'officer'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('election_groups')
        .select('id, title, description, group_type, status, created_at, updated_at')
        .order('created_at', { ascending: false });
      const { data: elections } = await supabase.from('elections').select('id, status, group_id');
      setGroups((data || []).map((g) => {
        const mine = (elections || []).filter((e) => e.group_id === g.id);
        return { ...g, election_count: mine.length, active_elections: mine.filter((e) => e.status === 'active').length };
      }));
    })();
  }, []);

  const handleSort = (k: SortKey) => {
    if (sortBy === k) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(k); setSortOrder('desc'); }
    setPage(1);
  };
  const arrow = (k: SortKey) => sortBy === k ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  const filtered = (groups || [])
    .filter((g) => filterType === 'all' || g.group_type === filterType)
    .sort((a, b) => {
      const c = sortBy === 'date' ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : sortBy === 'title' ? a.title.localeCompare(b.title, 'ko') : a.group_type.localeCompare(b.group_type);
      return sortOrder === 'asc' ? c : -c;
    });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const rows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <>
      <PageHead eyebrow="선거 관리" title="투표 그룹" desc="총대 투표와 임원 투표를 그룹으로 묶어 관리합니다."
        actions={<Link href="/admin/election-groups/create" className="btn btn-primary">새 그룹</Link>} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={filterType} onChange={(v) => { setFilterType(v); setPage(1); }}
          items={[{ value: 'all', label: '전체' }, { value: 'delegate', label: '총대' }, { value: 'officer', label: '임원' }]} />
        <span className="text-sm muted">{filtered.length}개</span>
      </div>

      {groups === null ? (
        <div className="py-16 flex justify-center"><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <Empty title={filterType === 'all' ? '투표 그룹이 없습니다' : '조건에 맞는 그룹이 없습니다'}
          action={<Link href="/admin/election-groups/create" className="btn btn-primary">새 그룹 만들기</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('type')}>유형{arrow('type')}</th>
                <th className="sortable" onClick={() => handleSort('title')}>제목{arrow('title')}</th>
                <th>설명</th>
                <th className="num">선거</th>
                <th className="sortable" onClick={() => handleSort('date')}>생성일{arrow('date')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="is-link" onClick={() => router.push(`/admin/election-groups/${g.id}`)}>
                  <td><Badge tone="plain">{g.group_type === 'delegate' ? '총대' : '임원'}</Badge></td>
                  <td className="font-medium">{g.title}</td>
                  <td className="muted max-w-md truncate">{g.description || '–'}</td>
                  <td className="num">
                    {g.election_count}
                    {g.active_elections > 0 && <span className="ml-2 text-xs" style={{ color: 'var(--ok)' }}>진행 {g.active_elections}</span>}
                  </td>
                  <td className="muted">{fmtDate(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} total={totalPages} onChange={setPage} />
        </div>
      )}
    </>
  );
}
