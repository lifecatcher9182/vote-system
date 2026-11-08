'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { invalidateSystemConfig } from '@/lib/systemConfig';
import AlertModal from './AlertModal';
import ConfirmModal from './ConfirmModal';

const FILES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg'];

export default function LogoUploadSettings() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createClient().from('system_config').select('logo_url').limit(1).single()
      .then(({ data }) => { if (data?.logo_url) setLogoUrl(data.logo_url); });
  }, []);

  const saveUrl = async (url: string | null) => {
    const supabase = createClient();
    const { data: existing } = await supabase.from('system_config').select('id').limit(1).single();
    if (existing) await supabase.from('system_config').update({ logo_url: url, updated_at: new Date().toISOString() }).eq('id', existing.id);
    else await supabase.from('system_config').insert([{ logo_url: url }]);
    invalidateSystemConfig();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setAlert('PNG, JPG, SVG 파일만 올릴 수 있습니다.'); return; }
    if (file.size > 2 * 1024 * 1024) { setAlert('파일 크기는 2MB 이하여야 합니다.'); return; }

    setUploading(true);
    const supabase = createClient();
    await supabase.storage.from('logos').remove(FILES);
    const name = `logo.${file.name.split('.').pop()?.toLowerCase()}`;
    const { error } = await supabase.storage.from('logos').upload(name, file, { cacheControl: '3600', upsert: true });
    if (error) { setUploading(false); setAlert('업로드에 실패했습니다.'); return; }
    const url = supabase.storage.from('logos').getPublicUrl(name).data.publicUrl;
    await saveUrl(url);
    setLogoUrl(url);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async () => {
    await createClient().storage.from('logos').remove(FILES);
    await saveUrl(null);
    setLogoUrl(null);
  };

  return (
    <section className="panel">
      <h2>로고</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center justify-center w-28 h-28 rounded-md" style={{ background: 'var(--paper-2)', border: '1px dashed var(--rule-2)' }}>
          {logoUrl ? (
            <div className="relative w-20 h-20"><Image src={logoUrl} alt="로고" fill className="object-contain" /></div>
          ) : <span className="text-xs faint">없음</span>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm muted">투표 화면과 관리자 메뉴에 표시됩니다. PNG, JPG, SVG, 2MB 이하.</p>
          <div className="flex gap-2 mt-3">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onFile} disabled={uploading} className="hidden" id="logo-input" />
            <label htmlFor="logo-input" className={`btn btn-secondary${uploading ? ' opacity-50 pointer-events-none' : ''}`}>
              {uploading ? '업로드 중' : logoUrl ? '다시 올리기' : '로고 올리기'}
            </label>
            {logoUrl && <button onClick={() => setConfirmDelete(true)} disabled={uploading} className="btn btn-ghost danger">삭제</button>}
          </div>
        </div>
      </div>
      <AlertModal isOpen={!!alert} onClose={() => setAlert('')} message={alert} title="로고" />
      <ConfirmModal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} variant="danger" title="로고 삭제" message="로고를 삭제하시겠습니까?" confirmText="삭제" />
    </section>
  );
}
