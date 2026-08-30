'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, CheckCircle2, ArrowRight, ExternalLink, RefreshCw, ShieldCheck, Clock, AlertTriangle, ArrowLeft, Building2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PlatformIcon } from '@/components/PlatformIcon';

interface VerifiedData {
  verified: boolean;
  status?: string;
  listing?: {
    id: string;
    title: string;
    description: string;
    destinationUrl: string;
    canonicalUrl: string;
    destinationType: string;
    logoUrl: string | null;
    categoryName: string;
    categorySlug: string;
    verifiedBid: number;
  };
  globalRank?: number;
  categoryRank?: number;
  verifiedBidCents?: number;
  amountPaidCents?: number;
}

const MAX_POLL_ATTEMPTS = 12; // 12 cycles * 2.5s = 30 seconds max polling

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || '';
  const listingId = searchParams.get('listing_id') || '';
  const bidId = searchParams.get('bid_id') || '';
  const paymentId = searchParams.get('payment_id') || '';

  const [data, setData] = useState<VerifiedData | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  const resetPolling = () => {
    setIsTimedOut(false);
    setIsFailed(false);
    setPollCount(0);
  };

  useEffect(() => {
    if (data?.verified || isTimedOut || isFailed) return;

    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const query = new URLSearchParams();
        if (sessionId) query.set('session_id', sessionId);
        if (listingId) query.set('listing_id', listingId);
        if (bidId) query.set('bid_id', bidId);
        if (paymentId) query.set('payment_id', paymentId);

        const res = await fetch(`/api/checkout/status?${query.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.verified) {
            setData(json);
            clearInterval(interval);
            return;
          }
          if (json.status === 'failed' || json.status === 'canceled') {
            setIsFailed(true);
            clearInterval(interval);
            return;
          }
        }
      } catch (e) {
        console.error('Status check error:', e);
      } finally {
        setPollCount((prev) => {
          const next = prev + 1;
          if (next >= MAX_POLL_ATTEMPTS) {
            setIsTimedOut(true);
            clearInterval(interval);
          }
          return next;
        });
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2500);

    return () => clearInterval(interval);
  }, [sessionId, listingId, bidId, paymentId, isTimedOut, isFailed, data?.verified]);

  const isVerified = data?.verified;
  const dollars = data?.verifiedBidCents ? data.verifiedBidCents / 100 : 0;
  const isFirst = data?.globalRank === 1;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm text-center">
          {/* 1. TIMED OUT STATE */}
          {isTimedOut && !isVerified && (
            <div className="py-2 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-salmon-light)] text-[var(--color-salmon)] flex items-center justify-center mx-auto border border-[var(--color-salmon-border)]">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">Verification In Progress</h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                  Payment verification is taking longer than expected. If your payment was completed, your building will activate automatically in the city skyline once confirmed.
                </p>
              </div>

              <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] text-xs text-[var(--text-secondary)] text-left">
                <div className="font-semibold text-[var(--text-primary)] mb-0.5">Status Check</div>
                No verified charge confirmed yet. You can check again or return to the startup city.
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetPolling}
                  className="w-full py-3 px-4 bg-[var(--color-salmon)] hover:bg-[var(--color-salmon-hover)] text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check Again</span>
                </button>

                <Link
                  href="/"
                  className="w-full py-3 px-4 bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] font-semibold rounded-xl text-xs border border-[var(--border-color)] transition flex items-center justify-center space-x-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>City Skyline</span>
                </Link>
              </div>
            </div>
          )}

          {/* 2. FAILED STATE */}
          {isFailed && !isVerified && (
            <div className="py-2 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">Payment Incomplete</h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  The payment transaction was not completed. Your building rank has not been modified.
                </p>
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
                  <span>Leaderboard</span>
                </Link>
              </div>
            </div>
          )}

          {/* 3. ACTIVE PROCESSING STATE */}
          {!isVerified && !isTimedOut && !isFailed && (
            <div className="py-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-teal-light)] text-[var(--color-teal)] flex items-center justify-center mx-auto border border-[var(--color-teal-border)] animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Verifying Payment...</h1>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                Verifying transaction signature with cryptographic backend. Your building in the startup city will activate immediately upon confirmation.
              </p>
              <div className="text-[11px] text-[var(--text-muted)]">
                Checking status ({pollCount * 2}s / 30s max)...
              </div>
            </div>
          )}

          {/* 4. VERIFIED LIVE STATE */}
          {isVerified && (
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-teal-light)] text-[var(--color-teal)] flex items-center justify-center mx-auto border border-[var(--color-teal-border)]">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-[var(--color-teal-light)] text-[var(--color-teal)] text-xs font-bold mb-1.5 border border-[var(--color-teal-border)]">
                  <Building2 className="w-3 h-3" />
                  <span>Building Live in Startup City</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
                  You&apos;re Live!
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Your bid has been confirmed in the verified ledger.
                </p>
              </div>

              {/* Verified Listing Card */}
              {data.listing && (
                <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border-color)] text-left space-y-3">
                  <div className="flex items-center space-x-3">
                    {data.listing.logoUrl ? (
                      <img
                        src={data.listing.logoUrl}
                        alt={data.listing.title}
                        className="w-10 h-10 rounded-xl object-cover border border-[var(--border-color)]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--color-teal)]">
                        <PlatformIcon type={data.listing.destinationType} className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-[var(--text-primary)] truncate">{data.listing.title}</div>
                      <div className="text-xs text-[var(--color-teal)] truncate">{data.listing.canonicalUrl}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)] text-xs">
                    <div className="bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-color)]">
                      <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Global Rank</div>
                      <div className="text-lg font-extrabold text-[var(--text-primary)] mt-0.5 flex items-center">
                        {isFirst && <Trophy className="w-4 h-4 text-[var(--color-salmon)] mr-1" />}
                        #{data.globalRank}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        #{data.categoryRank} in {data.listing.categoryName}
                      </div>
                    </div>

                    <div className="bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-color)]">
                      <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Verified Bid</div>
                      <div className="text-lg font-extrabold text-[var(--color-teal)] font-mono mt-0.5">
                        ${dollars.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        100% verified
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                {data.listing && (
                  <Link
                    href={`/listing/${data.listing.id}`}
                    className="w-full py-3 px-4 bg-[var(--color-salmon)] hover:bg-[var(--color-salmon-hover)] text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <span>View Building</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}

                <Link
                  href="/"
                  className="w-full py-3 px-4 bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] font-semibold rounded-xl text-xs border border-[var(--border-color)] transition flex items-center justify-center space-x-1.5"
                >
                  <span>Startup City</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="flex items-center justify-center space-x-1.5 text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-teal)]" />
                <span>Deterministic database verification complete.</span>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-xs text-[var(--text-muted)]">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
