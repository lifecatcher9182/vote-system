'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';

interface QRCodeSectionProps {
  electionId: string;
  title: string;
}

export default function QRCodeSection({ electionId, title }: QRCodeSectionProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  
  // 투표 페이지 URL 생성
  const voteUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/vote?election=${electionId}`
    : '';

  // PNG로 다운로드
  const downloadPNG = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 512;
    canvas.height = 512;

    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `투표QR_${title.replace(/\s/g, '_')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // URL 복사
  const copyUrl = () => {
    navigator.clipboard.writeText(voteUrl);
    alert('URL이 복사되었습니다!');
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">📱 투표 QR 코드</h2>
      
      <div className="text-center">
        <div 
          ref={qrRef}
          className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg mb-4"
        >
          <QRCodeSVG 
            value={voteUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-2">투표 URL</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={voteUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-sm"
            />
            <button
              onClick={copyUrl}
              className="px-3 py-2 bg-[var(--color-secondary)] text-white rounded hover:opacity-90 text-sm whitespace-nowrap"
            >
              복사
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={downloadPNG}
            className="w-full px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 text-sm font-medium"
          >
            💾 PNG로 다운로드
          </button>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 text-left">
          <p className="font-semibold mb-2">💡 활용 방법</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>주보에 QR 코드를 넣어 배포하세요</li>
            <li>현수막이나 포스터에 인쇄하세요</li>
            <li>단체 카톡방에 이미지를 공유하세요</li>
            <li>스캔만 하면 바로 투표 페이지로!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
