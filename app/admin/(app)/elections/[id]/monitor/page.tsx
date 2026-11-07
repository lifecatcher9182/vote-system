'use client';

import { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Stat, StatusBadge, Badge, fmtTime } from '@/components/ui';

interface Election {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null;
  max_selections: number; round: number; status: string; villages?: { name: string } | null;
}
interface Candidate { id: string; name: string; vote_count: number; }
interface VoteStats { totalCodes: number; usedCodes: number; totalVotes: number; }

// 동점은 같은 순위
const rankOf = (list: Candidate[], i: number) => list.slice(0, i).filter((c) => c.vote_count > list[i].vote_count).length + 1;

export default function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<VoteStats>({ totalCodes: 0, usedCodes: 0, totalVotes: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: codes }, { data: votes }] = await Promise.all([
      supabase.from('candidates').select('id, name, vote_count').eq('election_id', id).order('vote_count', { ascending: false }),
      supabase.from('voter_codes').select('id, is_used').contains('accessible_elections', [id]),
      supabase.from('votes').select('id').eq('election_id', id),
    ]);
    setCandidates(c || []);
    setStats({ totalCodes: codes?.length || 0, usedCodes: codes?.filter((x) => x.is_used).length || 0, totalVotes: votes?.length || 0 });
    setLastUpdate(new Date());
  }, [id]);

  useEffect(() => {
    createClient().from('elections').select('*, villages ( name )').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { router.replace('/admin/elections'); return; }
      setElection(data as Election);
    });
    refresh();
  }, [id, router, refresh]);

  if (!election) return <div className="py-16 flex justify-center"><span className="spinner" /></div>;

  const max = Math.max(...candidates.map((c) => c.vote_count), 1);
  const rate = stats.totalCodes > 0 ? (stats.usedCodes / stats.totalCodes) * 100 : 0;
  const leaders = candidates.slice(0, Math.min(election.max_selections, candidates.length)).filter((c) => c.vote_count > 0);

  return (
    <>
      <PageHead eyebrow={`${election.election_type === 'delegate' ? '총대' : '임원'} · ${election.round}차`}
        title={<span className="flex items-center gap-3 flex-wrap">{election.title} <StatusBadge status={election.status} /></span>}
        desc={lastUpdate ? `마지막 갱신 ${fmtTime(lastUpdate)}` : undefined}
        actions={
          <>
            <button onClick={refresh} className="btn btn-primary">새로고침</button>
            <Link href={`/admin/elections/${election.id}/results`} className="btn btn-secondary">결과</Link>
            <Link href={`/admin/elections/${election.id}`} className="btn btn-secondary">선거 관리</Link>
          </>
        } />

      {election.status !== 'active' && (
        <p className="notice mb-6">이 선거는 지금 {election.status === 'closed' ? '종료' : '대기'} 상태입니다. 투표가 들어오지 않습니다.</p>
      )}

      <div className="stats">
        <Stat label="발급 코드" value={stats.totalCodes} />
        <Stat label="투표 완료" value={stats.usedCodes} accent />
        <Stat label="미투표" value={stats.totalCodes - stats.usedCodes} />
        <Stat label="투표율" value={`${rate.toFixed(1)}%`} />
        <Stat label="총 표수" value={stats.totalVotes} />
      </div>

      {leaders.length > 0 && (
        <section className="section">
          <h2>{election.max_selections === 1 ? '현재 1위' : `현재 당선권 (상위 ${election.max_selections}명)`}</h2>
          <div className="flex flex-wrap gap-2">
            {leaders.map((c, i) => (
              <Badge key={c.id} tone="accent">{rankOf(leaders, i)}위 {c.name} · {c.vote_count}표</Badge>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>후보별 득표</h2>
        {candidates.length === 0 ? <p className="muted text-sm">후보가 없습니다.</p> : (
          <div className="panel">
            {candidates.map((c, i) => {
              const pct = stats.totalVotes > 0 ? (c.vote_count / stats.totalVotes) * 100 : 0;
              return (
                <div key={c.id} className="py-3" style={{ borderBottom: i < candidates.length - 1 ? '1px solid var(--rule)' : undefined }}>
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <span className="text-sm"><span className="faint mr-2">{rankOf(candidates, i)}</span><strong>{c.name}</strong></span>
                    <span className="text-sm whitespace-nowrap"><strong className="text-lg">{c.vote_count}</strong>표 <span className="faint">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="bar"><i style={{ width: `${(c.vote_count / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
