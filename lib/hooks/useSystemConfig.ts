'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SystemConfig {
  systemName: string;
  systemDescription: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

const STORAGE_KEY = 'system_config_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5분

export function useSystemConfig() {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<SystemConfig>({
    systemName: '청년위원회 투표 시스템',
    systemDescription: '투명하고 안전한 온라인 투표 시스템',
    logoUrl: null,
    primaryColor: '#f5f5f7',
    secondaryColor: '#0071e3',
  });

  useEffect(() => {
    setMounted(true);
    
    // 캐시 확인
    const getCachedConfig = () => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
          }
        }
      } catch (e) {
        console.error('Error reading cache:', e);
      }
      return null;
    };

    const cached = getCachedConfig();
    if (cached) {
      setConfig(cached);
    }

    // 데이터 로드
    const loadConfig = async () => {
      const supabase = createClient();
      
      const { data } = await supabase
        .from('system_config')
        .select('system_name, system_description, logo_url, primary_color, secondary_color')
        .limit(1)
        .single();

      if (data) {
        const newConfig = {
          systemName: data.system_name || '청년위원회 투표 시스템',
          systemDescription: data.system_description || '투명하고 안전한 온라인 투표 시스템',
          logoUrl: data.logo_url,
          primaryColor: data.primary_color || '#f5f5f7',
          secondaryColor: data.secondary_color || '#0071e3',
        };
        
        setConfig(newConfig);
        
        // 캐시에 저장
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            data: newConfig,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error('Error saving cache:', e);
        }
      }
    };

    loadConfig();
  }, []);

  return { ...config, loading: !mounted };
}
