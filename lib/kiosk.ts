// 임원 투표용 태블릿(키오스크) 모드.
// /vote?kiosk=1 로 한 번 진입하면 이 브라우저 탭에서 유지된다.
// 홈 링크를 숨기고, 완료 후 자동으로 코드 입력 화면으로 돌아간다.
import { useSyncExternalStore } from 'react';

const KEY = 'kiosk';
const listeners = new Set<() => void>();

export function enableKiosk() {
  try { sessionStorage.setItem(KEY, '1'); } catch {}
  listeners.forEach((l) => l());
}

export function isKiosk(): boolean {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

// 서버에서는 false, 클라이언트에서는 실제 값. 하이드레이션 불일치 없음.
export function useKiosk(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    isKiosk,
    () => false,
  );
}

// 뒤로가기를 눌러도 현재 화면에 머물게 한다 (제출 후 투표용지로 되돌아가는 것 방지).
export function trapBack(): () => void {
  if (typeof window === 'undefined') return () => {};
  const push = () => history.pushState(null, '', location.href);
  push();
  window.addEventListener('popstate', push);
  return () => window.removeEventListener('popstate', push);
}
