'use client';

import { useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { createClient } from '@/lib/supabase/client';
import { invalidateSystemConfig } from '@/lib/systemConfig';
import { Field } from '@/components/ui';
import AlertModal from './AlertModal';

const DEFAULT = '#1d4ed8';

// 강조색 하나만 관리한다. 배경색(primary_color)은 더 이상 화면에 쓰이지 않지만 DB 값은 보존한다.
export default function ColorThemeSettings() {
  const [color, setColor] = useState(DEFAULT);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState('');

  useEffect(() => {
    createClient().from('system_config').select('secondary_color').limit(1).single()
      .then(({ data }) => { if (data?.secondary_color) setColor(data.secondary_color); });
  }, []);

  const apply = (c: string) => document.documentElement.style.setProperty('--color-secondary', c);

  const save = async () => {
    if (!/^#[0-9a-f]{6}$/i.test(color)) { setAlert('색상은 #RRGGBB 형식이어야 합니다.'); return; }
    setSaving(true);
    const supabase = createClient();
    const { data: existing } = await supabase.from('system_config').select('id').limit(1).single();
    const { error } = existing
      ? await supabase.from('system_config').update({ secondary_color: color, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('system_config').insert([{ secondary_color: color }]);
    setSaving(false);
    if (error) { setAlert(`저장에 실패했습니다.\n${error.message}`); return; }
    invalidateSystemConfig();
    apply(color);
    setAlert('강조색을 저장했습니다.');
  };

  return (
    <section className="panel">
      <h2>강조색</h2>
      <Field label="버튼·선택 표시에 쓰는 색" hint="투표 화면과 관리자 화면 전체에 적용됩니다.">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button type="button" onClick={() => setOpen(!open)} className="w-12 h-12 rounded-md" style={{ background: color, border: '1px solid var(--rule-2)' }} aria-label="색 고르기" />
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute z-20 mt-2 rounded-md overflow-hidden" style={{ boxShadow: 'var(--shadow-xl)' }}>
                  <HexColorPicker color={color} onChange={setColor} />
                </div>
              </>
            )}
          </div>
          <input className="input w-40" style={{ fontFamily: 'var(--font-mono)' }} value={color} onChange={(e) => setColor(e.target.value)} />
          <button type="button" onClick={() => apply(color)} className="btn btn-secondary">미리보기</button>
        </div>
      </Field>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? '저장 중' : '저장'}</button>
        <button onClick={() => { setColor(DEFAULT); apply(DEFAULT); }} className="btn btn-ghost">기본값</button>
      </div>
      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="강조색" />
    </section>
  );
}
