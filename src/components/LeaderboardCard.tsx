'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, ExternalLink, MousePointerClick, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { launchRazorpayCheckout } from '@/lib/payments/client-checkout';
import { getCountryFlag, getCountryName } from '@/lib/countries';

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
  countryCode?: string | null;
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

export function LeaderboardCard({ item }: LeaderboardCardProps) {
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
      className={`rounded-2xl transition-all duration-150 relative bg-[var(--bg-surface)] text-[var(--text-primary)] ${
        isFirst
          ? 'border border-[var(--color-amber)]/60 shadow-[0_0_25px_rgba(216,178,87,0.12)]'
          : 'border border-white/[0.08] hover:border-white/[0.14] shadow-sm'
      }`}
    >
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Rank + Logo + Content */}
        <div className="flex items-start space-x-3.5 min-w-0 flex-1">
          {/* Rank Badge */}
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
              isFirst
                ? 'bg-[var(--bg-page-deep)] text-[var(--color-amber)] border-[var(--color-amber)]/40 shadow-xs'
                : 'bg-[var(--bg-page-deep)] text-[var(--text-secondary)] border-white/[0.08]'
            }`}
          >
            {isFirst && <Trophy className="w-4 h-4 text-[var(--color-amber)] mr-0.5" />}
            <span>#{item.rank}</span>
          </div>

          {/* Logo / Icon */}
          <Link href={`/listing/${item.id}`} className="shrink-0 group">
            {item.logoUrl ? (
              <img
                src={item.logoUrl}
                alt={item.title}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-white/[0.08] group-hover:border-[var(--color-coral)] transition"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-page-deep)] border border-white/[0.08] flex items-center justify-center text-[var(--color-coral)] group-hover:border-[var(--color-coral)] transition">
                <PlatformIcon type={item.destinationType} className="w-5 h-5" />
              </div>
            )}
          </Link>

          {/* Content Details */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Link
                href={`/listing/${item.id}`}
                className="font-bold text-sm sm:text-base text-[var(--text-primary)] hover:text-[var(--color-coral)] transition truncate"
              >
                {item.title}
              </Link>

              {/* Destination badge & Outbound link */}
              <a
                href={`/visit/${item.id}`}
                target="_blank"
                rel="sponsored noopener noreferrer"
                title={`Visit ${item.destinationUrl}`}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-[var(--bg-page-deep)] hover:bg-[var(--bg-card-hover)] border border-white/[0.06] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition max-w-[150px] sm:max-w-[200px]"
              >
                <span className="truncate">{item.canonicalUrl}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
              </a>
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-1 mb-1.5">
              {item.description}
            </p>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center space-x-1 font-medium text-[var(--text-secondary)]">
                <span>{getCountryFlag(item.countryCode)}</span>
                <span>{getCountryName(item.countryCode)}</span>
              </span>
              <span>·</span>
              <span className="font-semibold text-[var(--color-coral)] bg-[var(--color-coral)]/10 px-2 py-0.5 rounded-lg border border-[var(--color-coral)]/25">
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
              <div className="mt-1 text-xs text-red-400 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Verified Bid & CTA */}
        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-white/[0.08] shrink-0 sm:pl-4">
          <div className="text-left sm:text-right">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
              Verified Conviction
            </div>
            <div className="text-base sm:text-lg font-extrabold text-[var(--color-amber)] font-mono">
              ${dollars.toLocaleString()}
            </div>
          </div>

          <div className="sm:mt-2">
            <button
              onClick={handleDirectOutbid}
              disabled={loading}
              className="px-4 py-1.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] disabled:opacity-50 text-[#07171C] font-semibold text-xs rounded-xl shadow-md shadow-[var(--color-coral)]/15 transition flex items-center space-x-1 cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <span>Back Conviction</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
