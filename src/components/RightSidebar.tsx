'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Flame, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface ActivityItem {
  id: string;
  debateId: string;
  type: string;
  title: string;
  authorUsername: string;
  formattedAmount: string;
  createdAt: string;
}

export function RightSidebar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity');
        if (res.ok) {
          const data = await res.json();
          setActivities((data.activities || []).slice(0, 4));
        }
      } catch {}
    };
    fetchActivity();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const trendingTopics = [
    { name: 'AI & Models', slug: 'ai' },
    { name: 'Startups', slug: 'startups' },
    { name: 'Markets', slug: 'money' },
    { name: 'Tech', slug: 'technology' },
    { name: 'Society', slug: 'society' },
    { name: 'Business', slug: 'business' },
    { name: 'Culture', slug: 'culture' },
  ];

  return (
    <aside className="hidden xl:flex flex-col w-80 h-screen sticky top-0 py-6 px-4 border-l border-[var(--border-subtle)] bg-[var(--bg-page)] shrink-0 space-y-6 overflow-y-auto scrollbar-none select-none">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search opinions, #topics, users..."
          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-medium"
        />
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
      </form>

      {/* HOW INDO BID WORKS (Editorial Guide) */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3">
        <div className="flex items-center space-x-1.5 text-[11px] font-black text-[var(--color-coral)] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>How IndoBid Works</span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-start justify-between">
            <span className="font-bold text-[var(--text-primary)]">READ</span>
            <span className="text-[var(--text-secondary)]">Free forever</span>
          </div>
          <div className="flex items-start justify-between">
            <span className="font-bold text-[var(--text-primary)]">POST OPINION</span>
            <span className="font-bold text-emerald-500 font-mono text-[11px]">100% Free</span>
          </div>
          <div className="flex items-start justify-between">
            <span className="font-bold text-[var(--text-primary)]">BACK CONVICTION</span>
            <span className="font-mono font-bold text-[var(--color-amber)] text-[11px]">Optional ($10+)</span>
          </div>
          <div className="flex items-start justify-between pt-1 border-t border-[var(--border-subtle)] text-[11px]">
            <span className="font-semibold text-[var(--text-secondary)]">CONVICTION</span>
            <span className="text-[var(--text-muted)] text-right">Adds weight · Doesn't buy reach</span>
          </div>
        </div>
      </div>

      {/* Trending Topics (Understated Chips) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center space-x-1.5">
            <Flame className="w-3.5 h-3.5 text-[var(--color-coral)]" />
            <span>Trending Topics</span>
          </h3>
          <Link href="/explore" className="text-[11px] text-[var(--color-coral)] hover:underline">
            Explore
          </Link>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {trendingTopics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/explore?category=${topic.slug}`}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] transition"
            >
              #{topic.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Live Activity Stream */}
      {activities.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--color-lime)]" />
              <span>Live Conviction</span>
            </h3>
            <Link href="/activity" className="text-[11px] text-[var(--color-coral)] hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {activities.map((act) => (
              <Link
                key={act.id}
                href={`/debate/${act.debateId}`}
                className="block p-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] transition space-y-1 group"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition">
                    @{act.authorUsername}
                  </span>
                  <span className="font-mono font-bold text-[var(--color-amber)]">
                    {act.formattedAmount} backed
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                  &ldquo;{act.title}&rdquo;
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <div className="px-1 text-[11px] text-[var(--text-muted)] space-y-1.5 pt-2">
        <div className="flex flex-wrap gap-2">
          <Link href="/explore" className="hover:underline">Explore</Link>
          <span>·</span>
          <Link href="/trending" className="hover:underline">Trending</Link>
          <span>·</span>
          <Link href="/activity" className="hover:underline">Activity</Link>
        </div>
        <p>© 2026 IndoBid · Back opinions with conviction.</p>
        <p className="font-montserrat text-[10px] text-[var(--text-secondary)]">
          Built &amp; Designed by <span className="font-bold text-[var(--color-coral)]">Vishal Chaudhary</span>
        </p>
      </div>
    </aside>
  );
}
