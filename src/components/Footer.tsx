'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function Footer() {
  return (
    <footer className="w-full bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] py-10 px-4 sm:px-6 text-xs text-[var(--text-muted)] min-w-0">
      <div className="max-w-6xl mx-auto space-y-6 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <Logo size="md" />
            <p className="text-xs text-[var(--text-secondary)]">
              Read opinions for free. Back conversations with real economic conviction.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--text-secondary)]">
            <Link href="/" className="hover:text-[var(--text-primary)] transition">
              Home
            </Link>
            <Link href="/explore" className="hover:text-[var(--text-primary)] transition">
              Explore
            </Link>
            <Link href="/trending" className="hover:text-[var(--text-primary)] transition">
              Trending
            </Link>
            <Link href="/activity" className="hover:text-[var(--text-primary)] transition">
              Live Activity
            </Link>
            <Link href="/admin" className="hover:text-[var(--text-primary)] transition">
              Admin
            </Link>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--text-muted)] min-w-0">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-center sm:text-left">
            <span>© {new Date().getFullYear()} IndoBid.lol</span>
            <span className="hidden sm:inline">·</span>
            <span className="font-montserrat font-medium text-[var(--text-secondary)]">
              Built & Designed by <span className="font-bold text-[var(--color-coral)]">Vishal Chaudhary</span>
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-[var(--text-secondary)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-coral)]" />
            <span>Server-Authoritative Payment Verification</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
