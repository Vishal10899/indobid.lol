'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, CheckCircle2, ArrowRight, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PlatformIcon } from '@/components/PlatformIcon';

interface VerifiedData {
  verified: boolean;
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

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || '';
  const listingId = searchParams.get('listing_id') || '';
  const bidId = searchParams.get('bid_id') || '';
  const paymentId = searchParams.get('payment_id') || '';

  const [data, setData] = useState<VerifiedData | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
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
          }
        }
      } catch (e) {
        console.error('Status check error:', e);
      } finally {
        setPollCount((prev) => prev + 1);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2500);

    return () => clearInterval(interval);
  }, [sessionId, listingId, bidId, paymentId]);

  const isVerified = data?.verified;
  const dollars = data?.verifiedBidCents ? data.verifiedBidCents / 100 : 0;
  const isFirst = data?.globalRank === 1;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-8 shadow-2xs text-center">
          {!isVerified ? (
            /* Processing State */
            <div className="py-6 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Payment Processing...</h1>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                Verifying transaction signature with webhook. Your leaderboard rank will activate shortly.
              </p>
              <div className="text-[11px] text-[var(--text-muted)]">
                Polling status ({pollCount * 2}s)...
              </div>
            </div>
          ) : (
            /* Verified Live State */
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
                  <span>Verified & Live</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                  You're Live!
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Your bid has been recorded in the verified ledger.
                </p>
              </div>

              {/* Verified Listing Card */}
              {data.listing && (
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] text-left space-y-3">
                  <div className="flex items-center space-x-3">
                    {data.listing.logoUrl ? (
                      <img
                        src={data.listing.logoUrl}
                        alt={data.listing.title}
                        className="w-10 h-10 rounded-lg object-cover border border-[var(--border-color)]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)]">
                        <PlatformIcon type={data.listing.destinationType} className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{data.listing.title}</div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">{data.listing.canonicalUrl}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)] text-xs">
                    <div className="bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-color)]">
                      <div className="text-[var(--text-secondary)] text-[10px] uppercase font-semibold">Global Rank</div>
                      <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5 flex items-center">
                        {isFirst && <Trophy className="w-4 h-4 text-amber-500 mr-1" />}
                        #{data.globalRank}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        #{data.categoryRank} in {data.listing.categoryName}
                      </div>
                    </div>

                    <div className="bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-color)]">
                      <div className="text-[var(--text-secondary)] text-[10px] uppercase font-semibold">Verified Bid</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
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
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-xs shadow-2xs transition flex items-center justify-center space-x-1.5"
                  >
                    <span>View Listing</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}

                <Link
                  href="/"
                  className="w-full py-2.5 px-4 bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] font-medium rounded-lg text-xs border border-[var(--border-color)] transition flex items-center justify-center space-x-1.5"
                >
                  <span>Leaderboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="flex items-center justify-center space-x-1 text-[11px] text-[var(--text-muted)]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
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
