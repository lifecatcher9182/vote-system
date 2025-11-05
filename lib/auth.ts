import { createClient } from '@/lib/supabase/client'

export async function signInWithGoogle() {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/admin/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('로그인 오류:', error)
    alert('로그인에 실패했습니다.')
  }

  return { data, error }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('로그아웃 오류:', error)
  }
  
  return { error }
}

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  return { user, error }
}

export async function checkAdminAccess(email: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('admin_emails')
    .select('email')
    .eq('email', email)
    .single()
  
  return { isAdmin: !!data, error }
}
