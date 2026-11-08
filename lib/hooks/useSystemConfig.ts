'use client';

import { useEffect, useState } from 'react';
import { useIsClient } from '@/lib/hooks/useIsClient';
import { getSystemConfig } from '@/lib/systemConfig';

const DEFAULTS = {
  systemName: '청년위원회 투표 시스템',
  systemDescription: '투명하고 안전한 온라인 투표 시스템',
  logoUrl: null as string | null,
  primaryColor: '#f5f5f7',
  secondaryColor: '#1d4ed8',
};

export function useSystemConfig() {
  const mounted = useIsClient();
  const [config, setConfig] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getSystemConfig().then((c) => {
      if (!alive) return;
      if (c) {
        setConfig({
          systemName: c.system_name || DEFAULTS.systemName,
          systemDescription: c.system_description || DEFAULTS.systemDescription,
          logoUrl: c.logo_url,
          primaryColor: c.primary_color || DEFAULTS.primaryColor,
          secondaryColor: c.secondary_color || DEFAULTS.secondaryColor,
        });
      }
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  return { ...config, loading: !mounted || !loaded };
}
