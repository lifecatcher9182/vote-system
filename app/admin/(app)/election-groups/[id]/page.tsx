'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { insertCodes } from '@/lib/codes';
import { PageHead, Stat, Tabs, StatusBadge, Modal, Field, Empty, fmtDate } from '@/components/ui';
import CodeList, { type CodeRow } from '@/components/admin/CodeList';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface ElectionGroup { id: string; title: string; description: string | null; group_type: 'delegate' | 'officer'; status: string; created_at: string; updated_at: string; }
interface Election {
  id: string; title: string; election_type: 'delegate' | 'officer'; position: string | null; village_id: string | null;
  max_selections: number; round: number; status: 'waiting' | 'active' | 'closed'; created_at: string;
  villages?: { name: string } | null; _count: { candidates: number; votes: number };
}
interface VoterCode { id: string; code: string; is_used: boolean; first_login_at: string | null; vote_count: number; }
interface VillageStat { villageName: string; codesCount: number; attendedCount: number; usedCount: number; participationRate: number; }
type CodeFilter = 'all' | 'not_attended' | 'attended' | 'voting' | 'completed';
type Confirm = { title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'primary' };

const DEFAULT_POSITIONS = ['회장', '총무', '회계', '서기'].map((name) => ({ name, selections: 1 }));

export default function ElectionGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [group, setGroup] = useState<ElectionGroup | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [villages, setVillages] = useState<{ id: string; name: string; selections: number }[]>([]);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [newPosition, setNewPosition] = useState('');
  const [voterCodes, setVoterCodes] = useState<VoterCode[]>([]);
  const [villageStats, setVillageStats] = useState<VillageStat[]>([]);
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('all');

  const [showBatch, setShowBatch] = useState(false);
  const [batching, setBatching] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeQty, setCodeQty] = useState(10);
  const [generating, setGenerating] = useState(false);

  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const loadElections = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from('elections').select('*, villages ( name )').eq('group_id', id).order('created_at');
    const list = (data || []) as Omit<Election, '_count'>[];
    const ids = list.map((e) => e.id);
    const [{ data: cands }, { data: votes }] = ids.length
      ? await Promise.all([supabase.from('candidates').select('election_id').in('election_id', ids), supabase.from('votes').select('election_id, voter_code_id').in('election_id', ids)])
      : [{ data: [] }, { data: [] }];
    setElections(list.map((e) => ({
      ...e,
      _count: {
        candidates: (cands || []).filter((c) => c.election_id === e.id).length,
        votes: new Set((votes || []).filter((v) => v.election_id === e.id).map((v) => v.voter_code_id)).size,
      },
    })));
  }, [id]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('election_groups').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { router.replace('/admin/election-groups'); return; }
      setGroup(data);
    });
    supabase.from('villages').select('id, name, is_active').order('name').then(({ data }) =>
      setVillages((data || []).filter((v) => v.is_active !== false).map((v) => ({ id: v.id, name: v.name, selections: 1 }))));
    loadElections();
  }, [id, router, loadElections]);

  // 임원 그룹: 코드 + 코드별 투표 진행 수
  const loadVoterCodes = useCallback(async () => {
    if (!group || group.group_type !== 'officer') return;
    const supabase = createClient();
    const { data: codes } = await supabase.from('voter_codes').select('id, code, is_used, first_login_at')
      .eq('code_type', 'officer').eq('group_id', group.id).order('created_at', { ascending: false });
    const codeIds = (codes || []).map((c) => c.id);
    const electionIds = elections.map((e) => e.id);
    const done = new Map<string, Set<string>>();
    if (codeIds.length && electionIds.length) {
      const { data: votes } = await supabase.from('votes').select('voter_code_id, election_id').in('voter_code_id', codeIds).in('election_id', electionIds);
      (votes || []).forEach((v) => { if (!done.has(v.voter_code_id)) done.set(v.voter_code_id, new Set()); done.get(v.voter_code_id)!.add(v.election_id); });
    }
    setVoterCodes((codes || []).map((c) => ({ ...c, vote_count: done.get(c.id)?.size || 0 })));
  }, [group, elections]);

  // 총대 그룹: 마을별 투표율
  const loadVillageStats = useCallback(async () => {
    if (!group || group.group_type !== 'delegate') return;
    const supabase = createClient();
    const dels = elections.filter((e) => e.election_type === 'delegate' && e.village_id);
    if (dels.length === 0) return;
    const villageIds = dels.map((e) => e.village_id!) ;
    const [{ data: vs }, { data: codes }] = await Promise.all([
      supabase.from('villages').select('id, name').in('id', villageIds),
      supabase.from('voter_codes').select('id, first_login_at, is_used, accessible_elections').in('village_id', villageIds),
    ]);
    const nameOf = new Map((vs || []).map((v) => [v.id, v.name]));
    setVillageStats(dels.map((e) => {
      const mine = (codes || []).filter((c) => c.accessible_elections?.includes(e.id));
      const attended = mine.filter((c) => c.first_login_at !== null).length;
      const used = mine.filter((c) => c.is_used).length;
      return { villageName: nameOf.get(e.village_id!) || '', codesCount: mine.length, attendedCount: attended, usedCount: used, participationRate: attended > 0 ? (used / attended) * 100 : 0 };
    }).sort((a, b) => b.participationRate - a.participationRate));
  }, [group, elections]);

  useEffect(() => { if (elections.length > 0) { loadVoterCodes(); loadVillageStats(); } }, [elections, loadVoterCodes, loadVillageStats]);

  const generateCodes = async () => {
    if (!group) return;
    if (codeQty < 1 || codeQty > 100) { setAlert({ title: '입력 오류', message: '코드는 1~100개까지 생성할 수 있습니다.' }); return; }
    if (elections.length === 0) { setAlert({ title: '입력 오류', message: '선거를 먼저 만들어 주세요.' }); return; }
    setGenerating(true);
    const err = await insertCodes(codeQty, { code_type: 'officer', accessible_elections: elections.map((e) => e.id), group_id: group.id });
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

  const deleteElection = (e: Election) => setConfirm({
    title: '선거 삭제', variant: 'danger', message: `"${e.title}" 선거를 삭제하시겠습니까? 후보와 투표 기록도 함께 삭제됩니다.`,
    onConfirm: async () => {
      const { error } = await createClient().from('elections').delete().eq('id', e.id);
      if (error) { setAlert({ title: '오류', message: '선거 삭제에 실패했습니다.' }); return; }
      loadElections();
    },
  });

  const deleteGroup = () => {
    if (!group) return;
    if (elections.length > 0) { setAlert({ title: '삭제 불가', message: '선거가 남아 있는 그룹은 삭제할 수 없습니다. 선거를 먼저 삭제하세요.' }); return; }
    setConfirm({
      title: '그룹 삭제', variant: 'danger', message: '이 그룹을 삭제하시겠습니까?',
      onConfirm: async () => {
        const { error } = await createClient().from('election_groups').delete().eq('id', group.id);
        if (error) { setAlert({ title: '오류', message: '그룹 삭제에 실패했습니다.' }); return; }
        router.replace('/admin/election-groups');
      },
    });
  };

  // 일괄 생성 (기존 로직 유지: 총대=마을별 기본 기준, 임원=직책별 2/3·참석자 기준)
  const batchCreate = () => {
    if (!group) return;
    const isDel = group.group_type === 'delegate';
    const items = isDel ? villages.filter((v) => v.selections > 0) : positions.filter((p) => p.selections > 0);
    if (items.length === 0) { setAlert({ title: '입력 오류', message: isDel ? '생성할 마을을 선택하세요.' : '생성할 직책을 선택하세요.' }); return; }
    setConfirm({
      title: '일괄 생성', message: `${items.length}개 선거를 생성하시겠습니까?`,
      onConfirm: async () => {
        setBatching(true);
        const supabase = createClient();
        try {
          if (isDel) {
            for (const v of villages.filter((x) => x.selections > 0)) {
              const { error } = await supabase.from('elections').insert({
                title: `${v.name} 총대 선출`, election_type: 'delegate', village_id: v.id, max_selections: v.selections, round: 1, status: 'waiting', group_id: group.id,
              });
              if (error) throw error;
            }
          } else {
            const newIds: string[] = [];
            for (const p of positions.filter((x) => x.selections > 0)) {
              const { data, error } = await supabase.from('elections').insert({
                title: `${p.name} 선출`, election_type: 'officer', position: p.name, max_selections: p.selections, round: 1, status: 'waiting', group_id: group.id,
                winning_criteria: { type: 'percentage', percentage: 66.67, base: 'attended' },
              }).select('id').single();
              if (error) throw error;
              if (data) newIds.push(data.id);
            }
            if (newIds.length > 0) {
              const current = elections.map((e) => e.id);
              const all = [...current, ...newIds];
              const { data: codes } = await supabase.from('voter_codes').select('id, accessible_elections').eq('code_type', 'officer');
              const mine = (codes || []).filter((c) => current.every((eid) => ((c.accessible_elections as string[]) || []).includes(eid)));
              if (mine.length > 0) await supabase.from('voter_codes').update({ accessible_elections: all }).in('id', mine.map((c) => c.id));
            }
          }
          setShowBatch(false);
          loadElections();
        } catch (e) {
          console.error(e);
          setAlert({ title: '오류', message: '일괄 생성 중 오류가 발생했습니다.' });
        } finally {
          setBatching(false);
        }
      },
    });
  };

  if (!group) return <div className="py-16 flex justify-center"><span className="spinner" /></div>;

  const isDel = group.group_type === 'delegate';
  const statusOf = (c: VoterCode): [string, CodeFilter, CodeRow['tone']] => {
    if (!c.first_login_at) return ['미참석', 'not_attended', undefined];
    if (c.vote_count === 0) return ['참석 확인', 'attended', 'accent'];
    if (c.vote_count < elections.length) return [`투표 중 ${c.vote_count}/${elections.length}`, 'voting', 'warn'];
    return ['투표 완료', 'completed', 'ok'];
  };
  const codeRows: CodeRow[] = voterCodes.map((c) => { const [label, key, tone] = statusOf(c); return { id: c.id, code: c.code, label, tone, key }; })
    .filter((r) => codeFilter === 'all' || (r as CodeRow & { key: CodeFilter }).key === codeFilter);

  return (
    <>
      <PageHead eyebrow={`${isDel ? '총대' : '임원'} 투표 그룹`} title={group.title} desc={group.description || `생성 ${fmtDate(group.created_at)}`}
        actions={
          <>
            <button onClick={() => setShowBatch(true)} className="btn btn-primary">일괄 생성</button>
            <Link href={`/admin/elections/create?group_id=${group.id}`} className="btn btn-secondary">선거 추가</Link>
            <button onClick={deleteGroup} className="btn btn-ghost danger">그룹 삭제</button>
          </>
        } />

      <div className="stats">
        <Stat label="선거" value={elections.length} />
        <Stat label="진행 중" value={elections.filter((e) => e.status === 'active').length} accent />
        <Stat label="종료" value={elections.filter((e) => e.status === 'closed').length} />
        {!isDel && <Stat label="참여코드" value={voterCodes.length} />}
      </div>

      <section className="section">
        <div className="section-head"><h2>선거 {elections.length}</h2></div>
        {elections.length === 0 ? (
          <Empty title="아직 선거가 없습니다" desc={isDel ? '일괄 생성으로 활성 마을마다 선거를 한 번에 만들 수 있습니다.' : '일괄 생성으로 직책별 선거를 한 번에 만들 수 있습니다.'}
            action={<button onClick={() => setShowBatch(true)} className="btn btn-primary">일괄 생성</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>제목</th><th>{isDel ? '마을' : '직책'}</th><th className="num">차수</th><th className="num">선출</th><th className="num">후보</th><th className="num">투표자</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {elections.map((e) => (
                  <tr key={e.id}>
                    <td className="font-medium"><Link href={`/admin/elections/${e.id}`} className="hover:underline">{e.title}</Link></td>
                    <td className="muted">{isDel ? e.villages?.name || '–' : e.position || '–'}</td>
                    <td className="num">{e.round}차</td>
                    <td className="num">{e.max_selections}</td>
                    <td className="num">{e._count.candidates}</td>
                    <td className="num">{e._count.votes}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td className="text-right whitespace-nowrap">
                      <Link href={`/admin/elections/${e.id}`} className="btn btn-ghost btn-sm">관리</Link>
                      <button onClick={() => deleteElection(e)} className="btn btn-ghost btn-sm danger">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isDel ? (
        <section className="section">
          <h2>마을별 투표율</h2>
          {villageStats.length === 0 ? (
            <p className="muted text-sm">참여코드는 각 마을 선거 페이지의 코드 탭에서 발급합니다. 발급 후 여기에 투표율이 표시됩니다.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>마을</th><th className="num">발급</th><th className="num">참석</th><th className="num">투표</th><th className="num">투표율 (참석 대비)</th></tr></thead>
                <tbody>
                  {villageStats.map((v) => (
                    <tr key={v.villageName}>
                      <td className="font-medium">{v.villageName}</td>
                      <td className="num">{v.codesCount}</td><td className="num">{v.attendedCount}</td><td className="num">{v.usedCount}</td>
                      <td className="num">{v.participationRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="section">
          <div className="section-head">
            <h2>참여코드 <span className="faint text-sm font-normal">코드 하나로 이 그룹의 모든 선거에 참여</span></h2>
            <button onClick={() => setShowCodeModal(true)} disabled={elections.length === 0} className="btn btn-primary btn-sm">코드 생성</button>
          </div>
          {voterCodes.length > 0 && (
            <div className="mb-3">
              <Tabs value={codeFilter} onChange={setCodeFilter} items={[
                { value: 'all', label: '전체' }, { value: 'not_attended', label: '미참석' }, { value: 'attended', label: '참석 확인' }, { value: 'voting', label: '투표 중' }, { value: 'completed', label: '투표 완료' },
              ]} />
            </div>
          )}
          <CodeList rows={codeRows} onDelete={deleteCodes} emptyText={voterCodes.length === 0 ? '아직 코드가 없습니다. 선거를 만든 뒤 생성하세요.' : '조건에 맞는 코드가 없습니다.'} />
        </section>
      )}

      <Modal open={showCodeModal} title="참여코드 생성" onClose={() => setShowCodeModal(false)}
        footer={<><button onClick={() => setShowCodeModal(false)} className="btn btn-secondary" disabled={generating}>취소</button><button onClick={generateCodes} disabled={generating} className="btn btn-primary">{generating ? '생성 중' : '생성'}</button></>}>
        <Field label="생성 개수" htmlFor="cq" hint="1~100개. 이 그룹의 모든 선거에 접근할 수 있는 코드입니다.">
          <input id="cq" type="number" min={1} max={100} className="input" value={codeQty} onChange={(e) => setCodeQty(parseInt(e.target.value) || 1)} />
        </Field>
      </Modal>

      <Modal open={showBatch} title={isDel ? '마을별 선거 일괄 생성' : '직책별 선거 일괄 생성'} onClose={() => setShowBatch(false)} size="lg"
        footer={<><button onClick={() => setShowBatch(false)} className="btn btn-secondary" disabled={batching}>취소</button><button onClick={batchCreate} disabled={batching} className="btn btn-primary">{batching ? '생성 중' : '생성'}</button></>}>
        <p className="text-sm muted mb-4">{isDel ? '활성 마을마다 선거를 만듭니다. 선출 인원이 0이면 건너뜁니다.' : '직책마다 선거를 만듭니다. 당선 기준은 참석자 2/3 이상으로 설정됩니다.'}</p>
        <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {(isDel ? villages : positions).map((item, i) => (
            <div key={isDel ? villages[i].id : positions[i].name} className="py-2 flex items-center gap-3">
              <span className="flex-1 font-medium">{item.name}</span>
              <label className="text-sm muted">선출</label>
              <input type="number" min={0} max={10} className="input" style={{ width: 72 }} value={item.selections}
                onChange={(e) => {
                  const n = parseInt(e.target.value) || 0;
                  if (isDel) setVillages(villages.map((v, j) => j === i ? { ...v, selections: n } : v));
                  else setPositions(positions.map((p, j) => j === i ? { ...p, selections: n } : p));
                }} />
              {!isDel && <button onClick={() => setPositions(positions.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm danger">삭제</button>}
            </div>
          ))}
          {isDel && villages.length === 0 && <p className="py-4 text-sm muted">활성 마을이 없습니다.</p>}
        </div>
        {!isDel && (
          <div className="flex gap-2 mt-3">
            <input className="input" placeholder="직책 추가 (예: 부회장)" value={newPosition} onChange={(e) => setNewPosition(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newPosition.trim()) { setPositions([...positions, { name: newPosition.trim(), selections: 1 }]); setNewPosition(''); } }} />
            <button onClick={() => { if (newPosition.trim()) { setPositions([...positions, { name: newPosition.trim(), selections: 1 }]); setNewPosition(''); } }} className="btn btn-secondary">추가</button>
          </div>
        )}
      </Modal>

      <AlertModal isOpen={!!alert} onClose={() => setAlert(null)} message={alert?.message ?? ''} title={alert?.title} />
      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.onConfirm()} message={confirm?.message ?? ''} title={confirm?.title} variant={confirm?.variant} confirmText={confirm?.variant === 'danger' ? '삭제' : '확인'} />
    </>
  );
}
