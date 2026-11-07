'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Field } from '@/components/ui';
import AlertModal from '@/components/AlertModal';

export default function CreateElectionGroupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState('');
  const [form, setForm] = useState({ title: '', description: '', group_type: 'delegate' as 'delegate' | 'officer' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setAlert('그룹 제목을 입력해 주세요.'); return; }
    setSubmitting(true);
    const { data, error } = await createClient().from('election_groups')
      .insert({ title: form.title.trim(), description: form.description.trim() || null, group_type: form.group_type, status: 'waiting' })
      .select().single();
    setSubmitting(false);
    if (error) { console.error(error); setAlert('그룹 생성에 실패했습니다.'); return; }
    router.push(`/admin/election-groups/${data.id}`);
  };

  return (
    <>
      <PageHead eyebrow="투표 그룹" title="새 투표 그룹" desc="참여자는 코드 하나로 그룹 안의 모든 선거에 순서대로 참여합니다." />

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="panel">
          <Field label="그룹 유형" required>
            <div className="choice">
              <button type="button" className="row" aria-pressed={form.group_type === 'delegate'} onClick={() => setForm({ ...form, group_type: 'delegate' })}>
                <strong>총대 투표</strong><span>마을별 총대 선출 선거를 묶음</span>
              </button>
              <button type="button" className="row" aria-pressed={form.group_type === 'officer'} onClick={() => setForm({ ...form, group_type: 'officer' })}>
                <strong>임원 투표</strong><span>직책별 임원 선출 선거를 묶음</span>
              </button>
            </div>
          </Field>

          <Field label="그룹 제목" required htmlFor="title">
            <input id="title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 2026년 상반기 총대 투표" required />
          </Field>

          <Field label="설명" htmlFor="desc" hint="선택 사항입니다.">
            <textarea id="desc" className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <p className="notice">
            그룹을 만든 뒤 {form.group_type === 'delegate' ? '마을별' : '직책별'} 선거를 일괄 생성할 수 있습니다.
          </p>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="submit" disabled={submitting} className="btn btn-primary">{submitting ? '생성 중' : '그룹 생성'}</button>
          <button type="button" onClick={() => router.back()} className="btn btn-secondary">취소</button>
        </div>
      </form>

      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="알림" />
    </>
  );
}
