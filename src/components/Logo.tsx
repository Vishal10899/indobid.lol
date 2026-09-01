'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  className?: string;
  href?: string;
  showDomain?: boolean;
}

/**
 * IndoBid Distinctive Brand Identity
 * Designed using Bodoni (editorial luxury serif), Bebas Neue (bold vertical authority),
 * and Montserrat (geometric modern sans).
 */
export function Logo({
  size = 'md',
  iconOnly = false,
  className = '',
  href = '/',
  showDomain = true,
}: LogoProps) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7 sm:w-8 sm:h-8',
    lg: 'w-9 h-9 sm:w-10 sm:h-10',
  };

  const textSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
  };

  const domainSizes = {
    sm: 'text-[8px]',
    md: 'text-[9px] sm:text-[10px]',
    lg: 'text-[11px]',
  };

  const mark = (
    <div
      className={`${iconSizes[size]} relative rounded-xl bg-gradient-to-br from-[var(--color-coral)] via-[var(--color-coral-bright)] to-[var(--color-amber)] p-[1.5px] shadow-sm flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}
      aria-hidden="true"
    >
      <div className="w-full h-full bg-[var(--bg-page)] rounded-[10px] flex items-center justify-center relative overflow-hidden">
        {/* Geometric Serif "I" + Rising Conviction Chevron Monogram */}
        <svg
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4/5 h-4/5 text-[var(--color-coral)]"
        >
          {/* Serif Top Bar (Bodoni inspiration) */}
          <rect x="5" y="4.5" width="10" height="2.5" rx="0.5" fill="currentColor" />
          {/* Serif Vertical Stem */}
          <rect x="8.5" y="7" width="3" height="13" rx="0.5" fill="currentColor" fillOpacity="0.9" />
          {/* Serif Bottom Bar */}
          <rect x="5" y="20" width="10" height="2.5" rx="0.5" fill="currentColor" />

          {/* Upward Conviction Arrow / "B" Dynamic Counter */}
          <path
            d="M15 17.5L21.5 11L18 11V6H25V13H22L15 20V17.5Z"
            fill="currentColor"
          />
          {/* Backing Node (₹ gold coin node) */}
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
          {/* INDO: Bodoni luxury editorial serif */}
          <span className="font-bodoni font-black tracking-tight text-[var(--text-primary)]">
            INDO
          </span>
          {/* BID: Bebas Neue high-impact punch */}
          <span className="font-bebas tracking-wide text-[var(--color-coral)] ml-1 text-[1.18em] leading-none">
            BID
          </span>
          {/* .LOL: Montserrat modern geometric balance */}
          {showDomain && (
            <span
              className={`font-montserrat font-extrabold ${domainSizes[size]} tracking-widest text-[var(--color-amber)] uppercase ml-1 opacity-90`}
            >
              .lol
            </span>
          )}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-coral)] rounded-xl"
        aria-label="IndoBid.lol Home"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default Logo;
