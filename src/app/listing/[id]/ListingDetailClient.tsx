'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, ExternalLink, MousePointerClick, ArrowLeft, Share2, Check, Sparkles, Eye, Building2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BidModal } from '@/components/BidModal';
import { PlatformIcon, getPlatformLabel } from '@/components/PlatformIcon';
import { getCountryFlag, getCountryName } from '@/lib/countries';

interface ListingDetailProps {
  listing: {
    id: string;
    title: string;
    description: string;
    destinationUrl: string;
    canonicalUrl: string;
    destinationType: string;
    logoUrl: string | null;
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    verifiedBid: number;
    currency: string;
    countryCode?: string | null;
    clickCount: number;
    visitCount?: number;
    status: string;
    socialWebsite: string | null;
    socialInstagram: string | null;
    socialYoutube: string | null;
    socialX: string | null;
    createdAt: string;
    bidReachedAt: string;
    globalRank: number;
    categoryRank: number;
    minOutbidCents: number;
    bids: Array<{
      id: string;
      amount: number;
      previousBid: number;
      newTotalBid: number;
      createdAt: string;
    }>;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  isPaymentSuccess?: boolean;
  isPaymentCanceled?: boolean;
  sessionId?: string;
}

export function ListingDetailClient({
  listing,
  categories,
  isPaymentSuccess,
  isPaymentCanceled,
}: ListingDetailProps) {
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Trigger listing visit tracking on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      let sessionToken = localStorage.getItem('indobid_session_id');
      if (!sessionToken) {
        const now = Date.now();
        sessionToken = crypto.randomUUID ? crypto.randomUUID() : `sess_${now}_${Math.random().toString(36).substring(2, 12)}`;
        localStorage.setItem('indobid_session_id', sessionToken);
        localStorage.setItem('indobid_session_last_active', now.toString());
      }

      if (sessionToken && listing.id) {
        fetch('/api/analytics/listing-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id, sessionToken }),
        }).catch(() => {});
      }
    } catch {
      // Non-critical tracking safety
    }
  }, [listing.id]);

  const dollars = listing.verifiedBid / 100;
  const minOutbidDollars = Math.ceil(listing.minOutbidCents / 100);
  const isFirst = listing.globalRank === 1;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    const text = encodeURIComponent(
      `Check out ${listing.title} ranked #${listing.globalRank} in the @indobid_lol startup city with ₹${dollars.toLocaleString()} verified bid!\n\n`
    );
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Navbar onOpenBidModal={() => setIsBidModalOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--color-teal)] transition font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Startup City Leaderboard</span>
        </Link>

        {/* Feedback Banners */}
        {isPaymentSuccess && (
          <div className="p-4 rounded-2xl bg-[var(--color-teal-light)] border border-[var(--color-teal-border)] text-[var(--color-teal)] text-xs sm:text-sm flex items-start space-x-2.5 shadow-xs">
            <Sparkles className="w-4 h-4 text-[var(--color-teal)] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Payment Verified!</span> Your bid has been cryptographically confirmed and your building rank has been updated.
            </div>
          </div>
        )}

        {isPaymentCanceled && (
          <div className="p-4 rounded-2xl bg-[var(--color-salmon-light)] border border-[var(--color-salmon-border)] text-[var(--color-salmon)] text-xs sm:text-sm flex items-start space-x-2.5 shadow-xs">
            <Sparkles className="w-4 h-4 text-[var(--color-salmon)] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Payment Canceled:</span> No charges were made and your ranking remains unchanged.
            </div>
          </div>
        )}

        {/* Main Listing Header Card */}
        <div className={`bg-[var(--bg-card)] border rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs relative ${isFirst ? 'border-[var(--color-salmon)] ring-1 ring-[var(--color-salmon)]/40' : 'border-[var(--border-color)]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start space-x-4">
              {/* Rank Badge */}
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-lg shrink-0 border ${
                  isFirst
                    ? 'bg-[var(--color-salmon)] text-white border-[var(--color-salmon)] shadow-xs'
                    : 'bg-[var(--bg-surface)] text-[var(--color-teal)] border-[var(--border-color)]'
                }`}
              >
                {isFirst && <Trophy className="w-5 h-5 text-white mr-0.5" />}
                <span>#{listing.globalRank}</span>
              </div>

              {/* Logo */}
              {listing.logoUrl ? (
                <img
                  src={listing.logoUrl}
                  alt={listing.title}
                  className="w-14 h-14 rounded-2xl object-cover border border-[var(--border-color)] shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--color-teal)] shrink-0">
                  <PlatformIcon type={listing.destinationType} className="w-7 h-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">{listing.title}</h1>
                  <span className="text-xs bg-[var(--bg-surface)] text-[var(--text-secondary)] px-2.5 py-0.5 rounded-lg font-medium border border-[var(--border-color)] flex items-center space-x-1">
                    <span>{getCountryFlag(listing.countryCode)}</span>
                    <span>{getCountryName(listing.countryCode)}</span>
                  </span>
                  <span className="text-xs bg-[var(--bg-surface)] text-[var(--text-secondary)] px-2.5 py-0.5 rounded-lg font-medium border border-[var(--border-color)]">
                    {listing.categoryName}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-3">
                  {listing.description}
                </p>

                {/* Primary Outbound Visit Button */}
                <a
                  href={`/visit/${listing.id}`}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[var(--color-teal)] hover:bg-[var(--color-teal-hover)] text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-[0.98]"
                >
                  <PlatformIcon type={listing.destinationType} className="w-3.5 h-3.5 opacity-90" />
                  <span>Visit {listing.canonicalUrl}</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                </a>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="flex items-center space-x-2 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-color)]">
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                <span>{copied ? 'Copied' : 'Share'}</span>
              </button>

              <button
                onClick={handleShareX}
                className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
              >
                <PlatformIcon type="x" className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Post</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-6 pt-5 border-t border-[var(--border-color)] text-xs">
            <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Verified Total Bid</div>
              <div className="text-base sm:text-lg font-extrabold text-[var(--color-teal)] font-mono mt-0.5">
                ₹{dollars.toLocaleString()}
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Category Rank</div>
              <div className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] mt-0.5">
                #{listing.categoryRank} <span className="text-xs font-normal text-[var(--text-muted)]">in {listing.categoryName}</span>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Listing Views</div>
              <div className="text-base sm:text-lg font-extrabold text-[var(--color-teal)] mt-0.5 flex items-center space-x-1">
                <Eye className="w-4 h-4 text-[var(--color-teal)]" />
                <span>{(listing.visitCount ?? 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Outbound Clicks</div>
              <div className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] mt-0.5 flex items-center space-x-1">
                <MousePointerClick className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{listing.clickCount.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)] col-span-2 sm:col-span-1">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-bold">Platform</div>
              <div className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] mt-0.5 capitalize">
                {getPlatformLabel(listing.destinationType)}
              </div>
            </div>
          </div>
        </div>

        {/* Boost / Rebidding Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-[var(--color-salmon)] uppercase tracking-wide flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Upgrade & Defend Position</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-1">
              Outbid or increase cumulative bid for {listing.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              You only pay the difference between your target amount and the current ₹{dollars.toLocaleString()} verified total.
            </p>
          </div>

          <button
            onClick={() => setIsBidModalOpen(true)}
            className="w-full sm:w-auto px-6 py-3 bg-[var(--color-salmon)] hover:bg-[var(--color-salmon-hover)] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 active:scale-[0.98]"
          >
            <span>Bid Now</span>
          </button>
        </div>

        {/* Bid History Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Verified Bid Ledger ({listing.bids.length} transactions)</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--text-secondary)] border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Timestamp</th>
                  <th className="py-2.5 px-3 font-bold">Charge Amount</th>
                  <th className="py-2.5 px-3 font-bold">Previous Total</th>
                  <th className="py-2.5 px-3 font-bold">New Cumulative Total</th>
                  <th className="py-2.5 px-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {listing.bids.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--bg-surface)]/50 transition">
                    <td className="py-3 px-3 text-[var(--text-secondary)] font-mono text-[11px]">
                      {new Date(b.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
                    </td>
                    <td className="py-3 px-3 font-mono font-extrabold text-[var(--color-teal)]">
                      +₹{(b.amount / 100).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-[var(--text-muted)]">
                      ₹{(b.previousBid / 100).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono font-extrabold text-[var(--text-primary)]">
                      ₹{(b.newTotalBid / 100).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-teal-light)] text-[var(--color-teal)] border border-[var(--color-teal-border)]">
                        Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />

      {/* Bid Modal for Boosting */}
      <BidModal
        isOpen={isBidModalOpen}
        onClose={() => setIsBidModalOpen(false)}
        categories={categories}
        initialData={{
          url: listing.destinationUrl,
          targetBidDollars: minOutbidDollars,
          categoryId: listing.categoryId,
          existingListingId: listing.id,
          title: listing.title,
          description: listing.description,
          logoUrl: listing.logoUrl || undefined,
        }}
      />
    </div>
  );
}
