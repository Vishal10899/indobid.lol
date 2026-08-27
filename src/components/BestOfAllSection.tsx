'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Eye, ExternalLink, Sparkles, ArrowRight } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { getCountryFlag, getCountryName } from '@/lib/countries';

interface TopListingItem {
  id: string;
  title: string;
  destinationUrl: string;
  canonicalUrl: string;
  destinationType: string;
  description: string;
  logoUrl: string | null;
  verifiedBid: number;
  currency: string;
  countryCode?: string | null;
  visitCount: number;
  clickCount: number;
  createdAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
}

function formatVisitCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toLocaleString();
}

export function BestOfAllSection() {
  const [items, setItems] = useState<TopListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTopListings = async () => {
    try {
      const res = await fetch('/api/analytics/top-listings');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load Best of All listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopListings();
    // Refresh periodically (every 45s)
    const interval = setInterval(fetchTopListings, 45000);
    return () => clearInterval(interval);
  }, []);

  if (!loading && items.length === 0) {
    return null;
  }

  const rankBadges = [
    'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-500/30',
    'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 ring-1 ring-slate-400/30',
    'bg-amber-700/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-700/30',
    'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]',
    'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]',
  ];

  return (
    <section id="best-of-all" className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 border-t border-[var(--border-color)]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-1.5 border border-amber-500/20">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Most Visited Listings</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] flex items-center space-x-2">
            <span>🏆 Best of All</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Ranked exclusively by <strong>verified real visitor traffic</strong> to each public listing page.
          </p>
        </div>

        <div className="text-[11px] text-[var(--text-muted)] flex items-center space-x-1 self-start sm:self-auto">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Independent from cumulative bid ranks</span>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-2.5">
          {items.map((item, index) => {
            const rank = index + 1;
            const rankBadgeClass = rankBadges[index] || rankBadges[3];
            const isTop3 = rank <= 3;

            return (
              <div
                key={item.id}
                className="group relative bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-amber-500/40 rounded-xl p-3 sm:p-4 transition duration-150 shadow-2xs flex items-center justify-between gap-3"
              >
                {/* Left: Rank + Info */}
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  {/* Rank Badge */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-extrabold text-xs sm:text-sm shrink-0 ${rankBadgeClass}`}
                  >
                    #{rank}
                  </div>

                  {/* Logo or Platform Icon */}
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center shrink-0 overflow-hidden">
                    {item.logoUrl ? (
                      <img src={item.logoUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <PlatformIcon type={item.destinationType} className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                      <Link
                        href={`/listing/${item.id}`}
                        className="font-bold text-xs sm:text-sm text-[var(--text-primary)] hover:text-amber-500 transition truncate max-w-[200px] sm:max-w-[320px]"
                      >
                        {item.title}
                      </Link>

                      {item.countryCode && (
                        <span
                          className="text-xs cursor-default shrink-0"
                          title={getCountryName(item.countryCode)}
                        >
                          {getCountryFlag(item.countryCode)}
                        </span>
                      )}

                      <span className="text-[10px] bg-[var(--bg-surface)] text-[var(--text-muted)] px-1.5 py-0.2 rounded border border-[var(--border-color)] shrink-0 hidden sm:inline-block">
                        {item.category.name}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 hidden sm:block max-w-[500px]">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right: Real Visits + CTA */}
                <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                  {/* Real Visits Count */}
                  <div className="text-right">
                    <div className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm bg-emerald-500/10 px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono sm:hidden">{formatVisitCount(item.visitCount)}</span>
                      <span className="font-mono hidden sm:inline">{item.visitCount.toLocaleString()}</span>
                      <span className="text-[10px] font-medium hidden sm:inline">visits</span>
                    </div>
                  </div>

                  {/* View Details Link */}
                  <Link
                    href={`/listing/${item.id}`}
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--text-primary)] text-[var(--text-secondary)] hover:text-[var(--bg-card)] border border-[var(--border-color)] text-xs font-semibold transition flex items-center space-x-1"
                    title={`View ${item.title}`}
                  >
                    <span className="hidden sm:inline">View</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
