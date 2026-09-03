'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error message internally
    console.error('Runtime error caught by boundary:', error?.message || error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Something went wrong
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            We encountered an unexpected issue while loading this page. Your data and convictions are safe.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold transition flex items-center justify-center space-x-2"
          >
            <Home className="w-3.5 h-3.5 text-[var(--color-coral)]" />
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
