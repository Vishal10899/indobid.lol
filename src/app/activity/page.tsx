'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Activity, Flame, Coins, ArrowRight, RefreshCw } from 'lucide-react';

interface ActivityItem {
  id: string;
  debateId: string;
  type: string;
  title: string;
  authorUsername: string;
  authorDisplayName: string;
  amount: number;
  formattedAmount: string;
  message: string;
  categoryName: string;
  createdAt: string;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (e) {
      console.error('Failed to load activity:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] p-3.5 sm:p-4 space-y-1 w-full min-w-0">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[var(--color-coral)]" />
              <h1 className="text-lg font-black text-[var(--text-primary)]">Live Conviction Stream</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Verified debates and continuations backed by skin in the game.
            </p>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Streaming real-time activity...</p>
              </div>
            ) : activities.length > 0 ? (
              activities.map((item) => {
                const isNew = item.type === 'new_debate';
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 hover:bg-[var(--bg-card)]/40 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isNew
                            ? 'bg-[var(--color-coral)] text-[#071B21]'
                            : 'bg-[var(--bg-surface)] text-[var(--color-amber)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        {isNew ? <Flame className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <Link
                            href={`/profile/${item.authorUsername}`}
                            className="font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition"
                          >
                            @{item.authorUsername}
                          </Link>
                          <span className="text-[var(--text-muted)]">
                            {isNew ? 'started opinion with' : 'backed opinion with'}
                          </span>
                          <span className="font-mono font-bold text-[var(--color-amber)]">
                            {item.formattedAmount}
                          </span>
                        </div>

                        <Link
                          href={`/debate/${item.debateId}`}
                          className="block text-xs sm:text-sm font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition line-clamp-1"
                        >
                          &ldquo;{item.title}&rdquo;
                        </Link>

                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/debate/${item.debateId}`}
                      className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] hover:text-[var(--color-coral)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold transition flex items-center space-x-1 shrink-0"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                );
              })
            ) : (
              <div className="py-24 text-center space-y-3 p-8">
                <Activity className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">No activity yet</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Be the first to post an opinion on IndoBid.
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
