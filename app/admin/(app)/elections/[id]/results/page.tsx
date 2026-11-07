'use client';

import { requiredVotes as calcRequired } from '@/lib/election';
import { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { WinningCriteria } from '@/lib/database.types';
import { PageHead, Stat, StatusBadge, Badge } from '@/components/ui';

interface Election {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null;
  max_selections: number; round: number; status: string; winning_criteria: WinningCriteria;
  villages?: { name: string } | null;
}
interface Candidate { id: string; name: string; vote_count: number; }
interface VoteStats { totalCodes: number; attendedCodes: number; totalVotes: number; uniqueVoters: number; }
interface VillageStat { villageName: string; codesCount: number; usedCount: number; participationRate: number; }

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<VoteStats>({ totalCodes: 0, attendedCodes: 0, totalVotes: 0, uniqueVoters: 0 });
  const [villageStats, setVillageStats] = useState<VillageStat[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: e, error } = await supabase.from('elections').select('*, villages ( name )').eq('id', id).single();
    if (error || !e) { router.replace('/admin/elections'); return; }
    setElection(e as Election);

    const [{ data: c }, { data: codes }, { data: votes }, { data: villages }] = await Promise.all([
      supabase.from('candidates').select('id, name, vote_count').eq('election_id', id).order('vote_count', { ascending: false }),
      supabase.from('voter_codes').select('id, first_login_at, is_used, village_id').contains('accessible_elections', [id]),
      supabase.from('votes').select('voter_code_id').eq('election_id', id),
      supabase.from('villages').select('id, name'),
    ]);
    setCandidates(c || []);
    setStats({
      totalCodes: codes?.length || 0,
      attendedCodes: codes?.filter((x) => x.first_login_at !== null).length || 0,
      totalVotes: votes?.length || 0,
      uniqueVoters: new Set((votes || []).map((v) => v.voter_code_id)).size,
    });
    setVillageStats((villages || []).map((v) => {
      const mine = (codes || []).filter((x) => x.village_id === v.id);
      const used = mine.filter((x) => x.is_used).length;
      return { villageName: v.name, codesCount: mine.length, usedCount: used, participationRate: mine.length ? (used / mine.length) * 100 : 0 };
    }).filter((v) => v.codesCount > 0).sort((a, b) => b.participationRate - a.participationRate));
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (!election) return <div className="py-16 flex justify-center"><span className="spinner" /></div>;

  // ---- 당선 판정 (기존 알고리즘 그대로) ----
  const maxVotes = Math.max(...candidates.map((c) => c.vote_count), 1);
  const candidatesWithVotes = candidates.filter((c) => c.vote_count > 0);
  const criteria = election.winning_criteria;
  let requiredVotes = 0, thresholdMessage = '', meetsThreshold = false;
  if (candidatesWithVotes.length > 0) {
    if (criteria.type === 'plurality') { thresholdMessage = '최다 득표'; meetsThreshold = true; }
    else if (criteria.type === 'absolute_majority') {
      const base = stats.attendedCodes > 0 ? stats.attendedCodes : stats.totalCodes;
      requiredVotes = Math.floor(base / 2) + 1;
      thresholdMessage = `${base}명의 과반 (${requiredVotes}표 이상)`;
      meetsThreshold = candidatesWithVotes[0].vote_count > Math.floor(base / 2);
    } else if (criteria.type === 'percentage') {
      const base = criteria.base === 'attended' ? (stats.attendedCodes > 0 ? stats.attendedCodes : stats.totalCodes) : stats.totalCodes;
      requiredVotes = calcRequired(base, criteria.percentage);
      thresholdMessage = `${criteria.base === 'attended' ? '참석자' : '발급 코드'} ${base}명의 ${criteria.percentage}% (${requiredVotes}표 이상)`;
      meetsThreshold = candidatesWithVotes[0].vote_count >= requiredVotes;
    }
  }
  let winners: Candidate[] = [], confirmed: Candidate[] = [], tied: Candidate[] = [], hasTie = false;
  if (candidatesWithVotes.length > 0 && (meetsThreshold || criteria.type === 'plurality')) {
    if (candidatesWithVotes.length >= election.max_selections) {
      const cutoff = candidatesWithVotes[election.max_selections - 1].vote_count;
      if (candidatesWithVotes.filter((c) => c.vote_count >= cutoff).length > election.max_selections) {
        hasTie = true;
        confirmed = candidatesWithVotes.filter((c) => c.vote_count > cutoff);
        tied = candidatesWithVotes.filter((c) => c.vote_count === cutoff);
        winners = [...confirmed, ...tied];
      } else { winners = candidatesWithVotes.slice(0, election.max_selections); confirmed = winners; }
    } else { winners = candidatesWithVotes; confirmed = winners; }
  }
  const noWinner = candidatesWithVotes.length === 0 || (!meetsThreshold && criteria.type !== 'plurality');
  const rankOf = (i: number) => candidates.slice(0, i).filter((c) => c.vote_count > candidates[i].vote_count).length + 1;

  return (
    <>
      <PageHead eyebrow={`${election.election_type === 'delegate' ? `총대 · ${election.villages?.name ?? ''}` : `임원 · ${election.position ?? ''}`} · ${election.round}차`}
        title={<span className="flex items-center gap-3 flex-wrap">{election.title} <StatusBadge status={election.status} /></span>}
        desc={<>당선 기준: {thresholdMessage || '–'} · 선출 {election.max_selections}명</>}
        actions={
          <>
            <Link href={`/admin/elections/${election.id}/monitor`} className="btn btn-secondary">모니터</Link>
            <Link href={`/admin/elections/${election.id}`} className="btn btn-secondary">선거 관리</Link>
          </>
        } />

      <div className="stats">
        <Stat label="발급 코드" value={stats.totalCodes} />
        <Stat label="참석 확인" value={stats.attendedCodes} hint={stats.totalCodes ? `${((stats.attendedCodes / stats.totalCodes) * 100).toFixed(1)}%` : undefined} />
        <Stat label="투표 완료" value={stats.uniqueVoters} accent hint={stats.attendedCodes ? `참석자의 ${((stats.uniqueVoters / stats.attendedCodes) * 100).toFixed(1)}%` : undefined} />
        <Stat label="미참석" value={stats.totalCodes - stats.attendedCodes} />
        <Stat label="총 표수" value={stats.totalVotes} />
      </div>

      <section className="section">
        {noWinner ? (
          <div className="panel" style={{ borderColor: 'color-mix(in oklch, var(--danger) 40%, transparent)' }}>
            <h2>당선자 없음</h2>
            <p className="text-sm muted">
              {candidatesWithVotes.length === 0 ? '아직 득표한 후보가 없습니다.' : <>기준({thresholdMessage})에 미달했습니다. {election.round === 1 ? '2차 투표를 진행하거나' : election.round === 2 ? '3차 투표(최다득표)를 진행하거나' : ''} 규정에 따라 결정해 주세요.</>}
            </p>
          </div>
        ) : (
          <div className="panel" style={{ borderColor: hasTie ? 'color-mix(in oklch, var(--warn) 60%, transparent)' : 'color-mix(in oklch, var(--ok) 50%, transparent)' }}>
            <h2>{hasTie ? '동점 발생' : election.max_selections === 1 ? '당선자' : `당선자 (${election.max_selections}명)`}</h2>
            {hasTie && (
              <p className="text-sm muted mb-3">
                {election.max_selections}명을 뽑아야 하는데 {tied[0]?.vote_count}표 동점인 후보가 {tied.length}명입니다.
                확정 {confirmed.length}명, 남은 자리 {election.max_selections - confirmed.length}명. {election.round > 1 ? '이미 결선입니다.' : '결선 투표를 진행하거나'} 규정에 따라 결정해 주세요.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {confirmed.map((c) => <Badge key={c.id} tone="ok">{c.name} · {c.vote_count}표</Badge>)}
              {tied.map((c) => <Badge key={c.id} tone="warn">미확정 {c.name} · {c.vote_count}표</Badge>)}
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2>전체 득표</h2>
        {candidates.length === 0 ? <p className="muted text-sm">후보가 없습니다.</p> : (
          <div className="panel">
            {candidates.map((c, i) => {
              const isWin = confirmed.some((w) => w.id === c.id);
              const isTied = tied.some((t) => t.id === c.id);
              const pct = stats.totalVotes > 0 ? (c.vote_count / stats.totalVotes) * 100 : 0;
              return (
                <div key={c.id} className="py-3" style={{ borderBottom: i < candidates.length - 1 ? '1px solid var(--rule)' : undefined }}>
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <span className="text-sm flex items-center gap-2">
                      <span className="faint">{isTied ? '?' : rankOf(i)}</span><strong>{c.name}</strong>
                      {isWin && <Badge tone="ok">당선</Badge>}{isTied && <Badge tone="warn">미확정</Badge>}
                    </span>
                    <span className="text-sm whitespace-nowrap"><strong className="text-lg">{c.vote_count}</strong>표 <span className="faint">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className={`bar${isWin ? ' ok' : ''}`}><i style={{ width: `${(c.vote_count / maxVotes) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {election.election_type === 'delegate' && villageStats.length > 0 && (
        <section className="section">
          <h2>마을별 투표율</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>마을</th><th className="num">투표 / 발급</th><th className="num">투표율</th></tr></thead>
              <tbody>
                {villageStats.map((v) => (
                  <tr key={v.villageName}>
                    <td className="font-medium">{v.villageName}</td>
                    <td className="num">{v.usedCount} / {v.codesCount}</td>
                    <td className="num">{v.participationRate.toFixed(1)}%</td>
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
