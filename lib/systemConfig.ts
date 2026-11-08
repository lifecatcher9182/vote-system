import { createClient } from '@/lib/supabase/client';

// system_config 한 줄을 모든 화면이 공유한다.
// 메모리(탭 수명) + localStorage(5분) 캐시. 이름·로고·색·파비콘이 전부 여기서 나오므로
// 방문자 1명당 Supabase 요청은 최대 1번이다.
export interface SystemConfig {
  system_name: string | null;
  system_description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

const KEY = 'system_config_cache_v2';
const TTL = 5 * 60 * 1000;
let inflight: Promise<SystemConfig | null> | null = null;
let memo: SystemConfig | null | undefined;

function fromStorage(): SystemConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return Date.now() - ts < TTL ? data : null;
  } catch { return null; }
}

async function fetchConfig(): Promise<SystemConfig | null> {
  const { data } = await createClient().from('system_config')
    .select('system_name, system_description, logo_url, favicon_url, primary_color, secondary_color')
    .limit(1).single();
  memo = (data as SystemConfig | null) ?? null;
  if (memo) { try { localStorage.setItem(KEY, JSON.stringify({ data: memo, ts: Date.now() })); } catch {} }
  return memo;
}

export function getSystemConfig(): Promise<SystemConfig | null> {
  if (memo !== undefined) return Promise.resolve(memo);
  const cached = fromStorage();
  if (cached) { memo = cached; return Promise.resolve(cached); }
  inflight ??= fetchConfig();
  return inflight;
}

// 설정 화면에서 저장한 뒤 호출하면 다음 화면부터 새 값이 보인다.
export function invalidateSystemConfig() {
  memo = undefined; inflight = null;
  try { localStorage.removeItem(KEY); } catch {}
}
