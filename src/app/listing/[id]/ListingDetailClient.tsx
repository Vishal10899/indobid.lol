'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, ExternalLink, MousePointerClick, ArrowLeft, Share2, Check, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BidModal } from '@/components/BidModal';
import { PlatformIcon, getPlatformLabel } from '@/components/PlatformIcon';

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
    clickCount: number;
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
      `Check out ${listing.title} ranked #${listing.globalRank} on @indobid_lol with $${dollars.toLocaleString()} verified bid!\n\n`
    );
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      <Navbar onOpenBidModal={() => setIsBidModalOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Global Leaderboard</span>
        </Link>

        {/* Feedback Banners */}
        {isPaymentSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Payment Verified!</span> Your bid has been confirmed and your leaderboard rank updated.
            </div>
          </div>
        )}

        {isPaymentCanceled && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Payment Canceled:</span> No charges were made and your ranking was unchanged.
            </div>
          </div>
        )}

        {/* Main Listing Header Card */}
        <div className={`bg-[var(--bg-card)] border rounded-2xl p-5 sm:p-6 shadow-2xs relative ${isFirst ? 'border-amber-400/60 ring-1 ring-amber-400/30' : 'border-[var(--border-color)]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              {/* Rank Badge */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border ${
                  isFirst
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-extrabold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-color)]'
                }`}
              >
                {isFirst && <Trophy className="w-4 h-4 text-amber-500 mr-0.5" />}
                <span>#{listing.globalRank}</span>
              </div>

              {/* Logo */}
              {listing.logoUrl ? (
                <img
                  src={listing.logoUrl}
                  alt={listing.title}
                  className="w-12 h-12 rounded-xl object-cover border border-[var(--border-color)] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                  <PlatformIcon type={listing.destinationType} className="w-6 h-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{listing.title}</h1>
                  <span className="text-xs bg-[var(--bg-surface)] text-[var(--text-secondary)] px-2 py-0.5 rounded font-medium border border-[var(--border-color)]">
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
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-lg text-xs font-semibold shadow-2xs transition"
                >
                  <PlatformIcon type={listing.destinationType} className="w-3.5 h-3.5 opacity-80" />
                  <span>Visit Destination</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                </a>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="flex items-center space-x-1.5 self-start sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-color)]">
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition flex items-center space-x-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                <span>{copied ? 'Copied' : 'Share'}</span>
              </button>

              <button
                onClick={handleShareX}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition flex items-center space-x-1 cursor-pointer"
              >
                <PlatformIcon type="x" className="w-3 h-3 text-[var(--text-muted)]" />
                <span>Post</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-[var(--border-color)] text-xs">
            <div className="bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-semibold">Verified Cumulative Bid</div>
              <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] font-mono mt-0.5">
                ${dollars.toLocaleString()}
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-semibold">Category Rank</div>
              <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">
                #{listing.categoryRank} <span className="text-xs font-normal text-[var(--text-muted)]">in {listing.categoryName}</span>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-semibold">Outbound Clicks</div>
              <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5 flex items-center space-x-1">
                <MousePointerClick className="w-4 h-4 text-[var(--text-muted)]" />
                <span>{listing.clickCount.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border-color)]">
              <div className="text-[var(--text-secondary)] text-[10px] uppercase font-semibold">Platform</div>
              <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5 capitalize">
                {getPlatformLabel(listing.destinationType)}
              </div>
            </div>
          </div>
        </div>

        {/* Boost / Rebidding Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
              Boost & Defend Rank
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-0.5">
              Outbid or increase cumulative bid for {listing.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              You only pay the difference between your target amount and the current ${dollars.toLocaleString()} verified total.
            </p>
          </div>

          <button
            onClick={() => setIsBidModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-2xs transition flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
          >
            <span>Bid Now</span>
          </button>
        </div>

        {/* Bid History Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Verified Bid Ledger ({listing.bids.length} transactions)</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--text-secondary)] border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <tr>
                  <th className="py-2 px-3 font-semibold">Timestamp</th>
                  <th className="py-2 px-3 font-semibold">Charge Amount</th>
                  <th className="py-2 px-3 font-semibold">Previous Total</th>
                  <th className="py-2 px-3 font-semibold">New Cumulative Total</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {listing.bids.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--bg-surface)]">
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] font-mono text-[11px]">
                      {new Date(b.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +${(b.amount / 100).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[var(--text-muted)]">
                      ${(b.previousBid / 100).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[var(--text-primary)]">
                      ${(b.newTotalBid / 100).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
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
