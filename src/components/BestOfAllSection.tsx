'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Eye, Sparkles, ArrowRight } from 'lucide-react';
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
    'bg-[#182126] text-[#F4C343] border border-[#F4C343] shadow-xs',
    'bg-[#182126] text-[#F4C343] border border-[#E5DDCC]',
    'bg-[#182126] text-[#F4C343] border border-[#E5DDCC]',
    'bg-[#F5F2E9] text-[#405866] border border-[#E5DDCC]',
    'bg-[#F5F2E9] text-[#405866] border border-[#E5DDCC]',
  ];

  return (
    <section id="best-of-all" className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 border-t border-[#E5DDCC] bg-[#F8F6EF]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#DDF2EF] text-[#087F78] text-xs font-bold mb-2 border border-[#B9DFDA]">
            <Trophy className="w-3.5 h-3.5 text-[#087F78]" />
            <span>Most Watched Startups</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102536] tracking-tight flex items-center space-x-2">
            <span>🏆 Best of All</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#405866] mt-1">
            The internet&apos;s most watched startups ranked exclusively by <strong>verified real visitor traffic</strong>.
          </p>
        </div>

        <div className="text-xs text-[#71818A] flex items-center space-x-1 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-[#E5DDCC] shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#087F78]" />
          <span>Real visitor analytics only</span>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-2xl bg-white border border-[#E5DDCC] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => {
            const rank = index + 1;
            const rankBadgeClass = rankBadges[index] || rankBadges[3];

            return (
              <div
                key={item.id}
                className="group relative bg-white hover:bg-[#F5F2E9]/60 border border-[#E5DDCC] hover:border-[#087F78]/40 rounded-2xl p-3.5 sm:p-4 transition duration-150 shadow-2xs flex items-center justify-between gap-3"
              >
                {/* Left: Rank + Info */}
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  {/* Rank Badge */}
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shrink-0 ${rankBadgeClass}`}
                  >
                    #{rank}
                  </div>

                  {/* Logo or Platform Icon */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F5F2E9] border border-[#E5DDCC] flex items-center justify-center shrink-0 overflow-hidden">
                    {item.logoUrl ? (
                      <img src={item.logoUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <PlatformIcon type={item.destinationType} className="w-4 h-4 text-[#71818A]" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                      <Link
                        href={`/listing/${item.id}`}
                        className="font-bold text-xs sm:text-sm text-[#102536] hover:text-[#087F78] transition truncate max-w-[200px] sm:max-w-[320px]"
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

                      <span className="text-[11px] text-[#71818A] hidden sm:inline">
                        · {item.category.name}
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs text-[#405866] line-clamp-1 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right: Real Visitor Count */}
                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center space-x-1 justify-end font-extrabold text-xs sm:text-sm text-[#087F78] font-mono">
                      <Eye className="w-3.5 h-3.5 text-[#087F78]" />
                      <span>{formatVisitCount(item.visitCount)}</span>
                    </div>
                    <div className="text-[10px] text-[#71818A] uppercase font-bold tracking-wider">
                      Real Visits
                    </div>
                  </div>

                  <Link
                    href={`/listing/${item.id}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F5F2E9] hover:bg-[#087F78] text-[#405866] hover:text-white flex items-center justify-center transition"
                    aria-label={`View listing for ${item.title}`}
                  >
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
