'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const loadTheme = async () => {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('system_config')
        .select('primary_color, secondary_color')
        .limit(1)
        .single();

      if (error) {
        console.error('테마 로딩 오류:', error);
        // 기본값 적용
        document.documentElement.style.setProperty('--color-primary', '#2563eb');
        document.documentElement.style.setProperty('--color-secondary', '#10b981');
        return;
      }

      if (data) {
        const primary = data.primary_color || '#2563eb';
        const secondary = data.secondary_color || '#10b981';
        
        document.documentElement.style.setProperty('--color-primary', primary);
        document.documentElement.style.setProperty('--color-secondary', secondary);
      }
    };

    loadTheme();
  }, []);

  return <>{children}</>;
}
