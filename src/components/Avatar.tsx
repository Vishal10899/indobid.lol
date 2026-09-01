'use client';

import React, { useState } from 'react';
import { User, HelpCircle } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isAnonymous?: boolean;
  className?: string;
  badge?: React.ReactNode;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 sm:w-24 sm:h-24 text-2xl',
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  lg: 'w-7 h-7',
  md: 'w-5 h-5',
  xl: 'w-10 h-10',
};

export function Avatar({
  src,
  name,
  username,
  size = 'md',
  isAnonymous = false,
  className = '',
  badge,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initial = (name || username || 'U').substring(0, 1).toUpperCase();
  const dimensionClass = sizeClasses[size] || sizeClasses.md;
  const iconDim = iconSizes[size] || iconSizes.md;

  if (isAnonymous) {
    return (
      <div className={`relative inline-block shrink-0 ${className}`}>
        <div
          className={`${dimensionClass} rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] select-none shadow-sm`}
          title="Anonymous Contributor"
        >
          <HelpCircle className={iconDim} />
        </div>
        {badge && <div className="absolute -bottom-1 -right-1">{badge}</div>}
      </div>
    );
  }

  const hasValidImage = src && !imageError && src.trim().length > 0;

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div
        className={`${dimensionClass} rounded-2xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center font-black select-none shadow-sm`}
      >
        {hasValidImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt={name || username || 'User avatar'}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-elevated)] text-[var(--color-coral)] flex items-center justify-center">
            {initial || <User className={iconDim} />}
          </div>
        )}
      </div>
      {badge && <div className="absolute -bottom-1 -right-1">{badge}</div>}
    </div>
  );
}

export default Avatar;
