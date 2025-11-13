'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VoteCompleteContent() {
  const searchParams = useSearchParams();
  const electionTitle = searchParams.get('election') || '';

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      <div className="max-w-lg w-full">
        {/* Success Card */}
        <div className="card-apple p-6 sm:p-8 lg:p-10 text-center">
          {/* Success Icon - Animated */}
          <div className="mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full mb-5 sm:mb-6" style={{ 
              background: 'linear-gradient(135deg, var(--color-secondary), #0051a8)',
              boxShadow: '0 8px 24px rgba(0, 113, 227, 0.3)'
            }}>
              <svg className="w-12 h-12 sm:w-14 sm:h-14 text-white animate-[checkmark_0.6s_ease-in-out]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold mb-2 sm:mb-3" style={{ 
              color: '#1d1d1f',
              letterSpacing: '-0.03em',
              lineHeight: '1.1'
            }}>
              투표 완료
            </h1>
            <p className="text-base sm:text-lg text-gray-600" style={{ letterSpacing: '-0.01em' }}>
              투표가 성공적으로 제출되었습니다
            </p>
          </div>

          {/* Election Info */}
          {electionTitle && (
            <div className="mb-6 sm:mb-8 p-4 sm:p-5 rounded-2xl text-left" style={{ background: 'rgba(0, 113, 227, 0.05)' }}>
              <p className="text-sm text-gray-600 mb-2" style={{ letterSpacing: '-0.01em' }}>투표한 선거</p>
              <p className="text-base sm:text-lg font-semibold" style={{ 
                color: '#1d1d1f',
                letterSpacing: '-0.02em'
              }}>
                {electionTitle}
              </p>
            </div>
          )}

          {/* Info Items */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-left">
            <div className="flex items-start gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
              <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  투표 결과는 투표 종료 후 확인하실 수 있습니다
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
              <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  소중한 한 표, 감사합니다
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
              <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm" style={{ color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                  이 참여코드는 이미 사용되었습니다
                </p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Link
            href="/"
            className="btn-apple-primary w-full text-base sm:text-lg inline-flex items-center justify-center gap-2 py-3.5 sm:py-4 active:scale-95"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            홈으로 돌아가기
          </Link>

          {/* Timestamp */}
          <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500" style={{ letterSpacing: '-0.01em' }}>
              투표 시간: {new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Animation Keyframes */}
      <style jsx>{`
        @keyframes checkmark {
          0% {
            transform: scale(0) rotate(-45deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default function VoteCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ 
        background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' 
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium" style={{ letterSpacing: '-0.01em' }}>
            로딩 중...
          </p>
        </div>
      </div>
    }>
      <VoteCompleteContent />
    </Suspense>
  );
}
