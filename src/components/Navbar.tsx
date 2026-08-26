'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Trophy, Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  onOpenBidModal?: (initialData?: { url?: string; targetBidDollars?: number; categoryId?: string }) => void;
  minToTakeFirstDollars?: number;
}

export function Navbar({ onOpenBidModal, minToTakeFirstDollars }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-color)] bg-[var(--bg-card)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-2xs">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-base tracking-tight text-[var(--text-primary)]">
              indobid<span className="text-amber-500">.lol</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
              Live
            </span>
          </div>
        </Link>

        {/* Desktop Navigation (No Admin Link in Public Navbar) */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-[var(--text-secondary)]">
          <Link href="/#leaderboard" className="hover:text-[var(--text-primary)] transition">
            Leaderboard
          </Link>
          <Link href="/#activity" className="hover:text-[var(--text-primary)] transition">
            Activity
          </Link>
          <Link href="/#how-it-works" className="hover:text-[var(--text-primary)] transition">
            Rules
          </Link>
        </nav>

        {/* Right Actions: ThemeToggle + Desktop Submit & Rank + Mobile Menu Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <ThemeToggle className="w-9 h-9" />

          {onOpenBidModal && (
            <button
              onClick={() => onOpenBidModal({ targetBidDollars: minToTakeFirstDollars || 2 })}
              className="hidden md:inline-flex px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm shadow-2xs transition items-center space-x-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Submit & Rank</span>
            </button>
          )}

          {/* Mobile Menu Button with comfortable 36px touch target */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3.5 space-y-2.5 shadow-lg">
          {onOpenBidModal && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBidModal({ targetBidDollars: minToTakeFirstDollars || 2 });
              }}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm shadow-2xs transition flex items-center justify-center space-x-2 cursor-pointer mb-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit & Rank</span>
            </button>
          )}
          <nav className="space-y-1">
            <Link
              href="/#leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-2 rounded-lg transition"
            >
              Leaderboard
            </Link>
            <Link
              href="/#activity"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-2 rounded-lg transition"
            >
              Activity
            </Link>
            <Link
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-2 rounded-lg transition"
            >
              Rules
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
