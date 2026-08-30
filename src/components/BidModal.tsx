'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Minus, Plus, CheckCircle2, AlertCircle, Loader2, Building2 } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { launchRazorpayCheckout } from '@/lib/payments/client-checkout';
import { POPULAR_COUNTRIES, DEFAULT_COUNTRY_CODE } from '@/lib/countries';

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
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
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
      setTargetBidDollars(val);
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
    if (targetBidDollars < 2) {
      setError('Bid must be at least $2');
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
          countryCode,
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
          className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="mb-4">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[var(--color-teal)] uppercase tracking-wide">
            <Building2 className="w-4 h-4" />
            <span>{urlLookup?.exists ? 'Upgrade Building Spot' : 'Claim Your Spot in the City'}</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)] mt-1">
            {urlLookup?.exists ? `Upgrade ${urlLookup.title}` : 'Build & Rank Your Startup'}
          </h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          {/* Target Bid Amount Stepper */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-[var(--text-primary)] text-xs">Target Total Bid</span>
              <span className="text-xs font-extrabold text-[var(--color-teal)]">
                Estimated Rank #{estimatedRank} in City
              </span>
            </div>

            <div className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-1.5">
              <button
                type="button"
                onClick={() => handleAdjustBid(-1)}
                className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center font-bold cursor-pointer"
                aria-label="Decrease bid by $1"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center font-mono">
                <span className="text-[var(--text-secondary)] font-bold mr-0.5">$</span>
                <input
                  type="text"
                  value={targetBidDollars > 0 ? targetBidDollars.toLocaleString() : ''}
                  onChange={handleDirectBidChange}
                  onBlur={() => {
                    if (targetBidDollars < 2) setTargetBidDollars(2);
                  }}
                  className="w-20 bg-transparent text-[var(--text-primary)] font-extrabold text-base text-center focus:outline-none"
                  placeholder="2"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAdjustBid(1)}
                className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center font-bold cursor-pointer"
                aria-label="Increase bid by $1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Existing Listing Notification */}
          {urlLookup?.exists && (
            <div className="bg-[var(--color-teal-light)] border border-[var(--color-teal-border)] rounded-xl p-3 flex items-start space-x-2 text-xs text-[var(--color-teal)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-teal)] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Existing listing found:</span> Currently at{' '}
                <span className="font-extrabold text-[var(--color-teal)]">${currentVerifiedDollars.toLocaleString()}</span>.
                You pay the difference ({' '}
                <span className="font-bold text-[var(--text-primary)]">${Math.max(0, targetBidDollars - currentVerifiedDollars).toLocaleString()}</span>{' '}
                ) to reach ${targetBidDollars.toLocaleString()}.
              </div>
            </div>
          )}

          {/* Destination URL */}
          <div>
            <label className="block font-bold text-[var(--text-primary)] text-xs mb-1">
              Destination URL <span className="text-[var(--color-salmon)]">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="indobid.lol, example.com or https://..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--color-teal)] focus:bg-[var(--bg-card)] rounded-xl py-2.5 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition"
              />
              {urlLookup?.destinationType && (
                <div className="absolute right-3 top-3 text-[var(--text-secondary)]">
                  <PlatformIcon type={urlLookup.destinationType} className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block font-bold text-[var(--text-primary)] text-xs mb-1">
              Title / Product Name
            </label>
            <input
              type="text"
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Acme AI"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--color-teal)] focus:bg-[var(--bg-card)] rounded-xl py-2.5 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition"
            />
          </div>

          {/* Category & Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[var(--text-primary)] text-xs mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--color-teal)] focus:bg-[var(--bg-card)] rounded-xl py-2.5 px-3 text-[var(--text-primary)] text-xs sm:text-sm focus:outline-none transition cursor-pointer truncate"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-primary)] text-xs mb-1">
                Country
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--color-teal)] focus:bg-[var(--bg-card)] rounded-xl py-2.5 px-3 text-[var(--text-primary)] text-xs sm:text-sm focus:outline-none transition cursor-pointer truncate"
              >
                {POPULAR_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-[var(--text-primary)] text-xs mb-1">
              Short Description
            </label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your startup build?"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--color-teal)] focus:bg-[var(--bg-card)] rounded-xl py-2.5 px-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm focus:outline-none transition resize-none"
            />
          </div>

          {/* Compact Info Row */}
          <div className="grid grid-cols-3 gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-2.5 text-center">
            <div>
              <div className="text-[10px] text-[var(--text-secondary)] font-medium">Target Total</div>
              <div className="font-extrabold text-[var(--text-primary)] font-mono">${targetBidDollars.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-secondary)] font-medium">Pay Today</div>
              <div className="font-extrabold text-[var(--color-salmon)] font-mono">${chargeAmountDollars.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-secondary)] font-medium">Estimated Rank</div>
              <div className="font-extrabold text-[var(--color-teal)] font-mono">#{estimatedRank}</div>
            </div>
          </div>

          {/* Main CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[var(--color-salmon)] hover:bg-[var(--color-salmon-hover)] disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer mt-3 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to Checkout...</span>
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
