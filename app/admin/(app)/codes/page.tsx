'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { insertCodes } from '@/lib/codes';
import { PageHead, Stat, Tabs, Badge, Empty, Modal, Field, fmtDate } from '@/components/ui';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface VoterCode {
  id: string; code: string; code_type: 'delegate' | 'officer'; village_id: string | null; is_used: boolean;
  voter_name?: string | null; first_login_at: string | null; created_at: string; group_id?: string | null;
  villages?: { name: string } | { name: string }[] | null;
}
interface Election { id: string; title: string; election_type: 'delegate' | 'officer'; status: string; village_id: string | null; }
interface Village { id: string; name: string; }
interface Round { id: string; title: string; status: string; }
type Filter = 'all' | 'voted' | 'attended' | 'not_attended';

const villageName = (c: VoterCode) => (Array.isArray(c.villages) ? c.villages[0]?.name : c.villages?.name) || '–';

function CodesPageContent() {
  const router = useRouter();
  const groupId = useSearchParams().get('group_id');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [codes, setCodes] = useState<VoterCode[] | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [codeType, setCodeType] = useState<'delegate' | 'officer'>('officer');
  const [quantity, setQuantity] = useState(10);
  const [selectedElections, setSelectedElections] = useState<string[]>([]);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [generating, setGenerating] = useState(false);

  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    let q = createClient().from('voter_codes')
      .select('id, code, code_type, village_id, is_used, voter_name, first_login_at, created_at, group_id, villages ( name )')
      .order('created_at', { ascending: false });
    if (groupId) q = q.eq('group_id', groupId);
    const { data, error } = await q;
    if (error) { console.error(error); return; }
    setCodes((data as VoterCode[]) || []);
  }, [groupId]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: gs } = await supabase.from('election_groups').select('id, title, status').order('created_at', { ascending: false });
      setRounds(gs || []);
      // 회차를 고르지 않았으면 진행 중인 최신 회차로
      if (!groupId) {
        const current = (gs || []).find((g) => g.status !== 'closed') ?? gs?.[0];
        if (current) { router.replace(`/admin/codes?group_id=${current.id}`); return; }
      }
      let eq = supabase.from('elections').select('id, title, election_type, status, village_id').order('created_at', { ascending: false });
      if (groupId) eq = eq.eq('group_id', groupId);
      const scopedV = groupId ? (await supabase.from('villages').select('id, name').eq('group_id', groupId).order('name')).data : null;
      const [{ data: e }, v] = await Promise.all([eq, scopedV && scopedV.length ? Promise.resolve(scopedV) : supabase.from('villages').select('id, name').order('name').then((r) => r.data)]);
      setElections(e || []); setVillages(v || []);
      loadCodes();
    })();
  }, [groupId, router, loadCodes]);

  // 그룹 기준 접근 선거: 임원 코드 = 그룹의 임원 선거 전부, 총대 코드 = 고른 마을의 총대 선거
  const access = groupId
    ? elections.filter((e) => e.election_type === codeType && (codeType === 'officer' || e.village_id === selectedVillage)).map((e) => e.id)
    : selectedElections;

  const generate = async () => {
    if (codeType === 'delegate' && !selectedVillage) { setAlert({ title: '입력 오류', message: '총대 코드는 마을을 선택해야 합니다.' }); return; }
    if (access.length === 0) { setAlert({ title: '입력 오류', message: groupId ? '이 코드로 참여할 선거가 없습니다. 선거를 먼저 만드세요.' : '접근 가능한 선거를 최소 1개 선택하세요.' }); return; }
    if (quantity < 1 || quantity > 1000) { setAlert({ title: '입력 오류', message: '생성 개수는 1~1000개 사이여야 합니다.' }); return; }
    setGenerating(true);
    const err = await insertCodes(quantity, { code_type: codeType, accessible_elections: access, village_id: codeType === 'delegate' ? selectedVillage : null, group_id: groupId || null });
    setGenerating(false);
    if (err) { setAlert({ title: '생성 실패', message: err }); return; }
    setShowCreate(false); setSelectedElections([]); setSelectedVillage(''); setQuantity(10);
    loadCodes();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await createClient().from('voter_codes').delete().eq('id', toDelete);
    if (error) { setAlert({ title: '오류', message: '코드 삭제에 실패했습니다.' }); return; }
    loadCodes();
  };

  const all = codes || [];
  const rows = all
    .filter((c) => filter === 'all' || (filter === 'voted' ? c.is_used : filter === 'attended' ? !!c.first_login_at && !c.is_used : !c.first_login_at))
    .filter((c) => !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.voter_name?.toLowerCase().includes(search.toLowerCase()));
  const counts = { used: all.filter((c) => c.is_used).length, attended: all.filter((c) => c.first_login_at && !c.is_used).length, absent: all.filter((c) => !c.first_login_at).length };
  const typeElections = elections.filter((e) => e.election_type === codeType);
  const round = rounds.find((r) => r.id === groupId);

  return (
    <>
      <PageHead eyebrow="투표자" title="참여코드" desc="투표자에게 나눠줄 코드입니다. 임원 코드는 회차의 모든 임원 선거에, 총대 코드는 해당 마을 선거에 씁니다."
        actions={
          <>
            {round && <Link href={`/admin/election-groups/${round.id}`} className="btn btn-secondary">회차로</Link>}
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">코드 생성</button>
          </>
        } />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="text-sm muted">회차</label>
        <select className="input select" style={{ maxWidth: 320 }} value={groupId ?? ''} onChange={(e) => router.replace(e.target.value ? `/admin/codes?group_id=${e.target.value}` : '/admin/codes')}>
          <option value="">전체 (회차 구분 없음)</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.title}{r.status === 'closed' ? ' (보관)' : ''}</option>)}
        </select>
      </div>

      <div className="stats">
        <Stat label="전체" value={all.length} />
        <Stat label="투표 완료" value={counts.used} accent />
        <Stat label="참석 확인" value={counts.attended} />
        <Stat label="미참석" value={counts.absent} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-8 mb-4">
        <Tabs value={filter} onChange={setFilter} items={[{ value: 'all', label: '전체' }, { value: 'voted', label: '투표 완료' }, { value: 'attended', label: '참석 확인' }, { value: 'not_attended', label: '미참석' }]} />
        <input className="input" style={{ maxWidth: 240 }} placeholder="코드 또는 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
      </div>

      {codes === null ? (
        <div className="py-16 flex justify-center"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <Empty title="참여코드가 없습니다" action={<button onClick={() => setShowCreate(true)} className="btn btn-primary">코드 생성</button>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>코드</th><th>유형</th><th>마을</th><th>이름</th><th>상태</th><th>생성일</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="mono font-semibold">{c.code}</td>
                  <td className="muted">{c.code_type === 'delegate' ? '총대' : '임원'}</td>
                  <td className="muted">{villageName(c)}</td>
                  <td className="muted">{c.voter_name || '–'}</td>
                  <td>{c.is_used ? <Badge tone="ok">투표 완료</Badge> : c.first_login_at ? <Badge tone="accent">참석 확인</Badge> : <Badge>미참석</Badge>}</td>
                  <td className="muted">{fmtDate(c.created_at)}</td>
                  <td className="text-right"><button onClick={() => setToDelete(c.id)} disabled={c.is_used} className="btn btn-ghost btn-sm danger">삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} title={round ? `참여코드 생성 · ${round.title}` : '참여코드 생성'} onClose={() => setShowCreate(false)} size="lg"
        footer={<><button onClick={() => setShowCreate(false)} className="btn btn-secondary">취소</button><button onClick={generate} disabled={generating} className="btn btn-primary">{generating ? '생성 중' : '생성'}</button></>}>
        <Field label="코드 유형" required>
          <div className="choice">
            <button type="button" className="row" aria-pressed={codeType === 'officer'} onClick={() => { setCodeType('officer'); setSelectedVillage(''); setSelectedElections([]); }}><strong>임원 코드</strong><span>회차의 모든 임원 선거</span></button>
            <button type="button" className="row" aria-pressed={codeType === 'delegate'} onClick={() => { setCodeType('delegate'); setSelectedElections([]); }}><strong>총대 코드</strong><span>마을 하나의 총대 선거</span></button>
          </div>
        </Field>

        <Field label="생성 개수" required htmlFor="qty" hint="최대 1000개">
          <input id="qty" type="number" min={1} max={1000} className="input" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} />
        </Field>

        {codeType === 'delegate' && (
          <Field label="마을" required htmlFor="village">
            <select id="village" className="input select" value={selectedVillage} onChange={(e) => setSelectedVillage(e.target.value)}>
              <option value="">마을을 선택하세요</option>
              {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="참여할 선거" required>
          {groupId ? (
            <ul className="text-sm muted list-disc pl-5">
              {elections.filter((e) => access.includes(e.id)).map((e) => <li key={e.id}>{e.title}</li>)}
              {access.length === 0 && <li>{codeType === 'delegate' && !selectedVillage ? '마을을 고르면 해당 선거가 표시됩니다.' : '해당하는 선거가 없습니다.'}</li>}
            </ul>
          ) : typeElections.length === 0 ? (
            <p className="text-sm muted">{codeType === 'delegate' ? '총대' : '임원'} 선거가 없습니다.</p>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {typeElections.map((e) => (
                <label key={e.id} className="check">
                  <input type="checkbox" checked={selectedElections.includes(e.id)} onChange={() => setSelectedElections(selectedElections.includes(e.id) ? selectedElections.filter((x) => x !== e.id) : [...selectedElections, e.id])} />
                  {e.title}
                </label>
              ))}
            </div>
          )}
        </Field>
      </Modal>

      <AlertModal isOpen={!!alert} onClose={() => setAlert(null)} message={alert?.message ?? ''} title={alert?.title} />
      <ConfirmModal isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} variant="danger" title="코드 삭제" message="이 참여코드를 삭제하시겠습니까?" confirmText="삭제" />
    </>
  );
}

export default function CodesPage() {
  return <Suspense fallback={<div className="py-16 flex justify-center"><span className="spinner" /></div>}><CodesPageContent /></Suspense>;
}
