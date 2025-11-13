'use client';

import Link from 'next/link';
import SystemLogo from '@/components/SystemLogo';
import { useSystemConfig } from '@/lib/hooks/useSystemConfig';

export default function Home() {
  const { systemName } = useSystemConfig();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, #fafafa 100%)' }}>
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-30" style={{ 
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />
      
      <div className="relative z-10 text-center space-y-8 px-4 max-w-4xl mx-auto">
        {/* Logo - 중앙에 크게 */}
        <div className="flex justify-center mb-12">
          <SystemLogo size="xl" />
        </div>

        {/* Main heading with Apple-style typography */}
        <div className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-semibold tracking-tight" style={{ 
            color: '#1d1d1f',
            letterSpacing: '-0.04em',
            lineHeight: '1.05'
          }}>
            {systemName}
          </h1>
          <p className="text-2xl md:text-3xl font-normal text-gray-600" style={{ letterSpacing: '-0.01em' }}>
            투명하고 안전한 온라인 투표 시스템
          </p>
        </div>

        {/* Feature highlights */}
        <div className="flex flex-wrap justify-center gap-6 py-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>실시간 집계</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>보안 인증</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>간편한 참여</span>
          </div>
        </div>
        
        {/* CTA Buttons with Apple style */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Link
            href="/vote"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white rounded-2xl transition-all duration-200 hover:scale-105"
            style={{ 
              background: 'var(--color-secondary)',
              boxShadow: '0 4px 16px rgba(0, 113, 227, 0.25)',
              letterSpacing: '-0.01em'
            }}
          >
            투표 참여하기
            <svg className="w-[18px] h-[18px] transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          
          <Link
            href="/admin"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold rounded-2xl transition-all duration-200 hover:scale-105"
            style={{ 
              background: 'rgba(0, 0, 0, 0.06)',
              color: '#1d1d1f',
              letterSpacing: '-0.01em'
            }}
          >
            관리자 로그인
            <svg className="w-[18px] h-[18px] transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Tech stack - minimalist */}
        <div className="pt-12 flex items-center justify-center gap-8 text-xs text-gray-400 font-medium">
        </div>
      </div>
    </div>
  );
}
