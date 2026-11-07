'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PageHead, Tabs, Badge, Empty, Modal, Field, fmtDate } from '@/components/ui';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface Village { id: string; name: string; is_active: boolean; created_at: string; }

export default function VillagesPage() {
  const [villages, setVillages] = useState<Village[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null);
  const [alert, setAlert] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient().from('villages').select('id, name, is_active, created_at').order('name');
    if (error) { console.error(error); return; }
    setVillages(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) { setAlert('마을 이름을 입력해 주세요.'); return; }
    const supabase = createClient();
    const { error } = editing.id
      ? await supabase.from('villages').update({ name: editing.name.trim() }).eq('id', editing.id)
      : await supabase.from('villages').insert([{ name: editing.name.trim() }]);
    if (error) { setAlert('저장에 실패했습니다.'); return; }
    setEditing(null);
    load();
  };

  const toggle = async (v: Village) => {
    const { error } = await createClient().from('villages').update({ is_active: !v.is_active }).eq('id', v.id);
    if (error) { setAlert('상태 변경에 실패했습니다.'); return; }
    load();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await createClient().from('villages').delete().eq('id', toDelete);
    if (error) { setAlert('마을 삭제에 실패했습니다.'); return; }
    load();
  };

  const all = villages || [];
  const rows = all
    .filter((v) => filter === 'all' || (filter === 'active') === v.is_active)
    .sort((a, b) => {
      const c = sortBy === 'name' ? a.name.localeCompare(b.name, 'ko') : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? c : -c;
    });
  const sort = (k: typeof sortBy) => { if (sortBy === k) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortOrder('asc'); } };
  const arrow = (k: typeof sortBy) => sortBy === k ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <>
      <PageHead eyebrow="기준 정보" title="마을" desc="총대 선출의 단위입니다. 비활성 마을은 일괄 생성 목록에서 빠집니다."
        actions={<button onClick={() => setEditing({ name: '' })} className="btn btn-primary">새 마을</button>} />

      <div className="mb-4">
        <Tabs value={filter} onChange={setFilter} items={[
          { value: 'active', label: `활성 ${all.filter((v) => v.is_active).length}` },
          { value: 'inactive', label: `비활성 ${all.filter((v) => !v.is_active).length}` },
          { value: 'all', label: `전체 ${all.length}` },
        ]} />
      </div>

      {villages === null ? (
        <div className="py-16 flex justify-center"><span className="spinner" /></div>
      ) : rows.length === 0 ? (
        <Empty title="마을이 없습니다" action={<button onClick={() => setEditing({ name: '' })} className="btn btn-primary">마을 추가</button>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => sort('name')}>마을{arrow('name')}</th>
                <th>상태</th>
                <th className="sortable" onClick={() => sort('created_at')}>등록일{arrow('created_at')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">{v.name}</td>
                  <td>
                    <button onClick={() => toggle(v)} title="눌러서 전환">
                      <Badge tone={v.is_active ? 'ok' : undefined}>{v.is_active ? '활성' : '비활성'}</Badge>
                    </button>
                  </td>
                  <td className="muted">{fmtDate(v.created_at)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => setEditing({ id: v.id, name: v.name })} className="btn btn-ghost btn-sm">수정</button>
                    <button onClick={() => setToDelete(v.id)} className="btn btn-ghost btn-sm danger">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} title={editing?.id ? '마을 수정' : '새 마을'} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save}>
            <Field label="마을 이름" htmlFor="vname">
              <input id="vname" className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="예: 갈보리" autoFocus />
            </Field>
            <div className="foot">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">취소</button>
              <button type="submit" className="btn btn-primary">{editing.id ? '저장' : '추가'}</button>
            </div>
          </form>
        )}
      </Modal>

      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="알림" />
      <ConfirmModal isOpen={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove} variant="danger" title="마을 삭제"
        message="이 마을을 삭제하시겠습니까? 이 마을의 선거와 코드도 함께 삭제됩니다." confirmText="삭제" />
    </>
  );
}
