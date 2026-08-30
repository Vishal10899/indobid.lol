'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

function CancelledContent() {
  const searchParams = useSearchParams();
  const errorMsg = searchParams.get('error');
  const isFailed = !!errorMsg;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
              isFailed
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)]'
            }`}
          >
            {isFailed ? <AlertCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
              {isFailed ? 'Payment Failed' : 'Payment Cancelled'}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {isFailed
                ? errorMsg || 'The payment could not be processed. Your bid has not been changed.'
                : 'You cancelled the checkout. Your building rank has not been changed.'}
            </p>
          </div>

          <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] text-xs text-[var(--text-secondary)] text-left">
            <div className="font-bold text-[var(--text-primary)] mb-0.5">No Changes Made</div>
            Your verified bid remains unchanged and no payment was captured. You can try again whenever you are ready.
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <Link
              href="/"
              className="w-full py-3 px-4 bg-[var(--color-salmon)] hover:bg-[var(--color-salmon-hover)] text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </Link>

            <Link
              href="/"
              className="w-full py-3 px-4 bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] font-semibold rounded-xl text-xs border border-[var(--border-color)] transition flex items-center justify-center space-x-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>City Leaderboard</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CancelledPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-xs text-[var(--text-muted)]">
          Loading...
        </div>
      }
    >
      <CancelledContent />
    </Suspense>
  );
}
