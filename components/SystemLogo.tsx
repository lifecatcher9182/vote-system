'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSystemConfig } from '@/lib/hooks/useSystemConfig';

interface SystemLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  linkToHome?: boolean;
}

const sizeMap = {
  sm: { width: 32, height: 32 },
  md: { width: 48, height: 48 },
  lg: { width: 80, height: 80 },
  xl: { width: 120, height: 120 },
};

export default function SystemLogo({ 
  className = '', 
  size = 'md',
  linkToHome = false
}: SystemLogoProps) {
  const { systemName, logoUrl } = useSystemConfig();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 마운트 전이거나 로고가 없으면 null 반환
  if (!mounted || !logoUrl) {
    return null;
  }

  const logoElement = (
    <div 
      className={`relative ${className}`} 
      style={{ 
        width: `${sizeMap[size].width}px`, 
        height: `${sizeMap[size].height}px` 
      }}
    >
      <Image
        src={logoUrl}
        alt={systemName}
        fill
        sizes={`${sizeMap[size].width}px`}
        className="object-contain"
        priority
      />
    </div>
  );

  if (linkToHome) {
    return (
      <Link href="/" className="transition-opacity hover:opacity-80">
        {logoElement}
      </Link>
    );
  }

  return logoElement;
}
