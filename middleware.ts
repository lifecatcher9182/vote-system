import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// 세션 갱신은 관리자 화면에만 필요하다.
// 투표자 화면(/, /vote)은 로그인이 없으므로 요청마다 Supabase Auth 를 호출하지 않는다.
export const config = {
  matcher: ['/admin/:path*'],
}
