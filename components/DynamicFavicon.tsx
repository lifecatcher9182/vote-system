'use client';

import { useEffect } from 'react';
import { getSystemConfig } from '@/lib/systemConfig';

export default function DynamicFavicon() {
  useEffect(() => {
    getSystemConfig().then((c) => {
      if (!c?.favicon_url) return;
      document.querySelectorAll('link[data-dynamic-favicon="true"]').forEach((l) => l.remove());
      for (const rel of ['icon', 'shortcut icon', 'apple-touch-icon']) {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = c.favicon_url;
        link.setAttribute('data-dynamic-favicon', 'true');
        document.head.appendChild(link);
      }
    });
  }, []);
  return null;
}
