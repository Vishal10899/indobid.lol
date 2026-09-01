'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, ArrowUpRight } from 'lucide-react';

interface ActivityItem {
  id: string;
  debateId: string;
  type: string;
  title: string;
  authorUsername: string;
  formattedAmount: string;
  message: string;
  categoryName: string;
  createdAt: string;
}

export function ActivityTicker() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (e) {
        console.error('Failed to load activity ticker:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading || activities.length === 0) {
    return null;
  }

  // Duplicate list for infinite loop animation
  const loopItems = [...activities, ...activities];

  return (
    <div className="w-full bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] overflow-hidden py-1.5 px-3 min-w-0">
      <div className="max-w-7xl mx-auto flex items-center min-w-0">
        <div className="flex items-center space-x-1 px-2 text-[10px] sm:text-[11px] font-bold text-[var(--color-coral)] uppercase tracking-wider shrink-0 bg-[var(--bg-page-deep)] rounded-lg py-0.5 border border-[var(--border-subtle)] mr-2">
          <Flame className="w-3 h-3 text-[var(--color-coral)]" />
          <span>Live Activity</span>
        </div>

        <div className="overflow-hidden relative w-full flex-1 min-w-0">
          <div className="flex whitespace-nowrap animate-ticker items-center space-x-6 text-xs text-[var(--text-secondary)]">
            {loopItems.map((item, index) => (
              <Link
                key={`${item.id}-${index}`}
                href={`/debate/${item.debateId}`}
                className="inline-flex items-center space-x-1.5 hover:text-[var(--text-primary)] transition shrink-0"
              >
                <span className="font-bold text-[var(--color-amber)] font-mono">{item.formattedAmount}</span>
                <span className="text-[var(--text-primary)] font-medium">@{item.authorUsername}</span>
                <span className="text-[var(--text-muted)]">
                  {item.type === 'new_debate' ? 'started' : 'continued'}
                </span>
                <span className="truncate max-w-[140px] sm:max-w-[280px] text-[var(--text-secondary)]">
                  &ldquo;{item.title}&rdquo;
                </span>
                <ArrowUpRight className="w-3 h-3 text-[var(--color-coral)]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityTicker;
