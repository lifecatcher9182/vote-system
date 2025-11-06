'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SystemConfig {
  systemName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig>({
    systemName: '청년위원회 투표 시스템',
    logoUrl: null,
    primaryColor: '#f5f5f7',
    secondaryColor: '#0071e3',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      const supabase = createClient();
      
      const { data } = await supabase
        .from('system_config')
        .select('system_name, logo_url, primary_color, secondary_color')
        .limit(1)
        .single();

      if (data) {
        setConfig({
          systemName: data.system_name || '청년위원회 투표 시스템',
          logoUrl: data.logo_url,
          primaryColor: data.primary_color || '#f5f5f7',
          secondaryColor: data.secondary_color || '#0071e3',
        });
      }
      
      setLoading(false);
    };

    loadConfig();
  }, []);

  return { ...config, loading };
}
