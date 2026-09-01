'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { DebateCard } from '@/components/DebateCard';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Flame, Zap, Sparkles, Trophy, RefreshCw, MessageSquare } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface DebateItem {
  id: string;
  title: string;
  content: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  };
  authorUsername: string;
  authorDisplayName: string;
  originalContribution: number;
  totalVerifiedContribution: number;
  contributionCount: number;
  lastContributionAmount: number;
  minimumNextContribution: number;
  trendingScore: number;
  likeCount?: number;
  impressionCount?: number;
  createdAt: string;
}

export default function TrendingPage() {
  const [activeSection, setActiveSection] = useState<'trending' | 'rising' | 'new' | 'top'>('trending');
  const [trendingNow, setTrendingNow] = useState<DebateItem[]>([]);
  const [rising, setRising] = useState<DebateItem[]>([]);
  const [newDebates, setNewDebates] = useState<DebateItem[]>([]);
  const [topDebates, setTopDebates] = useState<DebateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/trending');
        if (res.ok) {
          const data = await res.json();
          setTrendingNow(data.trendingNow || []);
          setRising(data.rising || []);
          setNewDebates(data.newDebates || []);
          setTopDebates(data.topDebates || []);
        }
      } catch (e) {
        console.error('Failed to load trending data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  const getActiveList = () => {
    switch (activeSection) {
      case 'trending':
        return trendingNow;
      case 'rising':
        return rising;
      case 'new':
        return newDebates;
      case 'top':
        return topDebates;
    }
  };

  const currentList = getActiveList();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] w-full overflow-x-hidden">
      <div className="lg:hidden w-full">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] p-3.5 sm:p-4 space-y-3 w-full min-w-0">
            <div className="flex items-center space-x-2">
              <Flame className="w-5 h-5 text-[var(--color-coral)]" />
              <h1 className="text-lg font-black text-[var(--text-primary)]">Trending Opinions</h1>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: 'trending', label: 'Trending', count: trendingNow.length },
                { id: 'rising', label: 'Rising', count: rising.length },
                { id: 'new', label: 'Newest', count: newDebates.length },
                { id: 'top', label: 'Top Backed', count: topDebates.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    activeSection === tab.id
                      ? 'bg-[var(--color-coral)] text-[#071B21]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && <span className="ml-1.5 text-[10px] opacity-75 font-mono">({tab.count})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Leaderboard Feed */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Computing financial momentum...</p>
              </div>
            ) : currentList.length > 0 ? (
              currentList.map((item, index) => (
                <div key={item.id} className="relative">
                  {/* Subtle Rank Indicator Badge */}
                  <div className="absolute top-4 left-3 z-10 w-5 h-5 rounded-md bg-[var(--bg-page-deep)] text-[var(--text-muted)] font-mono font-bold text-[10px] flex items-center justify-center border border-[var(--border-subtle)]">
                    {index + 1}
                  </div>
                  <div className="pl-6">
                    <DebateCard {...item} />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center space-y-3 p-8">
                <Flame className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">No trending debates yet</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Start the conversation and put money behind your opinion.
                </p>
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>

      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />
      <CreateDebateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
