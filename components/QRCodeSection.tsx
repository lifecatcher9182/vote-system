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

  // 인쇄용 페이지 열기
  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>투표 QR 코드 - ${title}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { margin: 0; }
          }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 2rem;
          }
          .container {
            text-align: center;
            border: 2px solid #e5e7eb;
            padding: 2rem;
            border-radius: 1rem;
            background: white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          h1 {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: #1f2937;
          }
          .subtitle {
            font-size: 1.25rem;
            color: #6b7280;
            margin-bottom: 2rem;
          }
          .qr-container {
            display: inline-block;
            padding: 1.5rem;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
          }
          .url {
            font-size: 0.875rem;
            color: #6b7280;
            margin-top: 1rem;
            word-break: break-all;
          }
          .instructions {
            margin-top: 2rem;
            padding: 1rem;
            background: #f3f4f6;
            border-radius: 0.5rem;
            text-align: left;
          }
          .instructions h2 {
            font-size: 1rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: #1f2937;
          }
          .instructions ol {
            margin-left: 1.5rem;
            color: #4b5563;
          }
          .instructions li {
            margin-bottom: 0.25rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📱 청년국 투표</h1>
          <div class="subtitle">${title}</div>
          
          <div class="qr-container">
            ${svgData}
          </div>
          
          <div class="url">
            <strong>투표 URL:</strong><br>
            ${voteUrl}
          </div>

          <div class="instructions">
            <h2>📋 투표 방법</h2>
            <ol>
              <li>스마트폰 카메라로 QR 코드를 스캔하세요</li>
              <li>참여코드를 입력하세요</li>
              <li>후보자를 선택하고 투표하세요</li>
            </ol>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
          <button
            onClick={printQR}
            className="w-full px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 text-sm font-medium"
          >
            🖨️ 인쇄하기
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
