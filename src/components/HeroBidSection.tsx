'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowRight, Minus, Plus, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { launchRazorpayCheckout } from '@/lib/payments/client-checkout';
import { POPULAR_COUNTRIES, DEFAULT_COUNTRY_CODE } from '@/lib/countries';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface HeroBidSectionProps {
  categories: Category[];
  highestBidCents: number;
  minimumToTakeFirstCents: number;
  onOpenBidModal: (data: {
    url?: string;
    targetBidDollars: number;
    categoryId?: string;
    existingListingId?: string;
  }) => void;
}

export function HeroBidSection({
  categories,
  highestBidCents,
  minimumToTakeFirstCents,
  onOpenBidModal,
}: HeroBidSectionProps) {
  const minToTakeFirstDollars = Math.ceil(minimumToTakeFirstCents / 100);
  // Default target for new listing is $2
  const [targetDollars, setTargetDollars] = useState<number>(minToTakeFirstDollars || 2);
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [urlLookup, setUrlLookup] = useState<{
    exists: boolean;
    title?: string;
    currentVerifiedBid?: number;
    destinationType?: string;
    listingId?: string;
    categorySlug?: string;
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [estimation, setEstimation] = useState<{
    estimatedGlobalRank: number;
    estimatedCategoryRank?: number;
    isFirstPlace: boolean;
    chargeAmountCents: number;
    targetBidCents: number;
    competitorAhead?: { title: string; verifiedBid: number; rank: number } | null;
  } | null>(null);

  // Sync initial target amount when minimumToTakeFirstCents loads
  useEffect(() => {
    if (minToTakeFirstDollars > 0 && targetDollars < minToTakeFirstDollars && highestBidCents > 0) {
      setTargetDollars(minToTakeFirstDollars);
    }
  }, [minToTakeFirstDollars, highestBidCents]);

  // Set default category
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Debounced URL lookup (auto-detects existing listing for rebidding)
  useEffect(() => {
    if (!url || url.trim().length < 4) {
      setUrlLookup(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await fetch('/api/listings/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.listing) {
            setUrlLookup({
              exists: true,
              title: data.listing.title,
              currentVerifiedBid: data.listing.verifiedBid,
              destinationType: data.destinationType,
              listingId: data.listing.id,
              categorySlug: data.listing.categorySlug,
            });
            if (data.listing.categoryId) {
              setCategoryId(data.listing.categoryId);
            }
            // Suggested next target: current verified bid + $3
            const currentBidDollars = Math.ceil(data.listing.verifiedBid / 100);
            setTargetDollars(currentBidDollars + 3);
          } else {
            setUrlLookup({
              exists: false,
              destinationType: data.destinationType,
            });
          }
        }
      } catch (e) {
        console.error('URL lookup failed:', e);
      } finally {
        setLookupLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [url]);

  // Dynamic rank estimation query
  useEffect(() => {
    const fetchEstimation = async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetBidDollars: targetDollars,
            categoryId: categoryId || undefined,
            url: url || undefined,
            listingId: urlLookup?.listingId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setEstimation(data);
        }
      } catch (e) {
        console.error('Estimate failed:', e);
      }
    };

    fetchEstimation();
  }, [targetDollars, categoryId, url, urlLookup]);

  const handleAdjustBid = (delta: number) => {
    setTargetDollars((prev) => Math.max(2, prev + delta));
  };

  const handleDirectBidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) {
      setTargetDollars(Math.max(1, val));
    } else {
      setTargetDollars(0);
    }
  };

  // Direct checkout submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a destination URL');
      return;
    }

    const currentVerifiedDollars = urlLookup?.currentVerifiedBid ? urlLookup.currentVerifiedBid / 100 : 0;
    if (urlLookup?.exists && targetDollars <= currentVerifiedDollars) {
      setError(
        `Current verified bid is $${currentVerifiedDollars.toLocaleString()}. A target below or equal to $${currentVerifiedDollars.toLocaleString()} will not increase this listing's position.`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: urlLookup?.listingId,
          destinationUrl: url,
          categoryId,
          countryCode,
          targetTotalBidDollars: targetDollars,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize checkout session');
      }

      await launchRazorpayCheckout({
        keyId: data.keyId,
        orderId: data.orderId || data.sessionId,
        amount: data.amount || data.chargeAmountCents,
        currency: data.currency || 'USD',
        listingId: data.listingId,
        bidId: data.bidId,
        listingTitle: data.listingTitle || url,
        checkoutUrl: data.checkoutUrl,
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Error starting checkout');
      setLoading(false);
    }
  };

  const currentVerifiedDollars = urlLookup?.currentVerifiedBid ? urlLookup.currentVerifiedBid / 100 : 0;
  const chargeAmountDollars = estimation ? estimation.chargeAmountCents / 100 : targetDollars;
  const estimatedRank = estimation?.estimatedGlobalRank || 1;

  return (
    <section className="pt-6 pb-8 sm:pt-10 sm:pb-12 bg-[var(--bg-section)] border-b border-[var(--border-color)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Headline */}
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          Pay more. Rank higher.
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          Public visibility determined by verified cumulative bids.
        </p>

        {/* Compact Bid / Submission Card */}
        <div className="mt-5 sm:mt-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-5 shadow-2xs text-left max-w-2xl mx-auto">
          {/* Top: Target Rank + Compact Stepper */}
          <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--border-color)]">
            <div>
              <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Target Bid
              </div>
              <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">
                {estimatedRank === 1 ? (
                  <span className="text-amber-500 flex items-center">
                    <Trophy className="w-4 h-4 mr-1 text-amber-500 shrink-0" /> Rank #1 Global
                  </span>
                ) : (
                  <span>Rank #{estimatedRank}</span>
                )}
              </div>
            </div>

            {/* Stepper Control */}
            <div className="flex items-center space-x-1 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => handleAdjustBid(-1)}
                className="w-8 h-8 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center transition border border-[var(--border-color)] cursor-pointer"
                aria-label="Decrease bid by $1"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center px-1 font-mono">
                <span className="text-[var(--text-secondary)] font-semibold text-sm sm:text-base mr-0.5">$</span>
                <input
                  type="text"
                  value={targetDollars > 0 ? targetDollars.toLocaleString() : ''}
                  onChange={handleDirectBidChange}
                  className="w-14 sm:w-20 bg-transparent text-[var(--text-primary)] font-bold text-base sm:text-lg focus:outline-none text-center"
                  placeholder="2"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustBid(1)}
                className="w-8 h-8 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center transition border border-[var(--border-color)] cursor-pointer"
                aria-label="Increase bid by $1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-3">
            {/* Destination URL */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Destination URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourstartup.com or @handle"
                  required
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition"
                />
                {lookupLoading && (
                  <div className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)] animate-spin">⟳</div>
                )}
                {urlLookup?.destinationType && (
                  <div className="absolute right-3 top-2 text-[var(--text-secondary)]">
                    <PlatformIcon type={urlLookup.destinationType} className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Category & Country in compact 2-column layout */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-2.5 text-[var(--text-primary)] text-xs sm:text-sm focus:outline-none transition cursor-pointer truncate"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Country
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-2.5 text-[var(--text-primary)] text-xs sm:text-sm focus:outline-none transition cursor-pointer truncate"
                >
                  {POPULAR_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Existing listing notification (Rebidding / Cumulative Bid detection) */}
            {urlLookup?.exists && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-start space-x-2 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">{urlLookup.title}</span> has{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">${currentVerifiedDollars.toLocaleString()}</span> verified.
                  You pay the difference ({' '}
                  <span className="font-bold text-[var(--text-primary)]">${Math.max(0, targetDollars - currentVerifiedDollars).toLocaleString()}</span>{' '}
                  ) to reach ${targetDollars.toLocaleString()}.
                </div>
              </div>
            )}

            {/* Compact Summary: 2-column Primary Stats + Secondary Detail Line */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
                  <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-medium">Estimated rank</div>
                  <div className="text-base sm:text-lg font-bold text-amber-500 mt-0.5">
                    #{estimatedRank}
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
                  <div className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-medium">Pay today</div>
                  <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    ${chargeAmountDollars.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Secondary detail line */}
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1 pt-0.5">
                <div>
                  <span>Total bid: </span>
                  <strong className="text-[var(--text-primary)] font-mono">${targetDollars.toLocaleString()}</strong>
                </div>
                <div className="truncate max-w-[150px] sm:max-w-[200px] text-right">
                  <span>Ahead of: </span>
                  <strong className="text-[var(--text-primary)] truncate">
                    {estimation?.competitorAhead ? estimation.competitorAhead.title : 'None (Top #1)'}
                  </strong>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Clean Main CTA: "Bid Now →" */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm sm:text-base rounded-xl shadow-2xs transition flex items-center justify-center space-x-1.5 cursor-pointer mt-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Bid Now</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
