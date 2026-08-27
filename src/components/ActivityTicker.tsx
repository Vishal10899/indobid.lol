'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, TrendingUp, Users } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (e) {
      console.error('Failed to load activity feed:', e);
    } finally {
      setLoading(false);
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
    const visitorInterval = setInterval(fetchVisitorStats, 30000);
    return () => {
      clearInterval(activityInterval);
      clearInterval(visitorInterval);
    };
  }, []);

  const displayItems = activities.length > 0 ? [...activities, ...activities] : [];

  return (
    <div id="activity" className="w-full bg-[var(--bg-card)] border-y border-[var(--border-color)] overflow-hidden py-2 relative shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 shrink-0 z-10 bg-[var(--bg-card)] pr-3 border-r border-[var(--border-color)]">
          <div className="flex items-center space-x-1 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1" />
            <span>Live Activity</span>
          </div>

          <div className="flex items-center space-x-1 text-[11px] font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border-color)]">
            <Users className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>{visitorStats.liveVisitors} LIVE</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span>{visitorStats.totalVisits.toLocaleString()} VISITS</span>
          </div>
        </div>

        <div className="overflow-hidden whitespace-nowrap w-full ml-3 flex items-center">
          {activities.length === 0 ? (
            <span className="text-xs text-[var(--text-muted)] italic">
              No recent activity yet.
            </span>
          ) : (
            <div className="inline-flex space-x-6 animate-ticker items-center">
              {displayItems.map((item, idx) => {
                const isRankOne = item.rank === 1 || item.type === 'took_first';
                return (
                  <Link
                    key={`${item.id}-${idx}`}
                    href={`/listing/${item.listingId}`}
                    className="inline-flex items-center space-x-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition duration-150 group"
                  >
                    <span
                      className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        isRankOne
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)]'
                      }`}
                    >
                      {isRankOne ? <Trophy className="w-2.5 h-2.5 mr-0.5 text-amber-500" /> : <TrendingUp className="w-2.5 h-2.5 mr-0.5 text-emerald-500" />}
                      #{item.rank}
                    </span>

                    <span className="flex items-center space-x-1 text-[var(--text-primary)] group-hover:text-amber-500">
                      <PlatformIcon type={item.destinationType} className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="font-medium">{item.title}</span>
                    </span>

                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ${(item.amount / 100).toLocaleString()}
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
