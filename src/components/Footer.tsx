'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Sparkles, ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function Footer() {
  return (
    <footer className="w-full bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] pt-12 pb-8 px-4 sm:px-6 lg:px-8 text-xs text-[var(--text-muted)] min-w-0 select-none">
      <div className="max-w-6xl mx-auto space-y-10 min-w-0">
        {/* Main 4-Column Corporate Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 min-w-0">
          {/* Column 1: Brand & Positioning */}
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <Logo size="md" />
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs">
              Opinions worth backing. A premium social network where human perspectives compete through financial conviction.
            </p>
            <div className="inline-flex items-center space-x-1.5 text-[11px] text-[var(--color-coral)] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Read Free · Post Free · Back Conviction</span>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Product
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/explore" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] transition">
                  Explore
                </Link>
              </li>
              <li>
                <Link href="/trending" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] transition">
                  Trending
                </Link>
              </li>
              <li>
                <Link href="/activity" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] transition">
                  Activity
                </Link>
              </li>
              <li>
                <Link href="/explore?sort=top" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] transition">
                  Highest Value
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Economics */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Economics
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="text-[var(--text-secondary)]">
                Free Publishing (₹0)
              </li>
              <li className="text-[var(--text-secondary)]">
                Optional Backing (From ₹10)
              </li>
              <li className="text-[var(--text-secondary)]">
                50/50 Creator Revenue
              </li>
              <li className="text-[var(--text-secondary)]">
                Fair Multi-Signal Ranking
              </li>
            </ul>
          </div>

          {/* Column 4: Trust, Safety & Legal */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Guidelines & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center space-x-1.5 text-[var(--text-secondary)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-lime)] shrink-0" />
                <span>Verified Integrity</span>
              </li>
              <li className="text-[var(--text-secondary)]">
                Community Guidelines
              </li>
              <li className="text-[var(--text-secondary)]">
                Privacy & Data Security
              </li>
              <li className="text-[var(--text-secondary)]">
                Terms of Service
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[var(--text-muted)] min-w-0">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-center sm:text-left">
            <span>© 2026 IndoBid. All rights reserved.</span>
            <span className="hidden sm:inline">·</span>
            <span className="font-medium text-[var(--text-secondary)]">
              Founded & Engineered by <span className="font-bold text-[var(--color-coral)]">Vishal Chaudhary</span>
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px]">All Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
