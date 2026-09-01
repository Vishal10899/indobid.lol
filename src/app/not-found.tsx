'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-[var(--color-coral)]/10 text-[var(--color-coral)] border border-[var(--color-coral)]/20 uppercase tracking-wider">
            404 Error
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">
            Opinion Not Found
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            The conversation, user profile, or page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Feed</span>
          </Link>

          <Link
            href="/explore"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold transition flex items-center justify-center space-x-2"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--color-coral)]" />
            <span>Explore Debates</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
