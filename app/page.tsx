import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(to bottom right, var(--color-primary), #f3f4f6)' }}>
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-gray-900">
          청년국 전자투표 시스템
        </h1>
        <p className="text-xl text-gray-600">
          총대 및 임원 선출 온라인 투표 플랫폼
        </p>
        
        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/vote"
            className="px-8 py-4 bg-[var(--color-secondary)] text-white rounded-lg font-semibold hover:opacity-90 transition-colors shadow-lg"
          >
            투표 참여하기
          </Link>
          <Link
            href="/admin"
            className="px-8 py-4 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-900 transition-colors shadow-lg"
          >
            관리자 로그인
          </Link>
        </div>

        <div className="mt-12 text-sm text-gray-500 space-y-1">
          <p>✅ Next.js 14 + TypeScript</p>
          <p>✅ Supabase + PostgreSQL</p>
          <p>✅ Tailwind CSS</p>
        </div>
      </div>
    </div>
  );
}
