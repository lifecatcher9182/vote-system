import { createClient } from '@/lib/supabase/client';

// 참여코드: 알파벳 2자 + 숫자 4자 (예: AB1234)
export function generateVoterCode(): string {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', N = '0123456789';
  let s = '';
  for (let i = 0; i < 2; i++) s += L[Math.floor(Math.random() * 26)];
  for (let i = 0; i < 4; i++) s += N[Math.floor(Math.random() * 10)];
  return s;
}

export async function generateUniqueVoterCode(): Promise<string> {
  const supabase = createClient();
  for (let i = 0; i < 10; i++) {
    const code = generateVoterCode();
    const { data, error } = await supabase.from('voter_codes').select('code').eq('code', code).maybeSingle();
    if (!data && !error) return code;
  }
  return generateVoterCode() + Date.now().toString().slice(-2);
}

export interface NewCode {
  code_type: 'delegate' | 'officer';
  accessible_elections: string[];
  village_id?: string | null;
  group_id?: string | null;
}

// n개 생성해 insert. UNIQUE 충돌(23505)은 3회까지 재시도. 실패 시 메시지 반환, 성공 시 null.
export async function insertCodes(n: number, base: NewCode): Promise<string | null> {
  const supabase = createClient();
  for (let retry = 0; retry < 3; retry++) {
    const rows = [];
    for (let i = 0; i < n; i++) rows.push({ ...base, code: await generateUniqueVoterCode(), is_used: false });
    const { error } = await supabase.from('voter_codes').insert(rows);
    if (!error) return null;
    if (error.code !== '23505') { console.error(error); return '코드 생성에 실패했습니다.'; }
  }
  return '코드 중복이 계속 발생합니다. 잠시 후 다시 시도해 주세요.';
}
