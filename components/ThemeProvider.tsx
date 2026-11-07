'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// 관리자가 설정한 색을 --color-primary / --color-secondary 에 주입한다.
// globals.css 의 --accent 가 --color-secondary 를 읽으므로 그 외 토큰은 건드리지 않는다.
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('system_config')
      .select('primary_color, secondary_color')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const root = document.documentElement.style;
        if (data.primary_color) root.setProperty('--color-primary', data.primary_color);
        if (data.secondary_color) root.setProperty('--color-secondary', data.secondary_color);
      });
  }, []);

  return <>{children}</>;
}
