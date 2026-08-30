'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowRight, Minus, Plus, CheckCircle2, Loader2, AlertCircle, Building2 } from 'lucide-react';
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
          } else {
            setUrlLookup(null);
          }
        }
      } catch (err) {
        console.error('URL lookup error:', err);
      } finally {
        setLookupLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [url]);

  // Dynamic estimate calculation
  useEffect(() => {
    if (!targetDollars || targetDollars <= 0) return;

    const fetchEstimate = async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetBidDollars: targetDollars,
            categoryId: categoryId || undefined,
            listingId: urlLookup?.listingId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setEstimation(data);
        }
      } catch (err) {
        console.error('Estimate error:', err);
      }
    };

    fetchEstimate();
  }, [targetDollars, categoryId, urlLookup]);

  const handleAdjustBid = (delta: number) => {
    setTargetDollars((prev) => Math.max(2, prev + delta));
  };

  const handleDirectBidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    const num = parseInt(rawVal, 10);
    setTargetDollars(isNaN(num) ? 0 : num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError('Please enter a destination URL or handle');
      return;
    }
    if (targetDollars < 2) {
      setError('Bid must be at least $2');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          targetTotalBidDollars: targetDollars,
          categoryId: categoryId || undefined,
          countryCode: countryCode || DEFAULT_COUNTRY_CODE,
          listingId: urlLookup?.listingId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      await launchRazorpayCheckout({
        keyId: data.keyId,
        orderId: data.orderId || data.sessionId,
        amount: data.amount || data.chargeAmountCents,
        currency: data.currency || 'INR',
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
    <section className="py-8 sm:py-10 bg-[#F8F6EF]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Compact Bid / Submission Card */}
        <div className="bg-white border border-[#E5DDCC] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm text-left max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center space-x-2 pb-3 border-b border-[#E5DDCC]">
            <Building2 className="w-5 h-5 text-[#087F78]" />
            <h2 className="font-extrabold text-base sm:text-lg text-[#102536]">
              Claim Your Building in the City
            </h2>
          </div>

          {/* Top: Target Rank + Compact Stepper */}
          <div className="flex items-center justify-between gap-2 py-4 border-b border-[#E5DDCC]">
            <div>
              <div className="text-[11px] font-bold text-[#71818A] uppercase tracking-wider">
                Target Building Rank
              </div>
              <div className="text-base sm:text-lg font-extrabold text-[#102536] mt-0.5">
                {estimatedRank === 1 ? (
                  <span className="text-[#DE8063] flex items-center font-black">
                    <Trophy className="w-4 h-4 mr-1 text-[#DE8063] shrink-0" /> #1 Center Tower
                  </span>
                ) : (
                  <span className="text-[#087F78] font-bold">Rank #{estimatedRank} in City</span>
                )}
              </div>
            </div>

            {/* Stepper Control */}
            <div className="flex items-center space-x-1 bg-[#F5F2E9] p-1.5 rounded-xl border border-[#E5DDCC]">
              <button
                type="button"
                onClick={() => handleAdjustBid(-1)}
                className="w-8 h-8 rounded-lg bg-white hover:bg-[#F5F2E9] text-[#102536] flex items-center justify-center transition border border-[#E5DDCC] cursor-pointer"
                aria-label="Decrease bid by $1"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center px-2 font-mono">
                <span className="text-[#405866] font-bold text-sm sm:text-base mr-0.5">₹</span>
                <input
                  type="text"
                  value={targetDollars > 0 ? targetDollars.toLocaleString() : ''}
                  onChange={handleDirectBidChange}
                  onBlur={() => {
                    if (targetDollars < 2) setTargetDollars(2);
                  }}
                  className="w-14 sm:w-20 bg-transparent text-[#102536] font-extrabold text-base sm:text-lg focus:outline-none text-center"
                  placeholder="2"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustBid(1)}
                className="w-8 h-8 rounded-lg bg-white hover:bg-[#F5F2E9] text-[#102536] flex items-center justify-center transition border border-[#E5DDCC] cursor-pointer"
                aria-label="Increase bid by ₹1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-4">
            {/* Destination URL */}
            <div>
              <label className="block text-xs font-bold text-[#102536] mb-1">
                Destination URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourstartup.com or @handle"
                  required
                  className="w-full bg-[#F5F2E9] border border-[#E5DDCC] focus:border-[#087F78] focus:bg-white rounded-xl py-2.5 px-3 text-[#102536] placeholder-[#71818A] text-xs sm:text-sm focus:outline-none transition shadow-2xs"
                />
                {lookupLoading && (
                  <div className="absolute right-3 top-3 text-xs text-[#71818A] animate-spin">⟳</div>
                )}
                {urlLookup?.destinationType && (
                  <div className="absolute right-3 top-2.5 text-[#087F78]">
                    <PlatformIcon type={urlLookup.destinationType} className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Category & Country in compact 2-column layout */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#102536] mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-[#F5F2E9] border border-[#E5DDCC] focus:border-[#087F78] focus:bg-white rounded-xl py-2.5 px-3 text-[#102536] text-xs sm:text-sm focus:outline-none transition cursor-pointer truncate font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#102536] mb-1">
                  Country
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full bg-[#F5F2E9] border border-[#E5DDCC] focus:border-[#087F78] focus:bg-white rounded-xl py-2.5 px-3 text-[#102536] text-xs sm:text-sm focus:outline-none transition cursor-pointer truncate font-medium"
                >
                  {POPULAR_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Existing listing notification */}
            {urlLookup?.exists && (
              <div className="bg-[#DDF2EF] border border-[#B9DFDA] rounded-xl p-3 flex items-start space-x-2.5 text-xs text-[#087F78]">
                <CheckCircle2 className="w-4 h-4 text-[#087F78] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{urlLookup.title}</span> has{' '}
                  <span className="font-extrabold text-[#087F78]">₹{currentVerifiedDollars.toLocaleString()}</span> verified.
                  You only pay the difference ({' '}
                  <span className="font-bold text-[#102536]">₹{Math.max(0, targetDollars - currentVerifiedDollars).toLocaleString()}</span>{' '}
                  ) to upgrade your building to ₹{targetDollars.toLocaleString()}.
                </div>
              </div>
            )}

            {/* Compact Summary */}
            <div className="bg-[#F5F2E9] border border-[#E5DDCC] rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-[#E5DDCC]">
                  <div className="text-[10px] sm:text-[11px] text-[#71818A] font-bold uppercase">Estimated Rank</div>
                  <div className="text-base sm:text-lg font-black text-[#087F78] mt-0.5">
                    #{estimatedRank}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#E5DDCC]">
                  <div className="text-[10px] sm:text-[11px] text-[#71818A] font-bold uppercase">Pay Today</div>
                  <div className="text-base sm:text-lg font-black text-[#DE8063] mt-0.5 font-mono">
                    ₹{chargeAmountDollars.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Secondary detail line */}
              <div className="flex items-center justify-between text-[11px] text-[#405866] px-1 pt-1">
                <div>
                  <span>Total verified bid: </span>
                  <strong className="text-[#102536] font-mono">₹{targetDollars.toLocaleString()}</strong>
                </div>
                <div className="truncate max-w-[150px] sm:max-w-[200px] text-right">
                  <span>Ahead of: </span>
                  <strong className="text-[#102536] truncate">
                    {estimation?.competitorAhead ? estimation.competitorAhead.title : 'None (Rank #1)'}
                  </strong>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Clean Main CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 bg-[#DE8063] hover:bg-[#CF6F55] text-white font-bold text-sm sm:text-base rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer mt-2 disabled:opacity-60 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Preparing Checkout...</span>
                </>
              ) : (
                <>
                  <span>Claim Building Spot</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
