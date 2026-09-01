'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  className?: string;
  href?: string;
}

/**
 * IndoBid Refined Visual Brand Mark
 * Clean, compact, and authoritative. Combines editorial serif with modern sans punch.
 */
export function Logo({
  size = 'md',
  iconOnly = false,
  className = '',
  href = '/',
}: LogoProps) {
  const iconSizes = {
    sm: 'w-5 h-5 rounded-lg',
    md: 'w-6 h-6 rounded-lg',
    lg: 'w-7 h-7 rounded-xl',
  };

  const textSizes = {
    sm: 'text-xs sm:text-sm',
    md: 'text-sm sm:text-base',
    lg: 'text-base sm:text-lg',
  };

  const mark = (
    <div
      className={`${iconSizes[size]} relative bg-gradient-to-br from-[var(--color-coral)] via-[var(--color-coral-bright)] to-[var(--color-amber)] p-[1.25px] shadow-xs flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}
      aria-hidden="true"
    >
      <div className="w-full h-full bg-[var(--bg-page)] rounded-[inherit] flex items-center justify-center relative overflow-hidden">
        {/* Geometric Serif "I" + Upward Conviction Mark */}
        <svg
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4/5 h-4/5 text-[var(--color-coral)]"
        >
          {/* Serif Top Bar */}
          <rect x="5" y="4.5" width="10" height="2.5" rx="0.5" fill="currentColor" />
          {/* Serif Vertical Stem */}
          <rect x="8.5" y="7" width="3" height="13" rx="0.5" fill="currentColor" fillOpacity="0.9" />
          {/* Serif Bottom Bar */}
          <rect x="5" y="20" width="10" height="2.5" rx="0.5" fill="currentColor" />

          {/* Upward Conviction Arrow */}
          <path
            d="M15 17.5L21.5 11L18 11V6H25V13H22L15 20V17.5Z"
            fill="currentColor"
          />
          {/* Gold Conviction Node */}
          <circle cx="21" cy="20.5" r="2" fill="var(--color-amber)" />
        </svg>
      </div>
    </div>
  );

  const content = (
    <div className={`inline-flex items-center space-x-2 select-none group ${className}`}>
      {mark}
      {!iconOnly && (
        <span className={`${textSizes[size]} tracking-tight leading-none flex items-baseline`}>
          {/* INDO */}
          <span className="font-bodoni font-black tracking-tight text-[var(--text-primary)]">
            INDO
          </span>
          {/* BID */}
          <span className="font-bebas tracking-wider text-[var(--color-coral)] ml-1 text-[1.12em] leading-none">
            BID
          </span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-coral)] rounded-lg"
        aria-label="IndoBid Home"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default Logo;
