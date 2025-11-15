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
        
        // RGB 값 추출 (shadow에 사용)
        const hexToRgb = (hex: string) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 113, 227';
        };
        
        document.documentElement.style.setProperty('--color-secondary-rgb', hexToRgb(secondary));
      }
    };

    loadTheme();
  }, []);

  return <>{children}</>;
}
