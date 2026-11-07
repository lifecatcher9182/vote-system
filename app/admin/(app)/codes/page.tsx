'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
interface Election { id: string; title: string; election_type: 'delegate' | 'officer'; status: string; }
interface Village { id: string; name: string; }
type Filter = 'all' | 'voted' | 'attended' | 'not_attended';

const villageName = (c: VoterCode) => (Array.isArray(c.villages) ? c.villages[0]?.name : c.villages?.name) || '–';

function CodesPageContent() {
  const groupId = useSearchParams().get('group_id');
  const [codes, setCodes] = useState<VoterCode[] | null>(null);
  const [elections, setElections] = useState<Election[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [groupInfo, setGroupInfo] = useState<{ title: string; group_type: 'delegate' | 'officer' } | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [codeType, setCodeType] = useState<'delegate' | 'officer'>('delegate');
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
      if (groupId) {
        const { data } = await supabase.from('election_groups').select('title, group_type').eq('id', groupId).single();
        if (data) { setGroupInfo(data); setCodeType(data.group_type); }
      }
      let q = supabase.from('elections').select('id, title, election_type, status').order('created_at', { ascending: false });
      if (groupId) q = q.eq('group_id', groupId);
      const [{ data: e }, { data: v }] = await Promise.all([q, supabase.from('villages').select('id, name').order('name')]);
      setElections(e || []); setVillages(v || []);
      loadCodes();
    })();
  }, [groupId, loadCodes]);

  const generate = async () => {
    const access = groupId ? elections.map((e) => e.id) : selectedElections;
    if (access.length === 0) { setAlert({ title: '입력 오류', message: '접근 가능한 선거를 최소 1개 선택하세요.' }); return; }
    if (codeType === 'delegate' && !selectedVillage) { setAlert({ title: '입력 오류', message: '총대 코드는 마을을 선택해야 합니다.' }); return; }
    if (quantity < 1 || quantity > 1000) { setAlert({ title: '입력 오류', message: '생성 개수는 1~1000개 사이여야 합니다.' }); return; }

    setGenerating(true);
    const err = await insertCodes(quantity, {
      code_type: codeType, accessible_elections: access,
      village_id: codeType === 'delegate' ? selectedVillage : null,
      group_id: groupId || null,
    });
    setGenerating(false);
    if (err) { setAlert({ title: '생성 실패', message: err }); return; }
    setAlert({ title: '생성 완료', message: `참여코드 ${quantity}개를 만들었습니다.` });
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
  const counts = {
    used: all.filter((c) => c.is_used).length,
    attended: all.filter((c) => c.first_login_at && !c.is_used).length,
    absent: all.filter((c) => !c.first_login_at).length,
  };
  const typeElections = elections.filter((e) => e.election_type === codeType);

  return (
    <>
      <PageHead eyebrow={groupInfo ? `${groupInfo.group_type === 'delegate' ? '총대' : '임원'} 그룹 · ${groupInfo.title}` : '투표자'}
        title="참여코드" desc="투표자에게 나눠줄 코드입니다. 코드 하나로 지정된 선거에 모두 참여합니다."
        actions={
          <>
            {groupId && <Link href={`/admin/election-groups/${groupId}`} className="btn btn-secondary">그룹으로</Link>}
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">코드 생성</button>
          </>
        } />

      <div className="stats">
        <Stat label="전체" value={all.length} />
        <Stat label="투표 완료" value={counts.used} accent />
        <Stat label="참석 확인" value={counts.attended} />
        <Stat label="미참석" value={counts.absent} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-8 mb-4">
        <Tabs value={filter} onChange={setFilter} items={[
          { value: 'all', label: '전체' }, { value: 'voted', label: '투표 완료' }, { value: 'attended', label: '참석 확인' }, { value: 'not_attended', label: '미참석' },
        ]} />
        <input className="input" style={{ maxWidth: 240 }} placeholder="코드 또는 이름 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
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

      <Modal open={showCreate} title="참여코드 생성" onClose={() => setShowCreate(false)} size="lg"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="btn btn-secondary">취소</button>
            <button onClick={generate} disabled={generating} className="btn btn-primary">{generating ? '생성 중' : '생성'}</button>
          </>
        }>
        <Field label="코드 유형" required hint={groupId ? '그룹 유형을 따릅니다.' : undefined}>
          {groupId ? (
            <Badge tone="accent">{codeType === 'delegate' ? '총대 코드' : '임원 코드'}</Badge>
          ) : (
            <div className="choice">
              <button type="button" className="row" aria-pressed={codeType === 'delegate'} onClick={() => { setCodeType('delegate'); setSelectedElections([]); }}><strong>총대 코드</strong><span>마을 지정 필요</span></button>
              <button type="button" className="row" aria-pressed={codeType === 'officer'} onClick={() => { setCodeType('officer'); setSelectedVillage(''); setSelectedElections([]); }}><strong>임원 코드</strong><span>직책 선거용</span></button>
            </div>
          )}
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

        <Field label="접근 가능한 선거" required>
          {groupId ? (
            <ul className="text-sm muted list-disc pl-5">
              {elections.map((e) => <li key={e.id}>{e.title}</li>)}
              {elections.length === 0 && <li>이 그룹에 선거가 없습니다.</li>}
            </ul>
          ) : typeElections.length === 0 ? (
            <p className="text-sm muted">{codeType === 'delegate' ? '총대' : '임원'} 선거가 없습니다. <Link href="/admin/elections/create" className="underline">먼저 선거를 만드세요.</Link></p>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {typeElections.map((e) => (
                <label key={e.id} className="check">
                  <input type="checkbox" checked={selectedElections.includes(e.id)}
                    onChange={() => setSelectedElections(selectedElections.includes(e.id) ? selectedElections.filter((x) => x !== e.id) : [...selectedElections, e.id])} />
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
