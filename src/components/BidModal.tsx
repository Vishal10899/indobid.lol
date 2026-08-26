'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Minus, Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { launchRazorpayCheckout } from '@/lib/payments/client-checkout';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  initialData?: {
    url?: string;
    targetBidDollars?: number;
    categoryId?: string;
    existingListingId?: string;
    title?: string;
    description?: string;
    logoUrl?: string;
  };
}

export function BidModal({
  isOpen,
  onClose,
  categories,
  initialData,
}: BidModalProps) {
  const [destinationUrl, setDestinationUrl] = useState(initialData?.url || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '');
  const [targetBidDollars, setTargetBidDollars] = useState<number>(initialData?.targetBidDollars || 2);
  const [logoUrl, setLogoUrl] = useState(initialData?.logoUrl || '');
  const [bidderEmail, setBidderEmail] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [urlLookup, setUrlLookup] = useState<{
    exists: boolean;
    title?: string;
    description?: string;
    currentVerifiedBid?: number;
    destinationType?: string;
    listingId?: string;
    logoUrl?: string;
  } | null>(null);

  const [estimation, setEstimation] = useState<{
    estimatedGlobalRank: number;
    estimatedCategoryRank?: number;
    isFirstPlace: boolean;
    chargeAmountCents: number;
    targetBidCents: number;
    competitorAhead?: { title: string; verifiedBid: number; rank: number } | null;
  } | null>(null);

  // Sync initialData when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData?.url) setDestinationUrl(initialData.url);
      if (initialData?.targetBidDollars) setTargetBidDollars(initialData.targetBidDollars);
      if (initialData?.categoryId) setCategoryId(initialData.categoryId);
      if (initialData?.title) setTitle(initialData.title);
      if (initialData?.description) setDescription(initialData.description);
      if (initialData?.logoUrl) setLogoUrl(initialData.logoUrl);
      setError(null);
    }
  }, [isOpen, initialData]);

  // Set default category if none
  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // URL lookup to detect existing listings for rebidding
  useEffect(() => {
    if (!destinationUrl || destinationUrl.trim().length < 4) {
      setUrlLookup(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/listings/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: destinationUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.listing) {
            setUrlLookup({
              exists: true,
              title: data.listing.title,
              description: data.listing.description,
              currentVerifiedBid: data.listing.verifiedBid,
              destinationType: data.destinationType,
              listingId: data.listing.id,
              logoUrl: data.listing.logoUrl || undefined,
            });
            if (data.listing.title && !title) setTitle(data.listing.title);
            if (data.listing.description && !description) setDescription(data.listing.description);
            if (data.listing.categoryId) setCategoryId(data.listing.categoryId);
            if (data.listing.logoUrl && !logoUrl) setLogoUrl(data.listing.logoUrl);

            // Suggested next target: current verified bid + $3
            const currentBidDollars = Math.ceil(data.listing.verifiedBid / 100);
            setTargetBidDollars(currentBidDollars + 3);
          } else {
            setUrlLookup({
              exists: false,
              destinationType: data.destinationType,
            });
          }
        }
      } catch (e) {
        console.error('URL lookup error in modal:', e);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [destinationUrl]);

  // Rank estimation
  useEffect(() => {
    const fetchEstimation = async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetBidDollars,
            categoryId: categoryId || undefined,
            url: destinationUrl || undefined,
            listingId: urlLookup?.listingId || initialData?.existingListingId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setEstimation(data);
        }
      } catch (e) {
        console.error('Estimate in modal failed:', e);
      }
    };

    fetchEstimation();
  }, [targetBidDollars, categoryId, destinationUrl, urlLookup, initialData]);

  const handleAdjustBid = (delta: number) => {
    setTargetBidDollars((prev) => Math.max(2, prev + delta));
  };

  const handleDirectBidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) {
      setTargetBidDollars(Math.max(1, val));
    } else {
      setTargetBidDollars(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationUrl.trim()) {
      setError('Destination URL is required');
      return;
    }

    const currentVerifiedDollars = urlLookup?.currentVerifiedBid ? urlLookup.currentVerifiedBid / 100 : 0;
    if (urlLookup?.exists && targetBidDollars <= currentVerifiedDollars) {
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
          listingId: urlLookup?.listingId || initialData?.existingListingId,
          destinationUrl,
          title: title || undefined,
          description: description || undefined,
          categoryId,
          targetTotalBidDollars: targetBidDollars,
          logoUrl: logoUrl || undefined,
          bidderEmail: bidderEmail || undefined,
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
        listingId: data.listingId,
        bidId: data.bidId,
        listingTitle: data.listingTitle || title,
        bidderEmail: bidderEmail || undefined,
        checkoutUrl: data.checkoutUrl,
      });
    } catch (err) {
      console.error('Modal checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to redirect to checkout');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentVerifiedDollars = urlLookup?.currentVerifiedBid ? urlLookup.currentVerifiedBid / 100 : 0;
  const chargeAmountDollars = estimation ? estimation.chargeAmountCents / 100 : targetBidDollars;
  const estimatedRank = estimation?.estimatedGlobalRank || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl relative my-8 text-[var(--text-primary)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
            {urlLookup?.exists ? 'Increase Verified Bid' : 'Submit & Rank Listing'}
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mt-0.5">
            {urlLookup?.exists ? `Boost ${urlLookup.title}` : 'Claim Leaderboard Rank'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          {/* Target Bid Amount Stepper */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[var(--text-primary)] text-xs">Target Total Bid</span>
              <span className="text-xs font-bold text-amber-500">
                Estimated Rank #{estimatedRank}
              </span>
            </div>

            <div className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-1">
              <button
                type="button"
                onClick={() => handleAdjustBid(-1)}
                className="w-7 h-7 rounded bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center font-bold cursor-pointer"
                aria-label="Decrease bid by $1"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center font-mono">
                <span className="text-[var(--text-secondary)] font-semibold mr-0.5">$</span>
                <input
                  type="text"
                  value={targetBidDollars > 0 ? targetBidDollars.toLocaleString() : ''}
                  onChange={handleDirectBidChange}
                  className="w-20 bg-transparent text-[var(--text-primary)] font-bold text-base text-center focus:outline-none"
                  placeholder="2"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustBid(1)}
                className="w-7 h-7 rounded bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center font-bold cursor-pointer"
                aria-label="Increase bid by $1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Existing Listing Notification */}
          {urlLookup?.exists && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-start space-x-2 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Existing listing found:</span> Currently at{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">${currentVerifiedDollars.toLocaleString()}</span>.
                You pay the difference ({' '}
                <span className="font-bold text-[var(--text-primary)]">${Math.max(0, targetBidDollars - currentVerifiedDollars).toLocaleString()}</span>{' '}
                ) to reach ${targetBidDollars.toLocaleString()}.
              </div>
            </div>
          )}

          {/* Destination URL */}
          <div>
            <label className="block font-semibold text-[var(--text-primary)] text-xs mb-1">
              Destination URL <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://yourstartup.com or @handle"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition"
              />
              {urlLookup?.destinationType && (
                <div className="absolute right-2.5 top-2.5 text-[var(--text-secondary)]">
                  <PlatformIcon type={urlLookup.destinationType} className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-[var(--text-primary)] text-xs mb-1">
                Title / Product Name
              </label>
              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Acme SaaS"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] text-xs mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-2.5 text-[var(--text-primary)] text-xs sm:text-sm focus:outline-none transition cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-[var(--text-primary)] text-xs mb-1">
              Short Description
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes your destination standout?"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 focus:bg-[var(--bg-card)] rounded-lg py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition resize-none"
            />
          </div>

          {/* Compact Info Row */}
          <div className="grid grid-cols-3 gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-2.5 text-center">
            <div>
              <div className="text-[10px] text-[var(--text-secondary)]">Target Total</div>
              <div className="font-bold text-[var(--text-primary)] font-mono">${targetBidDollars.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-secondary)]">Pay Today</div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">${chargeAmountDollars.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-secondary)]">Estimated Rank</div>
              <div className="font-bold text-amber-500 font-mono">#{estimatedRank}</div>
            </div>
          </div>

          {/* Main CTA: "Bid Now" */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm rounded-xl shadow-2xs transition flex items-center justify-center space-x-1.5 cursor-pointer mt-3"
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
  );
}
