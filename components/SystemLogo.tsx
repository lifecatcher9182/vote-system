'use client';

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
  const { systemName, logoUrl, loading } = useSystemConfig();

  if (loading) {
    return (
      <div 
        className={`${className} animate-pulse bg-gray-200 rounded-lg`} 
        style={{ 
          width: `${sizeMap[size].width}px`, 
          height: `${sizeMap[size].height}px` 
        }}
      />
    );
  }

  if (!logoUrl) {
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
