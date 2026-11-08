'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { insertCodes } from '@/lib/codes';
import { PageHead, Stat, Tabs, Badge, StatusBadge, Modal, Field, fmtDate } from '@/components/ui';
import CodeList, { type CodeRow } from '@/components/admin/CodeList';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface Round { id: string; title: string; description: string | null; group_type: 'delegate' | 'officer' | 'mixed'; status: string; created_at: string; }
interface Village { id: string; name: string; }
interface Election {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null; village_id: string | null;
  max_selections: number; round: number; status: 'waiting' | 'active' | 'closed';
  villages?: { name: string } | null; _count: { candidates: number; votes: number };
}
interface VoterCode { id: string; code: string; is_used: boolean; first_login_at: string | null; vote_count: number; }
type CodeFilter = 'all' | 'not_attended' | 'attended' | 'voting' | 'completed';
type Confirm = { title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' };

const DEFAULT_POSITIONS = ['회장', '총무', '회계', '서기'];

function ElectionTable({ rows, kind, locked, onDelete }: { rows: Election[]; kind: 'officer' | 'delegate'; locked: boolean; onDelete: (e: Election) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>선거</th><th>{kind === 'officer' ? '직책' : '마을'}</th><th className="num">차수</th><th className="num">선출</th><th className="num">후보</th><th className="num">투표자</th><th>상태</th><th></th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="font-medium"><Link href={`/admin/elections/${e.id}`} className="hover:underline">{e.title}</Link></td>
              <td className="muted">{kind === 'officer' ? e.position || '–' : e.villages?.name || '–'}</td>
              <td className="num">{e.round}차</td><td className="num">{e.max_selections}</td><td className="num">{e._count.candidates}</td><td className="num">{e._count.votes}</td>
              <td><StatusBadge status={e.status} /></td>
              <td className="text-right whitespace-nowrap">
                <Link href={`/admin/elections/${e.id}/results`} className="btn btn-ghost btn-sm">결과</Link>
                {!locked && <button onClick={() => onDelete(e)} className="btn btn-ghost btn-sm danger">삭제</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RoundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [codes, setCodes] = useState<VoterCode[]>([]);
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all');

  // 마을
  const [villageEdit, setVillageEdit] = useState<{ id?: string; name: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRounds, setImportRounds] = useState<{ id: string; title: string; names: string[] }[]>([]);
  const [importFrom, setImportFrom] = useState('');

  // 일괄 생성
  const [batch, setBatch] = useState<'officer' | 'delegate' | null>(null);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS.map((name) => ({ name, selections: 1 })));
  const [newPosition, setNewPosition] = useState('');
  const [villageSel, setVillageSel] = useState<Record<string, number>>({});
  const [batching, setBatching] = useState(false);

  // 임원 코드
  const [codeModal, setCodeModal] = useState(false);
  const [codeQty, setCodeQty] = useState(10);
  const [generating, setGenerating] = useState(false);

  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: g, error } = await supabase.from('election_groups').select('*').eq('id', id).single();
    if (error || !g) { router.replace('/admin/election-groups'); return; }
    setRound(g as Round);
    const [{ data: vs }, { data: es }] = await Promise.all([
      supabase.from('villages').select('id, name').eq('group_id', id).order('name'),
      supabase.from('elections').select('*, villages ( name )').eq('group_id', id).order('created_at'),
    ]);
    setVillages(vs || []);
    const list = (es || []) as Omit<Election, '_count'>[];
    const ids = list.map((e) => e.id);
    const [{ data: cands }, { data: votes }, { data: cs }] = await Promise.all([
      ids.length ? supabase.from('candidates').select('election_id').in('election_id', ids) : Promise.resolve({ data: [] as { election_id: string }[] }),
      ids.length ? supabase.from('votes').select('election_id, voter_code_id').in('election_id', ids) : Promise.resolve({ data: [] as { election_id: string; voter_code_id: string }[] }),
      supabase.from('voter_codes').select('id, code, is_used, first_login_at').eq('group_id', id).eq('code_type', 'officer').order('created_at', { ascending: false }),
    ]);
    setElections(list.map((e) => ({
      ...e,
      _count: {
        candidates: (cands || []).filter((c) => c.election_id === e.id).length,
        votes: new Set((votes || []).filter((v) => v.election_id === e.id).map((v) => v.voter_code_id)).size,
      },
    })));
    const officerIds = new Set(list.filter((e) => e.election_type === 'officer').map((e) => e.id));
    setCodes((cs || []).map((c) => ({
      ...c, vote_count: new Set((votes || []).filter((v) => v.voter_code_id === c.id && officerIds.has(v.election_id)).map((v) => v.election_id)).size,
    })));
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (!round) return <div className="py-16 flex justify-center"><span className="spinner" /></div>;

  const locked = round.status === 'closed';
  const officers = elections.filter((e) => e.election_type === 'officer');
  const delegates = elections.filter((e) => e.election_type === 'delegate');
  const villagesWithoutElection = villages.filter((v) => !delegates.some((e) => e.village_id === v.id));
  const legacyTyped = round.group_type !== 'mixed';

  // ---- 상태 ----
  const setStatus = (status: 'active' | 'closed') => setConfirm({
    title: status === 'closed' ? '회차 보관' : '회차 다시 열기',
    message: status === 'closed' ? '이 회차를 보관하면 마을·선거·코드를 더 이상 바꿀 수 없습니다. 결과는 계속 볼 수 있습니다.' : '보관을 풀고 다시 수정할 수 있게 합니다.',
    onConfirm: async () => {
      const { error } = await createClient().from('election_groups').update({ status }).eq('id', id);
      if (error) { setAlert({ title: '오류', message: '상태 변경에 실패했습니다.' }); return; }
      load();
    },
  });

  const deleteRound = () => {
    if (elections.length > 0) { setAlert({ title: '삭제 불가', message: '선거가 남아 있는 회차는 삭제할 수 없습니다. 선거를 먼저 삭제하세요.' }); return; }
    setConfirm({
      title: '회차 삭제', variant: 'danger', message: '이 회차와 등록된 마을을 삭제하시겠습니까?',
      onConfirm: async () => {
        const { error } = await createClient().from('election_groups').delete().eq('id', id);
        if (error) { setAlert({ title: '오류', message: '회차 삭제에 실패했습니다.' }); return; }
        router.replace('/admin/election-groups');
      },
    });
  };

  // ---- 마을 ----
  const saveVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageEdit?.name.trim()) return;
    const supabase = createClient();
    const { error } = villageEdit.id
      ? await supabase.from('villages').update({ name: villageEdit.name.trim() }).eq('id', villageEdit.id)
      : await supabase.from('villages').insert([{ name: villageEdit.name.trim(), group_id: id }]);
    if (error) { setAlert({ title: '오류', message: '마을 저장에 실패했습니다.' }); return; }
    setVillageEdit(null);
    load();
  };

  const deleteVillage = (v: Village) => {
    if (delegates.some((e) => e.village_id === v.id)) { setAlert({ title: '삭제 불가', message: '이 마을의 총대 선거가 있습니다. 선거를 먼저 삭제하세요.' }); return; }
    setConfirm({
      title: '마을 삭제', variant: 'danger', message: `${v.name} 마을을 이 회차에서 빼시겠습니까?`,
      onConfirm: async () => {
        const { error } = await createClient().from('villages').delete().eq('id', v.id);
        if (error) { setAlert({ title: '오류', message: '마을 삭제에 실패했습니다.' }); return; }
        load();
      },
    });
  };

  const openImport = async () => {
    const supabase = createClient();
    const [{ data: gs }, { data: vs }] = await Promise.all([
      supabase.from('election_groups').select('id, title').neq('id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('villages').select('name, group_id'),
    ]);
    const rounds = (gs || []).map((g) => ({ id: g.id, title: g.title, names: (vs || []).filter((v) => v.group_id === g.id).map((v) => v.name) })).filter((r) => r.names.length > 0);
    // 예전 전역 마을(회차 없음)도 하나의 출처로
    const legacy = (vs || []).filter((v) => !v.group_id).map((v) => v.name);
    if (legacy.length) rounds.push({ id: 'legacy', title: '예전 마을 목록 (회차 없음)', names: legacy });
    setImportRounds(rounds);
    setImportFrom(rounds[0]?.id ?? '');
    setImportOpen(true);
  };

  const doImport = async () => {
    const src = importRounds.find((r) => r.id === importFrom);
    if (!src) return;
    const have = new Set(villages.map((v) => v.name));
    const add = [...new Set(src.names)].filter((n) => !have.has(n));
    if (add.length === 0) { setAlert({ title: '안내', message: '이미 모두 등록된 마을입니다.' }); return; }
    const { error } = await createClient().from('villages').insert(add.map((name) => ({ name, group_id: id })));
    if (error) { setAlert({ title: '오류', message: '마을 가져오기에 실패했습니다.' }); return; }
    setImportOpen(false);
    load();
  };

  // ---- 선거 ----
  const deleteElection = (e: Election) => setConfirm({
    title: '선거 삭제', variant: 'danger', message: `"${e.title}" 선거를 삭제하시겠습니까? 후보와 투표 기록도 함께 삭제됩니다.`,
    onConfirm: async () => {
      const { error } = await createClient().from('elections').delete().eq('id', e.id);
      if (error) { setAlert({ title: '오류', message: '선거 삭제에 실패했습니다.' }); return; }
      load();
    },
  });

  const openBatch = (type: 'officer' | 'delegate') => {
    if (type === 'delegate') setVillageSel(Object.fromEntries(villagesWithoutElection.map((v) => [v.id, 1])));
    setBatch(type);
  };

  // 기존 로직 유지: 임원 = 2/3·참석자 기준 + 기존 임원 코드 접근 갱신, 총대 = 기본 기준
  const runBatch = async () => {
    const supabase = createClient();
    setBatching(true);
    try {
      if (batch === 'officer') {
        const items = positions.filter((p) => p.selections > 0);
        if (items.length === 0) { setAlert({ title: '입력 오류', message: '생성할 직책이 없습니다.' }); return; }
        const newIds: string[] = [];
        for (const p of items) {
          const { data, error } = await supabase.from('elections').insert({
            title: `${p.name} 선출`, election_type: 'officer', position: p.name, max_selections: p.selections, round: 1, status: 'waiting', group_id: id,
            winning_criteria: { type: 'percentage', percentage: 66.67, base: 'attended' },
          }).select('id').single();
          if (error) throw error;
          if (data) newIds.push(data.id);
        }
        const current = officers.map((e) => e.id);
        if (newIds.length > 0 && codes.length > 0) {
          await supabase.from('voter_codes').update({ accessible_elections: [...current, ...newIds] }).in('id', codes.map((c) => c.id));
        }
      } else {
        const items = villagesWithoutElection.filter((v) => (villageSel[v.id] ?? 0) > 0);
        if (items.length === 0) { setAlert({ title: '입력 오류', message: '생성할 마을이 없습니다.' }); return; }
        for (const v of items) {
          const { error } = await supabase.from('elections').insert({
            title: `${v.name} 총대 선출`, election_type: 'delegate', village_id: v.id, max_selections: villageSel[v.id], round: 1, status: 'waiting', group_id: id,
          });
          if (error) throw error;
        }
      }
      setBatch(null);
      load();
    } catch (e) {
      console.error(e);
      setAlert({ title: '오류', message: '일괄 생성 중 오류가 발생했습니다.' });
    } finally {
      setBatching(false);
    }
  };

  // ---- 임원 코드 ----
  const generateCodes = async () => {
    if (codeQty < 1 || codeQty > 100) { setAlert({ title: '입력 오류', message: '코드는 1~100개까지 생성할 수 있습니다.' }); return; }
    if (officers.length === 0) { setAlert({ title: '입력 오류', message: '임원 선거를 먼저 만들어 주세요.' }); return; }
    setGenerating(true);
    const err = await insertCodes(codeQty, { code_type: 'officer', accessible_elections: officers.map((e) => e.id), group_id: id });
    setGenerating(false);
    if (err) { setAlert({ title: '생성 실패', message: err }); return; }
    setCodeModal(false); setCodeQty(10);
    load();
  };

  const deleteCodes = (ids: string[]) => setConfirm({
    title: '코드 삭제', variant: 'danger',
    message: ids.length === 1 ? '이 코드를 삭제하시겠습니까?' : `선택한 ${ids.length}개 코드를 삭제하시겠습니까? 관련 투표 기록도 함께 삭제됩니다.`,
    onConfirm: async () => {
      const { error } = await createClient().from('voter_codes').delete().in('id', ids);
      if (error) { setAlert({ title: '오류', message: '코드 삭제에 실패했습니다.' }); return; }
      load();
    },
  });

  const codeStatus = (c: VoterCode): { label: string; key: CodeFilter; tone: CodeRow['tone'] } => {
    if (!c.first_login_at) return { label: '미참석', key: 'not_attended', tone: undefined };
    if (c.vote_count === 0) return { label: '참석 확인', key: 'attended', tone: 'accent' };
    if (c.vote_count < officers.length) return { label: `투표 중 ${c.vote_count}/${officers.length}`, key: 'voting', tone: 'warn' };
    return { label: '투표 완료', key: 'completed', tone: 'ok' };
  };
  const codeRows: CodeRow[] = codes.map((c) => ({ c, s: codeStatus(c) })).filter(({ s }) => codeFilter === 'all' || s.key === codeFilter)
    .map(({ c, s }) => ({ id: c.id, code: c.code, label: s.label, tone: s.tone }));

  return (
    <>
      <PageHead eyebrow="선거 회차" title={<span className="flex items-center gap-3 flex-wrap">{round.title} {locked ? <Badge>보관</Badge> : <Badge tone="ok">진행 중</Badge>}</span>}
        desc={round.description || `생성 ${fmtDate(round.created_at)}`}
        actions={
          locked ? <button onClick={() => setStatus('active')} className="btn btn-secondary">다시 열기</button> : (
            <>
              <button onClick={() => setStatus('closed')} className="btn btn-secondary">회차 보관</button>
              <button onClick={deleteRound} className="btn btn-ghost danger">삭제</button>
            </>
          )
        } />

      {locked && <p className="notice mb-6">보관된 회차입니다. 기록은 그대로 볼 수 있고, 수정하려면 다시 열기를 누르세요.</p>}
      {legacyTyped && <p className="notice mb-6">예전 방식({round.group_type === 'delegate' ? '총대' : '임원'} 전용)으로 만들어진 회차입니다. 기록 열람용이며, 새 선거는 새 회차에서 만드세요.</p>}

      <div className="stats">
        <Stat label="마을" value={villages.length} />
        <Stat label="임원 선거" value={officers.length} hint={`진행 ${officers.filter((e) => e.status === 'active').length}`} />
        <Stat label="총대 선거" value={delegates.length} hint={`진행 ${delegates.filter((e) => e.status === 'active').length}`} />
        <Stat label="임원 참여코드" value={codes.length} hint={`투표 완료 ${codes.filter((c) => codeStatus(c).key === 'completed').length}`} accent />
      </div>

      {/* 마을 */}
      <section className="section">
        <div className="section-head">
          <h2>이번 회차 마을 <span className="faint text-sm font-normal">{villages.length}개</span></h2>
          {!locked && !legacyTyped && (
            <div className="flex gap-2">
              <button onClick={openImport} className="btn btn-secondary btn-sm">지난 회차에서 가져오기</button>
              <button onClick={() => setVillageEdit({ name: '' })} className="btn btn-primary btn-sm">마을 추가</button>
            </div>
          )}
        </div>
        {villages.length === 0 ? (
          <p className="muted text-sm">{legacyTyped ? '예전 회차는 전역 마을 목록을 사용했습니다.' : '마을을 추가하거나 지난 회차에서 가져오세요. 총대 선거는 마을마다 하나씩 만들어집니다.'}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {villages.map((v) => {
              const has = delegates.some((e) => e.village_id === v.id);
              return (
                <span key={v.id} className="row" style={{ width: 'auto', minHeight: 40, padding: '6px 10px 6px 14px', gap: 8, cursor: 'default' }}>
                  <span className="font-medium">{v.name}</span>
                  <Badge tone={has ? 'ok' : 'plain'}>{has ? '선거 있음' : '선거 없음'}</Badge>
                  {!locked && !legacyTyped && (
                    <>
                      <button onClick={() => setVillageEdit({ id: v.id, name: v.name })} className="btn btn-ghost btn-sm">수정</button>
                      {!has && <button onClick={() => deleteVillage(v)} className="btn btn-ghost btn-sm danger">삭제</button>}
                    </>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* 임원 선거 */}
      <section className="section">
        <div className="section-head">
          <h2>임원 선거 <span className="faint text-sm font-normal">{officers.length}개</span></h2>
          {!locked && (
            <div className="flex gap-2">
              <button onClick={() => openBatch('officer')} className="btn btn-secondary btn-sm">직책별 일괄 생성</button>
              <Link href={`/admin/elections/create?group_id=${id}&type=officer`} className="btn btn-primary btn-sm">선거 추가</Link>
            </div>
          )}
        </div>
        {officers.length === 0 ? <p className="muted text-sm">회장·총무·회계·서기 순서로 일괄 생성하면 됩니다. 당선 기준은 참석자 2/3 이상으로 들어갑니다.</p> : <ElectionTable rows={officers} kind="officer" locked={locked} onDelete={deleteElection} />}
      </section>

      {/* 총대 선거 */}
      <section className="section">
        <div className="section-head">
          <h2>총대 선거 <span className="faint text-sm font-normal">{delegates.length}개</span></h2>
          {!locked && (
            <div className="flex gap-2">
              <button onClick={() => openBatch('delegate')} disabled={villagesWithoutElection.length === 0} className="btn btn-secondary btn-sm">마을별 일괄 생성</button>
              <Link href={`/admin/elections/create?group_id=${id}&type=delegate`} className="btn btn-primary btn-sm">선거 추가</Link>
            </div>
          )}
        </div>
        {delegates.length === 0 ? <p className="muted text-sm">마을을 먼저 등록한 뒤 마을별로 일괄 생성합니다. 총대 참여코드는 각 마을 선거 페이지의 참여코드 탭에서 발급합니다.</p> : <ElectionTable rows={delegates} kind="delegate" locked={locked} onDelete={deleteElection} />}
      </section>

      {/* 임원 참여코드 */}
      <section className="section">
        <div className="section-head">
          <h2>임원 참여코드 <span className="faint text-sm font-normal">코드 하나로 모든 임원 선거</span></h2>
          {!locked && <button onClick={() => setCodeModal(true)} disabled={officers.length === 0} className="btn btn-primary btn-sm">코드 생성</button>}
        </div>
        {codes.length > 0 && (
          <div className="mb-3">
            <Tabs value={codeFilter} onChange={setCodeFilter} items={[
              { value: 'all', label: '전체' }, { value: 'not_attended', label: '미참석' }, { value: 'attended', label: '참석 확인' }, { value: 'voting', label: '투표 중' }, { value: 'completed', label: '투표 완료' },
            ]} />
          </div>
        )}
        <CodeList rows={codeRows} onDelete={deleteCodes} emptyText={codes.length === 0 ? '임원 선거를 만든 뒤 코드를 생성하세요. 태블릿 투표소에서는 접수처가 이 코드를 나눠 줍니다.' : '조건에 맞는 코드가 없습니다.'} />
      </section>

      {/* 모달들 */}
      <Modal open={!!villageEdit} title={villageEdit?.id ? '마을 이름 수정' : '마을 추가'} onClose={() => setVillageEdit(null)}>
        {villageEdit && (
          <form onSubmit={saveVillage}>
            <Field label="마을 이름" htmlFor="vn"><input id="vn" className="input" value={villageEdit.name} onChange={(e) => setVillageEdit({ ...villageEdit, name: e.target.value })} autoFocus autoComplete="off" /></Field>
            <div className="foot"><button type="button" onClick={() => setVillageEdit(null)} className="btn btn-secondary">취소</button><button type="submit" className="btn btn-primary">저장</button></div>
          </form>
        )}
      </Modal>

      <Modal open={importOpen} title="지난 회차에서 마을 가져오기" onClose={() => setImportOpen(false)}
        footer={<><button onClick={() => setImportOpen(false)} className="btn btn-secondary">취소</button><button onClick={doImport} disabled={!importFrom} className="btn btn-primary">가져오기</button></>}>
        {importRounds.length === 0 ? <p className="muted text-sm">가져올 마을이 있는 회차가 없습니다.</p> : (
          <Field label="출처" hint={importRounds.find((r) => r.id === importFrom)?.names.join(', ')}>
            <select className="input select" value={importFrom} onChange={(e) => setImportFrom(e.target.value)}>
              {importRounds.map((r) => <option key={r.id} value={r.id}>{r.title} ({r.names.length}개)</option>)}
            </select>
          </Field>
        )}
        <p className="text-xs faint">이미 등록된 이름은 건너뜁니다.</p>
      </Modal>

      <Modal open={batch === 'officer'} title="직책별 선거 일괄 생성" onClose={() => setBatch(null)} size="lg"
        footer={<><button onClick={() => setBatch(null)} className="btn btn-secondary" disabled={batching}>취소</button><button onClick={runBatch} disabled={batching} className="btn btn-primary">{batching ? '생성 중' : `${positions.filter((p) => p.selections > 0).length}개 생성`}</button></>}>
        <p className="text-sm muted mb-3">직책마다 선거가 하나씩 만들어집니다. 당선 기준은 참석자 2/3 이상, 선출 인원이 0이면 건너뜁니다.</p>
        <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {positions.map((p, i) => (
            <div key={p.name} className="py-2 flex items-center gap-3">
              <span className="flex-1 font-medium">{p.name}</span>
              <label className="text-sm muted">선출</label>
              <input type="number" min={0} max={10} className="input" style={{ width: 72 }} value={p.selections} onChange={(e) => setPositions(positions.map((x, j) => j === i ? { ...x, selections: parseInt(e.target.value) || 0 } : x))} />
              <button onClick={() => setPositions(positions.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm danger">삭제</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input className="input" placeholder="직책 추가 (예: 부회장)" value={newPosition} onChange={(e) => setNewPosition(e.target.value)} autoComplete="off"
            onKeyDown={(e) => { if (e.key === 'Enter' && newPosition.trim()) { e.preventDefault(); setPositions([...positions, { name: newPosition.trim(), selections: 1 }]); setNewPosition(''); } }} />
          <button onClick={() => { if (newPosition.trim()) { setPositions([...positions, { name: newPosition.trim(), selections: 1 }]); setNewPosition(''); } }} className="btn btn-secondary">추가</button>
        </div>
      </Modal>

      <Modal open={batch === 'delegate'} title="마을별 총대 선거 일괄 생성" onClose={() => setBatch(null)} size="lg"
        footer={<><button onClick={() => setBatch(null)} className="btn btn-secondary" disabled={batching}>취소</button><button onClick={runBatch} disabled={batching} className="btn btn-primary">{batching ? '생성 중' : `${Object.values(villageSel).filter((n) => n > 0).length}개 생성`}</button></>}>
        <p className="text-sm muted mb-3">아직 선거가 없는 마을만 보입니다. 선출 인원이 0이면 건너뜁니다.</p>
        <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {villagesWithoutElection.map((v) => (
            <div key={v.id} className="py-2 flex items-center gap-3">
              <span className="flex-1 font-medium">{v.name}</span>
              <label className="text-sm muted">선출</label>
              <input type="number" min={0} max={10} className="input" style={{ width: 72 }} value={villageSel[v.id] ?? 1} onChange={(e) => setVillageSel({ ...villageSel, [v.id]: parseInt(e.target.value) || 0 })} />
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={codeModal} title="임원 참여코드 생성" onClose={() => setCodeModal(false)}
        footer={<><button onClick={() => setCodeModal(false)} className="btn btn-secondary" disabled={generating}>취소</button><button onClick={generateCodes} disabled={generating} className="btn btn-primary">{generating ? '생성 중' : '생성'}</button></>}>
        <Field label="생성 개수" htmlFor="cq" hint="1~100개. 이 회차의 모든 임원 선거에 쓸 수 있는 코드입니다.">
          <input id="cq" type="number" min={1} max={100} className="input" value={codeQty} onChange={(e) => setCodeQty(parseInt(e.target.value) || 1)} />
        </Field>
      </Modal>

      <AlertModal isOpen={!!alert} onClose={() => setAlert(null)} message={alert?.message ?? ''} title={alert?.title} />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.onConfirm()} message={confirm?.message ?? ''} title={confirm?.title} variant={confirm?.variant} confirmText={confirm?.variant === 'danger' ? '삭제' : '확인'} />
    </>
  );
}
