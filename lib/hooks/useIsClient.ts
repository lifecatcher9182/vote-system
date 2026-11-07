import { useSyncExternalStore } from 'react';

// 서버·첫 하이드레이션에서는 false, 그 뒤 클라이언트에서는 true.
export function useIsClient(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}
