'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Field } from '@/components/ui';
import AlertModal from '@/components/AlertModal';

interface PrevRound { id: string; title: string; villages: string[]; }

export default function CreateRoundPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prev, setPrev] = useState<PrevRound[]>([]);
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState('');

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: gs }, { data: vs }] = await Promise.all([
        supabase.from('election_groups').select('id, title').order('created_at', { ascending: false }).limit(10),
        supabase.from('villages').select('name, group_id').not('group_id', 'is', null),
      ]);
      const rounds = (gs || []).map((g) => ({ id: g.id, title: g.title, villages: (vs || []).filter((v) => v.group_id === g.id).map((v) => v.name) }))
        .filter((r) => r.villages.length > 0);
      setPrev(rounds);
      if (rounds[0]) setSource(rounds[0].id);
    })();
  }, []);

  const chosen = prev.find((p) => p.id === source);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setAlert('회차 이름을 입력해 주세요.'); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('election_groups')
      .insert({ title: title.trim(), description: description.trim() || null, group_type: 'mixed', status: 'waiting' }).select('id').single();
    if (error || !data) { setSubmitting(false); setAlert('회차 생성에 실패했습니다. 마이그레이션(2026-11-rounds-and-indexes.sql)이 적용됐는지 확인하세요.'); return; }
    if (chosen && chosen.villages.length > 0) {
      await supabase.from('villages').insert(chosen.villages.map((name) => ({ name, group_id: data.id })));
    }
    router.push(`/admin/election-groups/${data.id}`);
  };

  return (
    <>
      <PageHead eyebrow="회차" title="새 회차" desc="이번 선거의 이름을 정하고, 마을은 지난 회차에서 가져와 고치면 됩니다." />

      <form onSubmit={submit} className="max-w-2xl">
        <div className="panel">
          <Field label="회차 이름" required htmlFor="title">
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026년 상반기" required autoComplete="off" />
          </Field>
          <Field label="메모" htmlFor="desc" hint="선택 사항입니다.">
            <textarea id="desc" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="마을 가져오기" htmlFor="source" hint={chosen ? `${chosen.villages.length}개 마을이 복사됩니다: ${chosen.villages.join(', ')}` : '지난 회차에 등록된 마을이 없으면 회차를 만든 뒤 직접 추가합니다.'}>
            <select id="source" className="input select" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">가져오지 않음</option>
              {prev.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.villages.length}개 마을)</option>)}
            </select>
          </Field>
        </div>
        <div className="flex gap-2 mt-6">
          <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? '생성 중' : '회차 생성'}</button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">취소</button>
        </div>
      </form>

      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="알림" />
    </>
  );
}
