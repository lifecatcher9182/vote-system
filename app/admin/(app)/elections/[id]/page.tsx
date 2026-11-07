'use client';

import { requiredVotes as calcRequired } from '@/lib/election';
import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { insertCodes } from '@/lib/codes';
import { PageHead, Stat, Tabs, Badge, StatusBadge, Modal, Field, fmtTime } from '@/components/ui';
import CodeList, { type CodeRow } from '@/components/admin/CodeList';
import QRCodeSection from '@/components/QRCodeSection';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface Election {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null; village_id: string | null;
  max_selections: number; round: number; status: 'waiting' | 'active' | 'closed'; created_at: string; group_id: string | null;
  winning_criteria: { type: 'plurality' | 'absolute_majority' | 'percentage'; percentage?: number; base?: 'attended' | 'total_codes' };
  villages?: { name: string } | null;
}
interface Candidate { id: string; name: string; vote_count: number; }
interface Note { id: string; content: string; created_by: string | null; created_at: string; updated_at: string; }
interface VoterCode { id: string; code: string; is_used: boolean; first_login_at: string | null; has_voted: boolean; }
interface ResultStats { totalCodes: number; attendedCodes: number; totalVotes: number; abstainCount: number; uniqueVoters: number; }
type Tab = 'overview' | 'codes' | 'results';
type CodeFilter = 'all' | 'voted' | 'attended' | 'not_attended';
type Confirm = { title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' };

export default function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [newCandidate, setNewCandidate] = useState('');

  const [voterCodes, setVoterCodes] = useState<VoterCode[]>([]);
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all');
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeQty, setCodeQty] = useState(10);
  const [generating, setGenerating] = useState(false);

  const [stats, setStats] = useState<ResultStats>({ totalCodes: 0, attendedCodes: 0, totalVotes: 0, abstainCount: 0, uniqueVoters: 0 });
  const [thresholds, setThresholds] = useState<{ id: string; percentage: number; label: string }[]>([]);
  const [showThreshold, setShowThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState({ percentage: '', label: '' });

  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<{ id: string; content: string } | null>(null);

  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const loadElection = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('elections').select('*, villages ( name )').eq('id', id).single();
    if (error || !data) { router.replace('/admin/elections'); return; }
    setElection(data as Election);
    setThresholds(data.election_type === 'officer'
      ? [{ id: '1', percentage: 66.67, label: '2/3' }]
      : [{ id: '1', percentage: 50, label: '과반수' }, { id: '2', percentage: 66.67, label: '2/3' }]);
    const { data: c } = await supabase.from('candidates').select('id, name, vote_count').eq('election_id', id).order('name');
    setCandidates(c || []);
  }, [id, router]);

  const loadVoterCodes = useCallback(async () => {
    if (!election) return;
    const supabase = createClient();
    let q = supabase.from('voter_codes').select('id, code, is_used, first_login_at').contains('accessible_elections', [election.id]).eq('group_id', election.group_id);
    if (election.election_type === 'delegate' && election.village_id) q = q.eq('village_id', election.village_id);
    const { data: codes } = await q.order('created_at', { ascending: false });
    const ids = (codes || []).map((c) => c.id);
    let voted = new Set<string>();
    if (ids.length) {
      const { data: votes } = await supabase.from('votes').select('voter_code_id').eq('election_id', election.id).in('voter_code_id', ids);
      voted = new Set((votes || []).map((v) => v.voter_code_id));
    }
    setVoterCodes((codes || []).map((c) => ({ ...c, has_voted: voted.has(c.id) })));
  }, [election]);

  const loadStats = useCallback(async () => {
    if (!election) return;
    const supabase = createClient();
    let q = supabase.from('voter_codes').select('id, first_login_at').contains('accessible_elections', [election.id]);
    if (election.election_type === 'officer' && election.group_id) q = q.eq('group_id', election.group_id);
    if (election.election_type === 'delegate' && election.village_id) q = q.eq('village_id', election.village_id);
    const [{ data: codes }, { data: votes }] = await Promise.all([q, supabase.from('votes').select('voter_code_id, is_abstain').eq('election_id', election.id)]);
    setStats({
      totalCodes: codes?.length || 0,
      attendedCodes: codes?.filter((c) => c.first_login_at !== null).length || 0,
      totalVotes: votes?.length || 0,
      abstainCount: votes?.filter((v) => v.is_abstain === true).length || 0,
      uniqueVoters: new Set((votes || []).map((v) => v.voter_code_id)).size,
    });
  }, [election]);

  const loadNotes = useCallback(async () => {
    if (!election) return;
    const { data } = await createClient().from('election_notes').select('id, content, created_by, created_at, updated_at').eq('election_id', election.id).order('created_at', { ascending: false });
    setNotes(data || []);
  }, [election]);

  useEffect(() => { loadElection(); }, [loadElection]);
  useEffect(() => { if (tab === 'codes') loadVoterCodes(); }, [tab, loadVoterCodes]);
  useEffect(() => { if (tab === 'results') { loadStats(); loadNotes(); } }, [tab, loadStats, loadNotes]);

  const setStatus = async (status: Election['status']) => {
    if (!election) return;
    const { error } = await createClient().from('elections').update({ status, updated_at: new Date().toISOString() }).eq('id', election.id);
    if (error) { setAlert({ title: '오류', message: '상태 변경에 실패했습니다.' }); return; }
    setElection({ ...election, status });
  };

  const addCandidate = async () => {
    if (!newCandidate.trim()) return;
    const { error } = await createClient().from('candidates').insert([{ election_id: id, name: newCandidate.trim(), vote_count: 0 }]);
    if (error) { setAlert({ title: '오류', message: '후보 추가에 실패했습니다.' }); return; }
    setNewCandidate('');
    loadElection();
  };

  const deleteCandidate = (c: Candidate) => setConfirm({
    title: '후보 삭제', variant: 'danger', message: `${c.name} 후보를 삭제하시겠습니까?`,
    onConfirm: async () => {
      const { error } = await createClient().from('candidates').delete().eq('id', c.id);
      if (error) { setAlert({ title: '오류', message: '후보 삭제에 실패했습니다.' }); return; }
      loadElection();
    },
  });

  const generateCodes = async () => {
    if (!election) return;
    if (codeQty < 1 || codeQty > 100) { setAlert({ title: '입력 오류', message: '코드는 1~100개까지 생성할 수 있습니다.' }); return; }
    setGenerating(true);
    const err = await insertCodes(codeQty, { code_type: 'delegate', accessible_elections: [election.id], village_id: election.village_id, group_id: election.group_id });
    setGenerating(false);
    if (err) { setAlert({ title: '생성 실패', message: err }); return; }
    setShowCodeModal(false); setCodeQty(10);
    loadVoterCodes();
  };

  const deleteCodes = (ids: string[]) => setConfirm({
    title: '코드 삭제', variant: 'danger',
    message: ids.length === 1 ? '이 코드를 삭제하시겠습니까?' : `선택한 ${ids.length}개 코드를 삭제하시겠습니까? 관련 투표 기록도 함께 삭제됩니다.`,
    onConfirm: async () => {
      const { error } = await createClient().from('voter_codes').delete().in('id', ids);
      if (error) { setAlert({ title: '오류', message: '코드 삭제에 실패했습니다.' }); return; }
      loadVoterCodes();
    },
  });

  const saveNote = async () => {
    if (!election) return;
    const supabase = createClient();
    const { error } = editingNote
      ? await supabase.from('election_notes').update({ content: editingNote.content.trim(), updated_at: new Date().toISOString() }).eq('id', editingNote.id)
      : await supabase.from('election_notes').insert([{ election_id: election.id, content: newNote.trim(), created_by: '관리자' }]);
    if (error) { setAlert({ title: '오류', message: '비고 저장에 실패했습니다.' }); return; }
    setNewNote(''); setEditingNote(null);
    loadNotes();
  };

  const deleteNote = (n: Note) => setConfirm({
    title: '비고 삭제', variant: 'danger', message: '이 비고를 삭제하시겠습니까?',
    onConfirm: async () => {
      const { error } = await createClient().from('election_notes').delete().eq('id', n.id);
      if (error) { setAlert({ title: '오류', message: '비고 삭제에 실패했습니다.' }); return; }
      loadNotes();
    },
  });

  const addThreshold = () => {
    const v = parseFloat(thresholdInput.percentage);
    if (!(v > 0 && v <= 100)) { setAlert({ title: '입력 오류', message: '0보다 크고 100 이하의 값을 입력하세요.' }); return; }
    setThresholds([...thresholds, { id: String(Date.now()), percentage: v, label: thresholdInput.label.trim() || `${v}%` }]);
    setThresholdInput({ percentage: '', label: '' });
    setShowThreshold(false);
  };

  // ---- 당선 판정 (기존 알고리즘 그대로) ----
  const calculateWinners = () => {
    const empty = { winners: [] as Candidate[], hasTie: false, meetsThreshold: false, requiredVotes: 0, thresholdMessage: '', confirmedWinners: [] as Candidate[], tiedCandidates: [] as Candidate[] };
    if (!election) return empty;
    const sorted = candidates.filter((c) => c.vote_count > 0).sort((a, b) => b.vote_count - a.vote_count);
    if (sorted.length === 0) return empty;
    const criteria = election.winning_criteria;
    let requiredVotes = 0, thresholdMessage = '', meetsThreshold = false;
    if (criteria.type === 'plurality') { thresholdMessage = '최다 득표'; meetsThreshold = true; }
    else if (criteria.type === 'absolute_majority') {
      const base = stats.uniqueVoters > 0 ? stats.uniqueVoters : stats.totalCodes;
      requiredVotes = Math.floor(base / 2) + 1;
      thresholdMessage = `투표자 ${base}명의 과반 (${requiredVotes}표 이상)`;
      meetsThreshold = sorted[0].vote_count > Math.floor(base / 2);
    } else {
      const base = criteria.base === 'attended' ? (stats.uniqueVoters > 0 ? stats.uniqueVoters : stats.totalCodes) : stats.totalCodes;
      requiredVotes = calcRequired(base, criteria.percentage || 0);
      thresholdMessage = `${criteria.base === 'attended' ? '투표자' : '발급 코드'} ${base}명의 ${criteria.percentage}% (${requiredVotes}표 이상)`;
      meetsThreshold = sorted[0].vote_count >= requiredVotes;
    }
    let winners: Candidate[] = [], hasTie = false, confirmedWinners: Candidate[] = [], tiedCandidates: Candidate[] = [];
    if (!meetsThreshold && criteria.type !== 'plurality') { /* 당선자 없음 */ }
    else if (criteria.type === 'percentage' || criteria.type === 'absolute_majority') {
      const qualified = sorted.filter((c) => c.vote_count >= requiredVotes);
      winners = qualified.length > election.max_selections ? qualified.slice(0, election.max_selections) : qualified;
      confirmedWinners = winners;
    } else if (sorted.length >= election.max_selections) {
      const cutoff = sorted[election.max_selections - 1].vote_count;
      confirmedWinners = sorted.filter((c) => c.vote_count > cutoff);
      tiedCandidates = sorted.filter((c) => c.vote_count === cutoff);
      if (tiedCandidates.length > election.max_selections - confirmedWinners.length) { hasTie = true; winners = [...confirmedWinners, ...tiedCandidates]; }
      else { winners = sorted.slice(0, election.max_selections); confirmedWinners = winners; tiedCandidates = []; }
    } else { winners = sorted; }
    return { winners, hasTie, meetsThreshold, requiredVotes, thresholdMessage, confirmedWinners, tiedCandidates };
  };

  if (!election) return <div className="py-16 flex justify-center"><span className="spinner" /></div>;

  const isDel = election.election_type === 'delegate';
  const codeRows: CodeRow[] = voterCodes
    .filter((c) => codeFilter === 'all' || (codeFilter === 'voted' ? c.has_voted : codeFilter === 'attended' ? !!c.first_login_at && !c.has_voted : !c.first_login_at))
    .map((c) => ({ id: c.id, code: c.code, label: c.has_voted ? '투표 완료' : c.first_login_at ? '참석 확인' : '미참석', tone: c.has_voted ? 'ok' : c.first_login_at ? 'accent' : undefined }));

  const r = calculateWinners();
  const sortedCands = [...candidates].sort((a, b) => b.vote_count - a.vote_count);
  const maxVotes = Math.max(...candidates.map((c) => c.vote_count), 1);
  const noWinner = !r.meetsThreshold && election.winning_criteria.type !== 'plurality';
  const criteriaLabel = election.winning_criteria.type === 'plurality' ? '최다 득표' : election.winning_criteria.type === 'absolute_majority' ? '과반'
    : `${election.winning_criteria.percentage}% (${election.winning_criteria.base === 'attended' ? '투표자' : '발급 코드'} 기준)`;

  return (
    <>
      <PageHead eyebrow={`${isDel ? `총대 · ${election.villages?.name ?? ''}` : `임원 · ${election.position ?? ''}`} · ${election.round}차`}
        title={<span className="flex items-center gap-3 flex-wrap">{election.title} <StatusBadge status={election.status} /></span>}
        desc={`선출 ${election.max_selections}명 · 당선 기준 ${criteriaLabel}`}
        actions={
          <>
            <Link href={`/admin/elections/${election.id}/monitor`} className="btn btn-secondary">모니터</Link>
            <Link href={`/admin/elections/${election.id}/results`} className="btn btn-secondary">결과 보고서</Link>
            {election.group_id && <Link href={`/admin/election-groups/${election.group_id}`} className="btn btn-ghost">그룹으로</Link>}
          </>
        } />

      <div className="mb-6">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'overview', label: '개요' }, ...(isDel ? [{ value: 'codes' as Tab, label: '참여코드' }] : []), { value: 'results', label: '결과' }]} />
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <section className="panel">
              <h2>상태</h2>
              <div className="choice">
                {(['waiting', 'active', 'closed'] as const).map((s) => (
                  <button key={s} type="button" className="row" aria-pressed={election.status === s} onClick={() => election.status !== s && setStatus(s)}>
                    <strong>{s === 'waiting' ? '대기' : s === 'active' ? '진행중' : '종료'}</strong>
                    <span>{s === 'waiting' ? '준비 중. 투표 불가' : s === 'active' ? '투표를 받는 중' : '투표 마감'}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-head"><h2>후보 {candidates.length}명</h2></div>
              <div className="flex gap-2 mb-4">
                <input className="input" placeholder="후보자 이름" value={newCandidate} onChange={(e) => setNewCandidate(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCandidate(); }} />
                <button onClick={addCandidate} disabled={!newCandidate.trim()} className="btn btn-primary">추가</button>
              </div>
              {candidates.length === 0 ? <p className="muted text-sm">후보가 없습니다.</p> : (
                <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
                  {candidates.map((c, i) => (
                    <li key={c.id} className="py-2.5 flex items-center gap-3">
                      <span className="mark">{i + 1}</span>
                      <span className="flex-1 font-medium">{c.name}</span>
                      <span className="text-sm muted">{c.vote_count}표</span>
                      <button onClick={() => deleteCandidate(c)} className="btn btn-ghost btn-sm danger">삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div>
            <section className="panel">
              <h2>선거 정보</h2>
              <dl className="kv">
                <dt>유형</dt><dd>{isDel ? '총대 선출' : '임원 선출'}</dd>
                <dt>{isDel ? '마을' : '직책'}</dt><dd>{isDel ? election.villages?.name || '–' : election.position || '–'}</dd>
                <dt>차수</dt><dd>{election.round}차</dd>
                <dt>선출 인원</dt><dd>{election.max_selections}명</dd>
                <dt>당선 기준</dt><dd>{criteriaLabel}</dd>
                <dt>생성</dt><dd>{fmtTime(election.created_at)}</dd>
              </dl>
            </section>
            {!isDel && <p className="notice mt-4">임원 투표의 참여코드는 투표 그룹 페이지에서 발급합니다. 코드 하나로 그룹의 모든 선거에 참여합니다.</p>}
            <div className="mt-4"><QRCodeSection title={election.title} /></div>
          </div>
        </div>
      )}

      {tab === 'codes' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Tabs value={codeFilter} onChange={setCodeFilter} items={[{ value: 'all', label: '전체' }, { value: 'voted', label: '투표 완료' }, { value: 'attended', label: '참석 확인' }, { value: 'not_attended', label: '미참석' }]} />
            <button onClick={() => setShowCodeModal(true)} className="btn btn-primary">코드 생성</button>
          </div>
          <CodeList rows={codeRows} onDelete={deleteCodes} emptyText={voterCodes.length === 0 ? '아직 코드가 없습니다. 코드 생성을 눌러 만드세요.' : '조건에 맞는 코드가 없습니다.'} />
        </>
      )}

      {tab === 'results' && (
        <>
          <div className="stats">
            <Stat label="발급 코드" value={stats.totalCodes} />
            <Stat label="참석 확인" value={stats.attendedCodes} hint={stats.totalCodes ? `${((stats.attendedCodes / stats.totalCodes) * 100).toFixed(1)}%` : undefined} />
            <Stat label="투표 완료" value={stats.uniqueVoters} accent hint={stats.attendedCodes ? `참석자의 ${((stats.uniqueVoters / stats.attendedCodes) * 100).toFixed(1)}%` : undefined} />
            <Stat label="기권" value={stats.abstainCount} hint={stats.uniqueVoters ? `${((stats.abstainCount / stats.uniqueVoters) * 100).toFixed(1)}%` : undefined} />
            <Stat label="미참석" value={stats.totalCodes - stats.attendedCodes} />
          </div>

          <section className="section">
            <div className="section-head">
              <h2>필요 득표수 <span className="faint text-sm font-normal">투표자 {stats.uniqueVoters}명 기준</span></h2>
              <button onClick={() => setShowThreshold(true)} className="btn btn-secondary btn-sm">비율 추가</button>
            </div>
            <div className="stats">
              {thresholds.map((t) => (
                <div key={t.id} className="stat">
                  <div className="l flex justify-between">{t.label} ({t.percentage}%)
                    <button onClick={() => setThresholds(thresholds.filter((x) => x.id !== t.id))} className="faint hover:underline">삭제</button>
                  </div>
                  <div className="v">{calcRequired(stats.uniqueVoters, t.percentage)}표</div>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            {noWinner ? (
              <div className="panel" style={{ borderColor: 'color-mix(in oklch, var(--danger) 40%, transparent)' }}>
                <h2>당선자 없음</h2>
                <p className="text-sm muted">
                  {sortedCands[0]?.vote_count ? <>기준 {r.thresholdMessage} 에 미달했습니다. 최고 득표 {sortedCands[0].name} {sortedCands[0].vote_count}표{r.requiredVotes > 0 && ` (필요 ${r.requiredVotes}표)`}. </> : '아직 득표한 후보가 없습니다. '}
                  {sortedCands[0]?.vote_count ? (election.round === 1 ? '2차 투표를 진행하거나 ' : election.round === 2 ? '3차 투표(최다득표)를 진행하거나 ' : '') + '규정에 따라 결정해 주세요.' : ''}
                </p>
              </div>
            ) : r.winners.length > 0 && (
              <div className="panel" style={{ borderColor: r.hasTie ? 'color-mix(in oklch, var(--warn) 60%, transparent)' : 'color-mix(in oklch, var(--ok) 50%, transparent)' }}>
                <h2>{r.hasTie ? '동점 발생' : r.winners.length === 1 ? '당선자' : `당선자 ${r.winners.length}명`}</h2>
                {r.hasTie && (
                  <p className="text-sm muted mb-3">
                    {election.max_selections}명을 뽑아야 하는데 {r.tiedCandidates[0]?.vote_count}표 동점인 후보가 {r.tiedCandidates.length}명입니다.
                    {r.confirmedWinners.length > 0 && ` 확정 ${r.confirmedWinners.length}명, 남은 자리 ${election.max_selections - r.confirmedWinners.length}명.`}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {r.confirmedWinners.map((c) => <Badge key={c.id} tone="ok">{c.name} · {c.vote_count}표</Badge>)}
                  {r.tiedCandidates.map((c) => <Badge key={c.id} tone="warn">미확정 {c.name} · {c.vote_count}표</Badge>)}
                </div>
                <p className="text-xs faint mt-3">당선 기준: {r.thresholdMessage}</p>
              </div>
            )}
          </section>

          <section className="section">
            <h2>전체 득표</h2>
            {candidates.length === 0 ? <p className="muted text-sm">후보가 없습니다.</p> : (
              <div className="panel">
                {sortedCands.map((c, i) => {
                  const isWin = r.confirmedWinners.some((w) => w.id === c.id);
                  const isTied = r.tiedCandidates.some((t) => t.id === c.id);
                  const pct = stats.uniqueVoters > 0 ? (c.vote_count / stats.uniqueVoters) * 100 : 0;
                  return (
                    <div key={c.id} className="py-3" style={{ borderBottom: i < sortedCands.length - 1 ? '1px solid var(--rule)' : undefined }}>
                      <div className="flex items-baseline justify-between gap-4 mb-2">
                        <span className="text-sm flex items-center gap-2"><span className="faint">{isTied ? '?' : i + 1}</span><strong>{c.name}</strong>{isWin && <Badge tone="ok">당선</Badge>}{isTied && <Badge tone="warn">미확정</Badge>}</span>
                        <span className="text-sm whitespace-nowrap"><strong className="text-lg">{c.vote_count}</strong>표 <span className="faint">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className={`bar${isWin ? ' ok' : ''}`}><i style={{ width: `${(c.vote_count / maxVotes) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section">
            <h2>비고</h2>
            <div className="panel">
              <div className="flex gap-2 items-start">
                <textarea className="input" rows={2} placeholder="메모를 남깁니다" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                <button onClick={saveNote} disabled={!newNote.trim()} className="btn btn-primary">추가</button>
              </div>
              {notes.length > 0 && (
                <ul className="divide-y mt-4" style={{ borderColor: 'var(--rule)' }}>
                  {notes.map((n) => (
                    <li key={n.id} className="py-3">
                      {editingNote?.id === n.id ? (
                        <div className="flex gap-2 items-start">
                          <textarea className="input" rows={2} value={editingNote.content} onChange={(e) => setEditingNote({ id: n.id, content: e.target.value })} />
                          <button onClick={saveNote} className="btn btn-primary btn-sm">저장</button>
                          <button onClick={() => setEditingNote(null)} className="btn btn-ghost btn-sm">취소</button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs faint">
                            <span>{n.created_by}</span><span>{fmtTime(n.created_at)}</span>{n.updated_at !== n.created_at && <span>수정됨</span>}
                            <button onClick={() => setEditingNote({ id: n.id, content: n.content })} className="hover:underline">수정</button>
                            <button onClick={() => deleteNote(n)} className="hover:underline" style={{ color: 'var(--danger)' }}>삭제</button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <Modal open={showCodeModal} title="참여코드 생성" onClose={() => setShowCodeModal(false)}
        footer={<><button onClick={() => setShowCodeModal(false)} className="btn btn-secondary" disabled={generating}>취소</button><button onClick={generateCodes} disabled={generating} className="btn btn-primary">{generating ? '생성 중' : '생성'}</button></>}>
        <Field label="생성 개수" htmlFor="cq" hint={`1~100개. ${election.villages?.name ?? ''} 마을의 이 선거 전용 코드입니다.`}>
          <input id="cq" type="number" min={1} max={100} className="input" value={codeQty} onChange={(e) => setCodeQty(parseInt(e.target.value) || 1)} />
        </Field>
      </Modal>

      <Modal open={showThreshold} title="비율 추가" onClose={() => setShowThreshold(false)}
        footer={<><button onClick={() => setShowThreshold(false)} className="btn btn-secondary">취소</button><button onClick={addThreshold} className="btn btn-primary">추가</button></>}>
        <Field label="비율 (%)" htmlFor="tp"><input id="tp" type="number" min={0} max={100} step={0.01} className="input" placeholder="예: 75" value={thresholdInput.percentage} onChange={(e) => setThresholdInput({ ...thresholdInput, percentage: e.target.value })} autoFocus /></Field>
        <Field label="표시 이름" htmlFor="tl" hint="비워 두면 비율 숫자가 표시됩니다."><input id="tl" className="input" placeholder="예: 3/4" value={thresholdInput.label} onChange={(e) => setThresholdInput({ ...thresholdInput, label: e.target.value })} /></Field>
      </Modal>

      <AlertModal isOpen={!!alert} onClose={() => setAlert(null)} message={alert?.message ?? ''} title={alert?.title} />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.onConfirm()} message={confirm?.message ?? ''} title={confirm?.title} variant={confirm?.variant} confirmText={confirm?.variant === 'danger' ? '삭제' : '확인'} />
    </>
  );
}
