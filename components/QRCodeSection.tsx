'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRef, useState } from 'react';

// 투표 입장 QR. 코드 입력 화면으로 연결된다 (선거별 링크는 없음).
export default function QRCodeSection({ title }: { electionId?: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/vote` : '';

  const download = () => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    img.onload = () => {
      canvas.getContext('2d')?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.download = `투표QR_${title.replace(/\s/g, '_')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="panel">
      <h2>투표 입장 QR</h2>
      <div className="flex flex-wrap items-center gap-5">
        <div ref={ref} className="p-2 bg-white rounded-md" style={{ border: '1px solid var(--rule)' }}>
          <QRCodeSVG value={url} size={144} level="H" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm muted">스캔하면 코드 입력 화면이 열립니다. 주보나 안내문에 넣어 쓰세요.</p>
          <p className="mt-2 text-xs mono faint break-all">{url}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={download} className="btn btn-secondary btn-sm">PNG 저장</button>
            <button onClick={copy} className="btn btn-ghost btn-sm">{copied ? '복사됨' : '링크 복사'}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
