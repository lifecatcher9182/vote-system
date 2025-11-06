'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VoteCompletePage() {
  const searchParams = useSearchParams();
  const electionTitle = searchParams.get('election') || '';

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--color-primary), #f3f4f6)' }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* 성공 아이콘 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-primary)] bg-opacity-10 rounded-full mb-4">
            <svg className="w-12 h-12 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            투표 완료!
          </h1>
          <p className="text-gray-600">
            투표가 성공적으로 제출되었습니다
          </p>
        </div>

        {/* 투표 정보 */}
        {electionTitle && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">투표한 선거</p>
            <p className="font-semibold text-gray-900">{electionTitle}</p>
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">안내사항</h2>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start">
              <span className="text-[var(--color-primary)] mr-2">✓</span>
              <span>투표 결과는 투표 종료 후 확인할 수 있습니다.</span>
            </li>
            <li className="flex items-start">
              <span className="text-[var(--color-primary)] mr-2">✓</span>
              <span>참여해 주셔서 감사합니다.</span>
            </li>
            <li className="flex items-start">
              <span className="text-amber-600 mr-2">⚠️</span>
              <span>이 참여코드는 이미 사용되었습니다.</span>
            </li>
          </ul>
        </div>

        {/* 홈으로 버튼 */}
        <Link
          href="/"
          className="block w-full bg-[var(--color-secondary)] text-white text-center py-3 rounded-lg font-semibold hover:opacity-90 transition-colors"
        >
          홈으로 돌아가기
        </Link>

        {/* 추가 정보 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            투표 시간: {new Date().toLocaleString('ko-KR')}
          </p>
        </div>
      </div>
    </div>
  );
}
