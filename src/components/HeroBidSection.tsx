'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowRight, Minus, Plus, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';

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
          targetTotalBidDollars: targetDollars,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize checkout session');
      }

      window.location.href = data.checkoutUrl;
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
    <section className="pt-8 pb-10 sm:pt-12 sm:pb-14 bg-[var(--bg-section)] border-b border-[var(--border-color)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
          Pay more. Rank higher.
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto">
          Public visibility determined by verified cumulative bids.
        </p>

        {/* Compact Bid / Submission Panel */}
        <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 sm:p-6 shadow-2xs text-left max-w-3xl mx-auto">
          {/* Top: Stepper & Target Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-color)]">
            <div>
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Target Bid
              </div>
              <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                {estimatedRank === 1 ? (
                  <span className="text-amber-500 flex items-center">
                    <Trophy className="w-4 h-4 mr-1 text-amber-500" /> Rank #1 Global
                  </span>
                ) : (
                  <span>Rank #{estimatedRank}</span>
                )}
              </div>
            </div>

            {/* Stepper Control */}
            <div className="flex items-center space-x-1.5 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleAdjustBid(-25)}
                className="w-8 h-8 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center transition border border-[var(--border-color)] cursor-pointer"
                aria-label="Decrease bid"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center px-2 font-mono">
                <span className="text-[var(--text-secondary)] font-semibold text-base mr-0.5">$</span>
                <input
                  type="text"
                  value={targetDollars > 0 ? targetDollars.toLocaleString() : ''}
                  onChange={handleDirectBidChange}
                  className="w-20 sm:w-24 bg-transparent text-[var(--text-primary)] font-bold text-lg focus:outline-none text-center"
                  placeholder="0"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustBid(25)}
                className="w-8 h-8 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] flex items-center justify-center transition border border-[var(--border-color)] cursor-pointer"
                aria-label="Increase bid"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center flex-wrap gap-1.5 py-3">
            <span className="text-xs text-[var(--text-secondary)] font-medium mr-1">Presets:</span>
            {minToTakeFirstDollars > 0 && highestBidCents > 0 && (
              <button
                type="button"
                onClick={() => setTargetDollars(minToTakeFirstDollars)}
                className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold transition cursor-pointer"
              >
                Take #1 (${minToTakeFirstDollars.toLocaleString()})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleAdjustBid(25)}
              className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] text-xs font-medium transition cursor-pointer"
            >
              +$25
            </button>
            <button
              type="button"
              onClick={() => handleAdjustBid(100)}
              className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] text-xs font-medium transition cursor-pointer"
            >
              +$100
            </button>
            <button
              type="button"
              onClick={() => handleAdjustBid(500)}
              className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] text-xs font-medium transition cursor-pointer"
            >
              +$500
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Destination URL */}
              <div className="sm:col-span-2">
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
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm focus:outline-none transition"
                  />
                  {lookupLoading && (
                    <div className="absolute right-3 top-2.5 text-xs text-[var(--text-muted)] animate-spin">⟳</div>
                  )}
                  {urlLookup?.destinationType && (
                    <div className="absolute right-3 top-2.5 text-[var(--text-secondary)]">
                      <PlatformIcon type={urlLookup.destinationType} className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-2.5 text-[var(--text-primary)] text-sm focus:outline-none transition cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
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

            {/* Compact Information Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                <div className="text-[11px] text-[var(--text-secondary)] font-medium">Estimated rank</div>
                <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] mt-0.5">
                  #{estimatedRank}
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                <div className="text-[11px] text-[var(--text-secondary)] font-medium">Total bid</div>
                <div className="text-sm sm:text-base font-bold text-[var(--text-primary)] mt-0.5 font-mono">
                  ${targetDollars.toLocaleString()}
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                <div className="text-[11px] text-[var(--text-secondary)] font-medium">Pay today</div>
                <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  ${chargeAmountDollars.toLocaleString()}
                </div>
              </div>

              <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                <div className="text-[11px] text-[var(--text-secondary)] font-medium">Ahead of</div>
                <div className="text-xs font-medium text-[var(--text-primary)] truncate mt-1">
                  {estimation?.competitorAhead ? estimation.competitorAhead.title : 'None (Top #1)'}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Clean Main CTA: "Bid Now" */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-2xs transition flex items-center justify-center space-x-1.5 cursor-pointer mt-2 disabled:opacity-60"
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
