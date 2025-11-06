'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface SetupStatus {
  databaseConnected: boolean;
  tablesExist: boolean;
  adminEmailsCount: number;
  googleAuthEnabled: boolean;
  errors: string[];
}

export default function SetupCheckPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SetupStatus>({
    databaseConnected: false,
    tablesExist: false,
    adminEmailsCount: 0,
    googleAuthEnabled: false,
    errors: [],
  });

  const checkSetup = async () => {
    const supabase = createClient();
    const errors: string[] = [];
    let tablesExist = false;
    let adminEmailsCount = 0;

    // 1. 데이터베이스 연결 확인
    const databaseConnected = !!supabase;

    // 2. 테이블 존재 확인
    try {
      const { data, error } = await supabase
        .from('admin_emails')
        .select('*', { count: 'exact', head: true });

      if (!error) {
        tablesExist = true;
        adminEmailsCount = data as unknown as number || 0;
      } else {
        errors.push('테이블이 생성되지 않았습니다. supabase-schema.sql을 실행하세요.');
      }
    } catch (e) {
      errors.push('데이터베이스 연결 오류: ' + (e as Error).message);
    }

    // 3. Google Auth 활성화 여부는 직접 확인 필요
    const googleAuthEnabled = false; // Supabase Dashboard에서 수동 확인 필요

    setStatus({
      databaseConnected,
      tablesExist,
      adminEmailsCount,
      googleAuthEnabled,
      errors,
    });
    setLoading(false);
  };

  // 페이지 로드 시 자동 체크
  if (loading && status.errors.length === 0 && !status.databaseConnected) {
    checkSetup();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-secondary)] mx-auto"></div>
          <p className="mt-4 text-gray-600">설정 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 Google 로그인 설정 상태
          </h1>

          <div className="space-y-6">
            {/* 1. 데이터베이스 연결 */}
            <div className="border-l-4 border-[var(--color-primary)] bg-gray-50 p-4">
              <div className="flex items-center">
                <span className="text-2xl mr-3">✅</span>
                <div>
                  <h3 className="font-semibold text-green-900">Supabase 연결 완료</h3>
                  <p className="text-sm text-[var(--color-primary)]">
                    URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. 테이블 생성 */}
            {status.tablesExist ? (
              <div className="border-l-4 border-[var(--color-primary)] bg-gray-50 p-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <h3 className="font-semibold text-green-900">데이터베이스 테이블 생성 완료</h3>
                    <p className="text-sm text-[var(--color-primary)]">
                      등록된 관리자 이메일: {status.adminEmailsCount}개
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-l-4 border-red-500 bg-red-50 p-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">❌</span>
                  <div>
                    <h3 className="font-semibold text-red-900">데이터베이스 테이블 미생성</h3>
                    <p className="text-sm text-red-700 mb-3">
                      Supabase SQL Editor에서 테이블을 생성해야 합니다.
                    </p>
                    <div className="bg-white rounded p-3 text-sm">
                      <p className="font-mono text-xs mb-2">📍 단계:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        <li>
                          <a 
                            href={`https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].replace('https://', '')}/sql`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-secondary)] hover:underline"
                          >
                            Supabase SQL Editor 열기
                          </a>
                        </li>
                        <li><code>supabase-schema.sql</code> 파일 내용 복사</li>
                        <li>SQL Editor에 붙여넣고 실행</li>
                        <li>이 페이지 새로고침</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 관리자 이메일 등록 */}
            {status.adminEmailsCount > 0 ? (
              <div className="border-l-4 border-[var(--color-primary)] bg-gray-50 p-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <h3 className="font-semibold text-green-900">관리자 이메일 등록 완료</h3>
                    <p className="text-sm text-[var(--color-primary)]">
                      {status.adminEmailsCount}개의 관리자 계정이 등록되어 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            ) : status.tablesExist ? (
              <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div>
                    <h3 className="font-semibold text-yellow-900">관리자 이메일 미등록</h3>
                    <p className="text-sm text-yellow-700 mb-3">
                      로그인할 Google 이메일을 등록해야 합니다.
                    </p>
                    <div className="bg-white rounded p-3 text-sm">
                      <p className="font-mono text-xs mb-2">SQL Editor에서 실행:</p>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
{`INSERT INTO admin_emails (email) 
VALUES ('your-email@gmail.com');`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 4. Google OAuth 설정 */}
            <div className="border-l-4 border-[var(--color-secondary)] bg-gray-50 p-4">
              <div className="flex items-center">
                <span className="text-2xl mr-3">ℹ️</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-2">Google OAuth 설정 필요</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    다음 단계를 완료하세요:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>
                      <a 
                        href="https://console.cloud.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-secondary)] hover:underline font-semibold"
                      >
                        Google Cloud Console
                      </a>에서 프로젝트 생성
                    </li>
                    <li>OAuth 동의 화면 구성</li>
                    <li>OAuth 2.0 클라이언트 ID 생성</li>
                    <li>승인된 리디렉션 URI에 다음 추가:
                      <pre className="bg-white p-2 rounded text-xs mt-1 overflow-x-auto">
{`https://gmniknsurottqhdduyhu.supabase.co/auth/v1/callback`}
                      </pre>
                    </li>
                    <li>
                      <a 
                        href="https://supabase.com/dashboard/project/gmniknsurottqhdduyhu/auth/providers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-secondary)] hover:underline font-semibold"
                      >
                        Supabase Authentication Providers
                      </a>에서 Google 활성화
                    </li>
                    <li>Client ID와 Secret 입력</li>
                  </ol>
                  <div className="mt-3">
                    <a 
                      href="/GOOGLE_LOGIN_SETUP.md"
                      target="_blank"
                      className="inline-block px-4 py-2 bg-[var(--color-secondary)] text-white rounded hover:opacity-90 text-sm"
                    >
                      📖 자세한 설정 가이드 보기
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {status.errors.length > 0 && (
              <div className="border-l-4 border-red-500 bg-red-50 p-4">
                <h3 className="font-semibold text-red-900 mb-2">오류</h3>
                <ul className="list-disc list-inside space-y-1">
                  {status.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-700">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => {
                setLoading(true);
                checkSetup();
              }}
              className="px-6 py-3 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 transition-colors"
            >
              🔄 상태 다시 확인
            </button>
            
            {status.tablesExist && status.adminEmailsCount > 0 && (
              <Link
                href="/admin"
                className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-colors"
              >
                ✅ 관리자 로그인 테스트
              </Link>
            )}

            <Link
              href="/"
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              홈으로
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
