'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, ExternalLink, MousePointerClick, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { launchRazorpayCheckout } from '@/lib/payments/client-checkout';

export interface LeaderboardItemData {
  id: string;
  rank: number;
  categoryRank?: number;
  destinationUrl: string;
  canonicalUrl: string;
  destinationType: string;
  title: string;
  description: string;
  logoUrl: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  verifiedBid: number; // in cents
  currency: string;
  clickCount: number;
  status: string;
  socialWebsite: string | null;
  socialInstagram: string | null;
  socialYoutube: string | null;
  socialX: string | null;
  createdAt: string | Date;
  bidReachedAt: string | Date;
  minOutbidCents: number;
}

interface LeaderboardCardProps {
  item: LeaderboardItemData;
  onCustomOutbid?: (item: LeaderboardItemData) => void;
}

function formatDeterministicDate(dateInput: string | Date): string {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function LeaderboardCard({ item, onCustomOutbid }: LeaderboardCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFirst = item.rank === 1;
  const dollars = item.verifiedBid / 100;
  const minOutbidDollars = Math.ceil(item.minOutbidCents / 100);

  // Direct 1-Click Outbid
  const handleDirectOutbid = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: item.id,
          targetTotalBidDollars: minOutbidDollars,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize checkout');
      }

      await launchRazorpayCheckout({
        keyId: data.keyId,
        orderId: data.orderId || data.sessionId,
        amount: data.amount || data.chargeAmountCents,
        currency: data.currency || 'USD',
        listingId: data.listingId || item.id,
        bidId: data.bidId,
        listingTitle: item.title,
        checkoutUrl: data.checkoutUrl,
      });
    } catch (err) {
      console.error('Direct outbid error:', err);
      setError(err instanceof Error ? err.message : 'Error starting checkout');
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-150 relative bg-[var(--bg-card)] ${
        isFirst
          ? 'border-amber-400/60 shadow-2xs ring-1 ring-amber-400/30'
          : 'border-[var(--border-color)] hover:border-[var(--text-secondary)] hover:shadow-2xs'
      }`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Rank + Logo + Content */}
        <div className="flex items-start space-x-3 min-w-0 flex-1">
          {/* Rank Badge */}
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border ${
              isFirst
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-extrabold'
                : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-color)]'
            }`}
          >
            {isFirst && <Trophy className="w-3.5 h-3.5 text-amber-500 mr-0.5" />}
            <span>#{item.rank}</span>
          </div>

          {/* Logo / Icon */}
          <Link href={`/listing/${item.id}`} className="shrink-0">
            {item.logoUrl ? (
              <img
                src={item.logoUrl}
                alt={item.title}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover border border-[var(--border-color)]"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)]">
                <PlatformIcon type={item.destinationType} className="w-4 h-4" />
              </div>
            )}
          </Link>

          {/* Content Details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <Link
                href={`/listing/${item.id}`}
                className="font-semibold text-sm sm:text-base text-[var(--text-primary)] hover:text-amber-500 transition truncate"
              >
                {item.title}
              </Link>

              {/* Destination badge & Outbound link */}
              <a
                href={`/visit/${item.id}`}
                target="_blank"
                rel="sponsored noopener noreferrer"
                title={`Visit ${item.destinationUrl}`}
                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition max-w-[150px] sm:max-w-[200px]"
              >
                <span className="truncate">{item.canonicalUrl}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
              </a>
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-1 mb-1.5">
              {item.description}
            </p>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] px-1.5 py-0.2 rounded">
                {item.categoryName}
              </span>
              <span>·</span>
              <span className="flex items-center space-x-1">
                <MousePointerClick className="w-3 h-3 text-[var(--text-muted)]" />
                <span>{item.clickCount.toLocaleString()} clicks</span>
              </span>
              <span>·</span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                <span>{formatDeterministicDate(item.bidReachedAt)}</span>
              </span>
            </div>

            {error && (
              <div className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Verified Bid & CTA */}
        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2.5 sm:pt-0 border-[var(--border-color)] shrink-0 sm:pl-3">
          <div className="text-left sm:text-right">
            <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)]">
              Verified Bid
            </div>
            <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-mono">
              ${dollars.toLocaleString()}
            </div>
          </div>

          <div className="sm:mt-1.5">
            <button
              onClick={handleDirectOutbid}
              disabled={loading}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <span>Bid Now</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
