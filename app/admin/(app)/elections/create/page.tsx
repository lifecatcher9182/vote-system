'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { WinningCriteria } from '@/lib/database.types';
import { PageHead, Field, Badge } from '@/components/ui';
import AlertModal from '@/components/AlertModal';

interface Village { id: string; name: string; is_active: boolean; }
interface Candidate { id: string; name: string; }
type Criteria = 'plurality' | 'absolute_majority' | 'percentage';

function CreateElectionPageContent() {
  const router = useRouter();
  const groupId = useSearchParams().get('group_id');
  const [submitting, setSubmitting] = useState(false);
  const [villages, setVillages] = useState<Village[]>([]);
  const [groupInfo, setGroupInfo] = useState<{ title: string; group_type: 'delegate' | 'officer' } | null>(null);

  const [title, setTitle] = useState('');
  const [electionType, setElectionType] = useState<'delegate' | 'officer'>('delegate');
  const [villageId, setVillageId] = useState('');
  const [position, setPosition] = useState('');
  const [round, setRound] = useState(1);
  const [maxSelections, setMaxSelections] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>([{ id: '1', name: '' }, { id: '2', name: '' }]);
  const [criteriaType, setCriteriaType] = useState<Criteria>('plurality');
  const [percentage, setPercentage] = useState(66.67);
  const [base, setBase] = useState<'attended' | 'issued'>('attended');
  const [alert, setAlert] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      if (groupId) {
        const { data } = await supabase.from('election_groups').select('title, group_type').eq('id', groupId).single();
        if (data) { setGroupInfo(data); setElectionType(data.group_type); }
      }
      const { data: v } = await supabase.from('villages').select('id, name, is_active').order('name');
      setVillages(v || []);
    })();
  }, [groupId]);

  const validCandidates = candidates.filter((c) => c.name.trim());

  const validate = () => {
    if (!title.trim()) return '선거 제목을 입력하세요.';
    if (electionType === 'delegate' && !villageId) return '마을을 선택하세요.';
    if (electionType === 'officer' && !position.trim()) return '직책을 입력하세요.';
    if (validCandidates.length < 2) return '후보자를 2명 이상 입력하세요.';
    if (maxSelections < 1) return '선출 인원은 1 이상이어야 합니다.';
    if (maxSelections > validCandidates.length) return '선출 인원은 후보자 수보다 클 수 없습니다.';
    return '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setAlert(err); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const winning_criteria: WinningCriteria =
        criteriaType === 'plurality' ? { type: 'plurality' } :
        criteriaType === 'absolute_majority' ? { type: 'absolute_majority' } : { type: 'percentage', percentage, base };
      const { data: election, error } = await supabase.from('elections').insert([{
        title: title.trim(), election_type: electionType, max_selections: maxSelections, round, status: 'waiting', winning_criteria,
        ...(groupId ? { group_id: groupId } : {}),
        ...(electionType === 'delegate' ? { village_id: villageId } : { position: position.trim() }),
      }]).select().single();
      if (error) { console.error(error); setAlert('선거 생성에 실패했습니다.'); return; }

      const { error: cErr } = await supabase.from('candidates')
        .insert(validCandidates.map((c) => ({ election_id: election.id, name: c.name.trim(), vote_count: 0 })));
      if (cErr) { console.error(cErr); setAlert('후보자 생성에 실패했습니다.'); return; }

      // 임원 그룹: 이미 발급된 코드가 새 선거에도 접근할 수 있게 갱신 (기존 로직)
      if (groupId && electionType === 'officer') {
        const { data: groupElections } = await supabase.from('elections').select('id').eq('group_id', groupId);
        if (groupElections) {
          const ids = groupElections.map((x) => x.id);
          const { data: existing } = await supabase.from('voter_codes').select('id, accessible_elections').eq('code_type', 'officer');
          const target = (existing || []).filter((c) => ids.some((id) => ((c.accessible_elections as string[]) || []).includes(id)));
          if (target.length > 0) await supabase.from('voter_codes').update({ accessible_elections: ids }).in('id', target.map((c) => c.id));
        }
      }
      router.push(groupId ? `/admin/election-groups/${groupId}` : `/admin/elections/${election.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const pctLabel = (v: number) => v === 66.67 ? '2/3' : v === 50 ? '과반' : `${v}%`;

  return (
    <>
      <PageHead eyebrow={groupInfo ? `그룹 · ${groupInfo.title}` : '선거'} title="새 선거" desc="선거 정보와 후보를 입력합니다. 만든 뒤 상태를 진행중으로 바꾸면 투표가 열립니다." />

      <form onSubmit={submit} className="max-w-2xl">
        <section className="panel">
          <h2>기본 정보</h2>
          <Field label="선거 제목" required htmlFor="title">
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026년 1차 회장 선출" required />
          </Field>

          <Field label="유형" required hint={groupInfo ? '그룹 유형을 따릅니다.' : undefined}>
            {groupInfo ? <Badge tone="accent">{electionType === 'delegate' ? '총대 선출' : '임원 선출'}</Badge> : (
              <div className="choice">
                <button type="button" className="row" aria-pressed={electionType === 'delegate'} onClick={() => setElectionType('delegate')}><strong>총대 선출</strong><span>마을 대표</span></button>
                <button type="button" className="row" aria-pressed={electionType === 'officer'} onClick={() => setElectionType('officer')}><strong>임원 선출</strong><span>회장·총무 등 직책</span></button>
              </div>
            )}
          </Field>

          {electionType === 'delegate' ? (
            <Field label="마을" required htmlFor="village"
              hint={villages.length === 0 ? <>마을이 없습니다. <Link href="/admin/villages" className="underline">마을 관리</Link>에서 먼저 추가하세요.</> : undefined}>
              <select id="village" className="input select" value={villageId} onChange={(e) => setVillageId(e.target.value)} required>
                <option value="">마을을 선택하세요</option>
                {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="직책" required htmlFor="position">
              <input id="position" className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="예: 회장, 총무, 회계, 서기" required />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="차수" htmlFor="round">
              <input id="round" type="number" min={1} className="input" value={round} onChange={(e) => setRound(parseInt(e.target.value) || 1)} />
            </Field>
            <Field label="선출 인원" htmlFor="max" hint="투표자가 골라야 하는 후보 수">
              <input id="max" type="number" min={1} className="input" value={maxSelections} onChange={(e) => setMaxSelections(parseInt(e.target.value) || 1)} />
            </Field>
          </div>
        </section>

        <section className="panel">
          <h2>당선 기준</h2>
          <div className="choice mb-4">
            {([['plurality', '최다 득표', '가장 많은 표를 받은 후보. 3차 투표용'], ['absolute_majority', '과반', '참석자의 50% 초과'], ['percentage', '득표율', '지정 비율 이상. 1·2차 투표용']] as [Criteria, string, string][]).map(([v, l, d]) => (
              <button key={v} type="button" className="row" aria-pressed={criteriaType === v} onClick={() => setCriteriaType(v)}><strong>{l}</strong><span>{d}</span></button>
            ))}
          </div>
          {criteriaType === 'percentage' && (
            <>
              <Field label="필요 득표율" htmlFor="pct">
                <div className="flex flex-wrap gap-2 mb-2">
                  {[50, 60, 66.67, 75].map((v) => (
                    <button key={v} type="button" className={`btn btn-sm ${percentage === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPercentage(v)}>{pctLabel(v)}</button>
                  ))}
                </div>
                <input id="pct" type="number" min={0} max={100} step={0.01} className="input" style={{ maxWidth: 160 }} value={percentage} onChange={(e) => setPercentage(parseFloat(e.target.value) || 50)} />
              </Field>
              <Field label="분모" hint={base === 'attended' ? '현장에서 코드를 입력한 인원 기준 (권장)' : '발급한 코드 수 기준'}>
                <div className="flex gap-2">
                  <button type="button" className={`btn btn-sm ${base === 'attended' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBase('attended')}>참석자</button>
                  <button type="button" className={`btn btn-sm ${base === 'issued' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setBase('issued')}>발급 코드</button>
                </div>
              </Field>
            </>
          )}
          <p className="notice">
            {criteriaType === 'plurality' && '최다 득표자가 당선됩니다.'}
            {criteriaType === 'absolute_majority' && '참석자의 50%를 초과해야 당선됩니다.'}
            {criteriaType === 'percentage' && `${base === 'attended' ? '참석자' : '발급 코드'}의 ${pctLabel(percentage)} 이상 득표해야 당선됩니다.`}
          </p>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>후보자 <span className="faint text-sm font-normal">2명 이상</span></h2>
            <button type="button" onClick={() => setCandidates([...candidates, { id: String(Date.now()), name: '' }])} className="btn btn-secondary btn-sm">후보 추가</button>
          </div>
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="mark">{i + 1}</span>
                <input className="input" value={c.name} placeholder="후보자 이름"
                  onChange={(e) => setCandidates(candidates.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))} />
                <button type="button" disabled={candidates.length <= 2} onClick={() => setCandidates(candidates.filter((x) => x.id !== c.id))} className="btn btn-ghost btn-sm danger">삭제</button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-2 mt-6">
          <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? '생성 중' : '선거 생성'}</button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">취소</button>
        </div>
      </form>

      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="알림" />
    </>
  );
}

export default function CreateElectionPage() {
  return <Suspense fallback={<div className="py-16 flex justify-center"><span className="spinner" /></div>}><CreateElectionPageContent /></Suspense>;
}
