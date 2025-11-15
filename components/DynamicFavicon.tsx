'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DynamicFavicon() {
  useEffect(() => {
    let mounted = true;

    const loadAndApplyFavicon = async () => {
      if (typeof document === 'undefined') return;

      try {
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('system_config')
          .select('favicon_url')
          .limit(1)
          .single();

        // 컴포넌트가 언마운트되었으면 중단
        if (!mounted) return;

        // 에러가 있거나 데이터가 없으면 조용히 무시 (기본 favicon 사용)
        if (error || !data?.favicon_url) return;

        const faviconUrl = data.favicon_url;
        
        // 캐시 방지를 위한 타임스탬프 추가
        const timestamp = Date.now();
        const faviconUrlWithCache = `${faviconUrl}?v=${timestamp}`;

        // 기존의 동적으로 추가된 favicon만 제거 (data-dynamic 속성 체크)
        const existingDynamicIcons = document.querySelectorAll('link[data-dynamic-favicon="true"]');
        existingDynamicIcons.forEach(link => {
          try {
            link.remove();
          } catch {
            // 무시
          }
        });

        // 새 favicon 추가
        const createFaviconLink = (rel: string, type?: string) => {
          const link = document.createElement('link');
          link.rel = rel;
          if (type) link.type = type;
          link.href = faviconUrlWithCache;
          link.setAttribute('data-dynamic-favicon', 'true');
          document.head.appendChild(link);
        };

        createFaviconLink('icon', 'image/x-icon');
        createFaviconLink('shortcut icon', 'image/x-icon');
        createFaviconLink('apple-touch-icon');

        console.log('✅ Favicon 적용됨:', faviconUrl);
      } catch (error) {
        console.error('Favicon 로드 중 오류:', error);
      }
    };

    loadAndApplyFavicon();

    return () => {
      mounted = false;
    };
  }, []); // 한 번만 실행

  return null;
}
