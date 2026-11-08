'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { invalidateSystemConfig } from '@/lib/systemConfig';
import { useAdmin } from '@/components/admin/Shell';
import { PageHead, Field, Badge, fmtDate } from '@/components/ui';
import LogoUploadSettings from '@/components/LogoUploadSettings';
import FaviconUploadSettings from '@/components/FaviconUploadSettings';
import ColorThemeSettings from '@/components/ColorThemeSettings';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface AdminEmail { id: string; email: string; created_at: string; }
const SYSTEM_ADMIN = 'lifecatcher9182@gmail.com';

export default function SettingsPage() {
  const { email: me } = useAdmin();
  const [admins, setAdmins] = useState<AdminEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [systemName, setSystemName] = useState('청년국 투표 시스템');
  const [systemDescription, setSystemDescription] = useState('투명하고 안전한 온라인 투표 시스템');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const [toRemove, setToRemove] = useState<AdminEmail | null>(null);

  const loadAdmins = useCallback(async () => {
    const { data } = await createClient().from('admin_emails').select('id, email, created_at').order('created_at');
    setAdmins(data || []);
  }, []);

  useEffect(() => {
    loadAdmins();
    createClient().from('system_config').select('system_name, system_description').limit(1).single().then(({ data }) => {
      if (data?.system_name) setSystemName(data.system_name);
      if (data?.system_description) setSystemDescription(data.system_description);
    });
  }, [loadAdmins]);

  const addAdmin = async () => {
    const email = newEmail.trim();
    if (!email) { setAlert({ title: '입력 오류', message: '이메일을 입력하세요.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAlert({ title: '입력 오류', message: '올바른 이메일 형식이 아닙니다.' }); return; }
    if (admins.some((a) => a.email === email)) { setAlert({ title: '등록 불가', message: '이미 등록된 관리자입니다.' }); return; }
    const { error } = await createClient().from('admin_emails').insert([{ email }]);
    if (error) { setAlert({ title: '오류', message: `관리자 추가에 실패했습니다.\n${error.message}` }); return; }
    setNewEmail('');
    loadAdmins();
  };

  const askRemove = (a: AdminEmail) => {
    if (a.email === SYSTEM_ADMIN) { setAlert({ title: '삭제 불가', message: '시스템 관리자 계정은 삭제할 수 없습니다.' }); return; }
    if (a.email === me) { setAlert({ title: '삭제 불가', message: '본인 계정은 삭제할 수 없습니다.' }); return; }
    if (admins.length <= 1) { setAlert({ title: '삭제 불가', message: '최소 한 명의 관리자가 필요합니다.' }); return; }
    setToRemove(a);
  };

  const removeAdmin = async () => {
    if (!toRemove) return;
    const { error } = await createClient().from('admin_emails').delete().eq('id', toRemove.id);
    if (error) { setAlert({ title: '오류', message: '관리자 삭제에 실패했습니다.' }); return; }
    loadAdmins();
  };

  const saveSystem = async () => {
    if (!systemName.trim() || !systemDescription.trim()) { setAlert({ title: '입력 오류', message: '이름과 설명을 모두 입력하세요.' }); return; }
    setSaving(true);
    const supabase = createClient();
    const { data: existing } = await supabase.from('system_config').select('id').limit(1).single();
    const payload = { system_name: systemName.trim(), system_description: systemDescription.trim() };
    const { error } = existing
      ? await supabase.from('system_config').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('system_config').insert([payload]);
    setSaving(false);
    if (!error) invalidateSystemConfig();
    setAlert(error ? { title: '오류', message: '저장에 실패했습니다.' } : { title: '저장 완료', message: '시스템 정보가 저장되었습니다.' });
  };

  return (
    <>
      <PageHead eyebrow="환경" title="설정" desc="투표 화면에 보이는 이름·로고·색상과 관리자 계정을 관리합니다." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <section className="panel">
            <h2>시스템 정보</h2>
            <Field label="시스템 이름" htmlFor="sname" hint="투표 화면 제목으로 쓰입니다.">
              <input id="sname" className="input" value={systemName} onChange={(e) => setSystemName(e.target.value)} />
            </Field>
            <Field label="설명" htmlFor="sdesc" hint="이름 아래 한 줄로 보입니다.">
              <input id="sdesc" className="input" value={systemDescription} onChange={(e) => setSystemDescription(e.target.value)} />
            </Field>
            <button onClick={saveSystem} disabled={saving} className="btn btn-primary">{saving ? '저장 중' : '저장'}</button>
          </section>

          <LogoUploadSettings />
          <FaviconUploadSettings />
          <ColorThemeSettings />
        </div>

        <section className="panel">
          <h2>관리자 계정 <span className="faint text-sm font-normal">{admins.length}명</span></h2>
          <div className="flex gap-2 mb-4">
            <input type="email" className="input" placeholder="name@gmail.com" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAdmin(); }} />
            <button onClick={addAdmin} className="btn btn-primary">추가</button>
          </div>
          <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {admins.map((a) => {
              const locked = a.email === me || a.email === SYSTEM_ADMIN;
              return (
                <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.email}</div>
                    <div className="text-xs faint mt-0.5 flex gap-2 items-center">
                      {fmtDate(a.created_at)}
                      {a.email === me && <Badge tone="accent">본인</Badge>}
                      {a.email === SYSTEM_ADMIN && <Badge tone="plain">시스템</Badge>}
                    </div>
                  </div>
                  <button onClick={() => askRemove(a)} disabled={locked} className="btn btn-ghost btn-sm danger">삭제</button>
                </li>
              );
            })}
          </ul>
          <p className="help mt-3 text-xs faint">추가된 이메일로 Google 로그인하면 바로 관리자 화면에 들어올 수 있습니다. 삭제된 계정은 즉시 권한을 잃습니다.</p>
        </section>
      </div>

      <AlertModal isOpen={!!alert} onClose={() => setAlert(null)} message={alert?.message ?? ''} title={alert?.title} />
      <ConfirmModal isOpen={!!toRemove} onClose={() => setToRemove(null)} onConfirm={removeAdmin} variant="danger" title="관리자 제거"
        message={`${toRemove?.email ?? ''} 계정을 관리자에서 제거하시겠습니까?`} confirmText="제거" />
    </>
  );
}
