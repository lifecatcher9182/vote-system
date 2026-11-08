'use client';

import { useEffect } from 'react';
import { getSystemConfig } from '@/lib/systemConfig';

// 관리자가 설정한 강조색을 --color-secondary 에 주입한다. globals.css 의 --accent 가 이 값을 읽는다.
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    getSystemConfig().then((c) => {
      if (!c) return;
      const root = document.documentElement.style;
      if (c.primary_color) root.setProperty('--color-primary', c.primary_color);
      if (c.secondary_color) root.setProperty('--color-secondary', c.secondary_color);
    });
  }, []);
  return <>{children}</>;
}
