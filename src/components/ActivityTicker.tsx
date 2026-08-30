'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Building2 } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';

interface ActivityItem {
  id: string;
  listingId: string;
  type: string;
  title: string;
  destinationType: string;
  amount: number;
  rank: number;
  message: string;
  createdAt: string;
}

export function ActivityTicker() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [visitorStats, setVisitorStats] = useState<{ liveVisitors: number; totalVisits: number }>({
    liveVisitors: 0,
    totalVisits: 0,
  });

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (e) {
      console.error('Failed to load activity feed:', e);
    }
  };

  const fetchVisitorStats = async () => {
    try {
      const res = await fetch('/api/analytics/stats');
      if (res.ok) {
        const data = await res.json();
        setVisitorStats({
          liveVisitors: typeof data.liveVisitors === 'number' ? data.liveVisitors : 0,
          totalVisits: typeof data.totalVisits === 'number' ? data.totalVisits : 0,
        });
      }
    } catch (e) {
      console.error('Failed to load visitor stats:', e);
    }
  };

  useEffect(() => {
    fetchActivity();
    fetchVisitorStats();
    const activityInterval = setInterval(fetchActivity, 15000);
    const visitorInterval = setInterval(fetchVisitorStats, 25000);
    return () => {
      clearInterval(activityInterval);
      clearInterval(visitorInterval);
    };
  }, []);

  const displayItems = activities.length > 0 ? [...activities, ...activities] : [];

  return (
    <div id="activity" className="w-full bg-[#F2EFE4] border-b border-[#E5DDCC] overflow-hidden py-2 relative shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Real Live Indicator */}
        <div className="flex items-center space-x-2.5 shrink-0 z-10 bg-[#F2EFE4] pr-3 border-r border-[#E5DDCC]">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#087F78] uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-[#087F78] animate-pulse" />
            <span>Live Feed</span>
          </div>

          <div className="flex items-center space-x-1 text-[11px] font-semibold text-[#405866] bg-white px-2 py-0.5 rounded-lg border border-[#E5DDCC]">
            <Users className="w-3 h-3 text-[#087F78] shrink-0" />
            <span className="text-[#087F78] font-bold">{visitorStats.liveVisitors} LIVE</span>
            <span className="text-[#71818A]">·</span>
            <span>{visitorStats.totalVisits.toLocaleString()} VISITS</span>
          </div>
        </div>

        {/* Right: Scrolling activity ticker */}
        <div className="overflow-hidden whitespace-nowrap w-full ml-3 flex items-center">
          {activities.length === 0 ? (
            <span className="text-xs text-[#71818A] italic">
              No recent activity yet. Bids appear here in real-time.
            </span>
          ) : (
            <div className="inline-flex space-x-6 animate-ticker items-center">
              {displayItems.map((item, idx) => {
                const isRankOne = item.rank === 1 || item.type === 'took_first';
                return (
                  <Link
                    key={`${item.id}-${idx}`}
                    href={`/listing/${item.listingId}`}
                    className="inline-flex items-center space-x-2 text-xs text-[#405866] hover:text-[#102536] transition duration-150 group"
                  >
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isRankOne
                          ? 'bg-[#DE8063] text-white shadow-xs'
                          : 'bg-white text-[#087F78] border border-[#E5DDCC]'
                      }`}
                    >
                      <Building2 className="w-2.5 h-2.5 mr-0.5" />
                      #{item.rank}
                    </span>

                    <span className="flex items-center space-x-1 text-[#102536] group-hover:text-[#087F78] font-semibold">
                      <PlatformIcon type={item.destinationType} className="w-3 h-3 text-[#71818A]" />
                      <span>{item.title}</span>
                    </span>

                    <span className="text-[#71818A]">·</span>
                    <span className="font-mono text-[#087F78] font-bold">
                      +₹{(item.amount / 100).toLocaleString()}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
