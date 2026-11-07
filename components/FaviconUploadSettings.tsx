'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import AlertModal from './AlertModal';

export default function FaviconUploadSettings() {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    createClient().from('system_config').select('favicon_url').limit(1).single()
      .then(({ data }) => { if (data?.favicon_url) setFaviconUrl(data.favicon_url); });
  }, []);

  const saveUrl = async (url: string | null) => {
    const supabase = createClient();
    const { data: existing } = await supabase.from('system_config').select('id').limit(1).single();
    const r = existing
      ? await supabase.from('system_config').update({ favicon_url: url, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await supabase.from('system_config').insert([{ favicon_url: url }]);
    if (r.error) throw r.error;
  };

  const removeStored = async (url: string) => {
    const name = url.split('/').pop();
    if (name) await createClient().storage.from('logos').remove([`favicon/${name}`]);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAlert({ title: '파일 형식', message: '이미지 파일만 올릴 수 있습니다.' }); return; }
    if (file.size > 2 * 1024 * 1024) { setAlert({ title: '파일 크기', message: '2MB 이하여야 합니다.' }); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      if (faviconUrl) await removeStored(faviconUrl);
      const name = `favicon-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from('logos').upload(`favicon/${name}`, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const url = supabase.storage.from('logos').getPublicUrl(`favicon/${name}`).data.publicUrl;
      await saveUrl(url);
      setFaviconUrl(url);
      setAlert({ title: '완료', message: '파비콘을 올렸습니다. 새로고침하면 탭 아이콘이 바뀝니다.' });
    } catch (err) {
      setAlert({ title: '업로드 오류', message: (err as Error).message || '알 수 없는 오류' });
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!faviconUrl) return;
    setUploading(true);
    try {
      await removeStored(faviconUrl);
      await saveUrl(null);
      setFaviconUrl(null);
    } catch {
      setAlert({ title: '삭제 오류', message: '파비콘 삭제에 실패했습니다.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="panel">
      <h2>파비콘</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-md" style={{ background: 'var(--paper-2)', border: '1px dashed var(--rule-2)' }}>
          {faviconUrl ? <Image src={faviconUrl} alt="파비콘" width={40} height={40} className="object-contain" /> : <span className="text-xs faint">없음</span>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm muted">브라우저 탭 아이콘. 정사각형 PNG 권장, 2MB 이하.</p>
          <div className="flex gap-2 mt-3">
            <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="hidden" id="favicon-input" />
            <label htmlFor="favicon-input" className={`btn btn-secondary${uploading ? ' opacity-50 pointer-events-none' : ''}`}>
              {uploading ? '처리 중' : faviconUrl ? '다시 올리기' : '파비콘 올리기'}
            </label>
            {faviconUrl && <button onClick={remove} disabled={uploading} className="btn btn-ghost danger">삭제</button>}
          </div>
        </div>
      </div>
      <AlertModal isOpen={!!alert} onClose={() => setAlert(null)} message={alert?.message ?? ''} title={alert?.title} />
    </section>
  );
}
