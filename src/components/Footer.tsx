import React from 'react';
import Link from 'next/link';
import { Trophy, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-section)] pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-xs text-[var(--text-secondary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 shadow-2xs">
              <Trophy className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-[var(--text-primary)] text-sm">
                indobid<span className="text-amber-500">.lol</span>
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">Pay More · Rank Higher</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-medium text-[var(--text-secondary)]">
            <Link href="/#leaderboard" className="hover:text-[var(--text-primary)] transition">Leaderboard</Link>
            <Link href="/#activity" className="hover:text-[var(--text-primary)] transition">Activity</Link>
            <Link href="/#how-it-works" className="hover:text-[var(--text-primary)] transition">Rules</Link>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>&copy; {new Date().getFullYear()} indobid.lol</span>
            <span>·</span>
            <span className="text-[var(--text-secondary)] font-normal">Built by Vishal Kumar</span>
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure checkout</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
