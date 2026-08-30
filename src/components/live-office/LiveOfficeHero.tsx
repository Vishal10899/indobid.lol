'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LeaderboardItemData } from '@/components/LeaderboardCard';
import { Building2, Users, Eye, PlusCircle, List } from 'lucide-react';

// Lazy load LiveOfficeScene with client-only rendering
const LiveOfficeScene = dynamic(
  () => import('./LiveOfficeScene').then((mod) => mod.LiveOfficeScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] sm:h-[460px] md:h-[520px] lg:h-[560px] rounded-2xl bg-[#FBF9F3] border border-[#E5DDCC] flex flex-col items-center justify-center space-y-2.5 animate-pulse">
        <div className="w-10 h-10 rounded-xl bg-[#DDF2EF] border border-[#B9DFDA] flex items-center justify-center text-[#087F78]">
          <Building2 className="w-5 h-5 animate-bounce text-[#087F78]" />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[#102536]">
          Loading Live Office City...
        </p>
        <p className="text-[11px] text-[#71818A]">
          Rendering architectural startup buildings & verified bids
        </p>
      </div>
    ),
  }
);

interface LiveOfficeHeroProps {
  items: LeaderboardItemData[];
  totalListings: number;
  highestBidCents: number;
  minimumToTakeFirstCents: number;
  viewMode: '3d' | 'list';
  onToggleViewMode: (mode: '3d' | 'list') => void;
  onOpenBidModal: (data?: {
    url?: string;
    targetBidDollars?: number;
    categoryId?: string;
    existingListingId?: string;
  }) => void;
  onOutbid?: (item: LeaderboardItemData) => void;
}

export function LiveOfficeHero({
  items,
  totalListings,
  highestBidCents,
  minimumToTakeFirstCents,
  viewMode,
  onToggleViewMode,
  onOpenBidModal,
  onOutbid,
}: LiveOfficeHeroProps) {
  const [visitorStats, setVisitorStats] = useState<{ liveVisitors: number; totalVisits: number }>({
    liveVisitors: 0,
    totalVisits: 0,
  });

  // Fetch REAL visitor statistics from existing /api/analytics/stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/analytics/stats');
        if (res.ok) {
          const data = await res.json();
          setVisitorStats({
            liveVisitors: typeof data.liveVisitors === 'number' ? data.liveVisitors : 0,
            totalVisits: typeof data.totalVisits === 'number' ? data.totalVisits : 0,
          });
        }
      } catch (err) {
        console.error('Failed to load visitor statistics:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 20000);
    return () => clearInterval(interval);
  }, []);

  const minToTakeFirstDollars = Math.ceil(minimumToTakeFirstCents / 100) || 2;
  const topListing = items.find((i) => i.rank === 1);

  return (
    <section id="live-office" className="w-full pt-4 pb-2 sm:pt-6 sm:pb-3 bg-[#F8F6EF]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-3 sm:space-y-4">
        {/* Compact Hero Header & Live Counters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#DDF2EF] border border-[#B9DFDA] text-[#087F78] text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#087F78] animate-pulse" />
                <span>LIVE OFFICE CITY</span>
              </span>
              <span className="text-[11px] text-[#405866] hidden sm:inline font-medium">
                Top of the Internet in real-time
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#102536] leading-tight">
              Pay more. Rank higher.{' '}
              <span className="text-[#DE8063]">Get seen.</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#405866] max-w-xl line-clamp-1 sm:line-clamp-none">
              Your startup owns a building in the startup city. Cumulative verified bids determine height and rank.
            </p>
          </div>

          {/* Real Analytics Badges & Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Live Visitors Pill */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E5DDCC] text-xs font-bold text-[#102536] shadow-2xs">
              <Users className="w-3.5 h-3.5 text-[#087F78]" />
              <span className="font-extrabold text-[#087F78] font-mono">{visitorStats.liveVisitors}</span>
              <span className="text-[10px] text-[#71818A] uppercase font-semibold">LIVE</span>
            </div>

            {/* Total Visits Pill */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E5DDCC] text-xs font-bold text-[#102536] shadow-2xs">
              <Eye className="w-3.5 h-3.5 text-[#087F78]" />
              <span className="font-extrabold font-mono text-[#102536]">{visitorStats.totalVisits.toLocaleString()}</span>
              <span className="text-[10px] text-[#71818A] uppercase font-semibold">VISITS</span>
            </div>

            {/* Claim Spot CTA */}
            <button
              onClick={() => onOpenBidModal({ targetBidDollars: minToTakeFirstDollars })}
              className="px-4 py-2 bg-[#DE8063] hover:bg-[#CF6F55] text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all duration-150 flex items-center space-x-1.5 cursor-pointer active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>Claim Spot (₹{minToTakeFirstDollars})</span>
            </button>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="flex items-center justify-between pt-1">
          <div className="inline-flex items-center p-0.5 rounded-xl bg-[#F5F2E9] border border-[#E5DDCC]">
            <button
              onClick={() => onToggleViewMode('3d')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-white text-[#102536] shadow-2xs border border-[#E5DDCC]'
                  : 'text-[#405866] hover:text-[#102536]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#087F78]" />
              <span>3D City View</span>
            </button>

            <button
              onClick={() => onToggleViewMode('list')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#102536] shadow-2xs border border-[#E5DDCC]'
                  : 'text-[#405866] hover:text-[#102536]'
              }`}
            >
              <List className="w-3.5 h-3.5 text-[#DE8063]" />
              <span>List View</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-[#405866]">
            <span className="font-semibold text-[#102536]">#1 Center Tower:</span>
            {topListing ? (
              <>
                <span className="font-bold text-[#DE8063] truncate max-w-[140px] md:max-w-[200px]">
                  {topListing.title}
                </span>
                <span className="font-mono text-[#087F78] font-bold">
                  (₹{ (topListing.verifiedBid / 100).toLocaleString()})
                </span>
              </>
            ) : (
              <span className="font-bold text-[#DE8063]">
                indobid.lol (Landmark · Available)
              </span>
            )}
          </div>
        </div>

        {/* 3D Scene Viewport */}
        {viewMode === '3d' && (
          <LiveOfficeScene
            items={items}
            onOutbid={onOutbid}
            onOpenSubmit={(data) => onOpenBidModal(data || { targetBidDollars: minToTakeFirstDollars })}
          />
        )}
      </div>
    </section>
  );
}
