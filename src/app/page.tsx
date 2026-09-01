'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { DebateCard } from '@/components/DebateCard';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { Flame, RefreshCw, MessageSquare, Plus } from 'lucide-react';

export default function HomePage() {
  const { user, openAuthModal } = useAuth();
  const [debates, setDebates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('for_you');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const categories = [
    { name: 'All Topics', slug: 'all' },
    { name: 'AI', slug: 'ai' },
    { name: 'Startups', slug: 'startups' },
    { name: 'Technology', slug: 'technology' },
    { name: 'Business', slug: 'business' },
    { name: 'Money', slug: 'money' },
    { name: 'Society', slug: 'society' },
    { name: 'Politics', slug: 'politics' },
    { name: 'Culture', slug: 'culture' },
  ];

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      let sortParam = activeTab;
      let catParam = activeCategory;

      if (activeTab === 'following') {
        sortParam = 'following';
      }

      const res = await fetch(`/api/debates?sort=${sortParam}&category=${catParam}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setDebates(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load debates feed:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCategory]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] w-full overflow-x-hidden">
      {/* Mobile Top Navbar */}
      <div className="lg:hidden w-full">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0">
        {/* Left Column: Navigation Sidebar (Desktop) */}
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        {/* Center Column: Social Feed */}
        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] w-full min-w-0">
            {/* Feed Tabs */}
            <div className="flex border-b border-[var(--border-subtle)] w-full">
              <button
                onClick={() => {
                  setActiveTab('for_you');
                  setActiveCategory('all');
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition cursor-pointer relative ${
                  activeTab === 'for_you'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>For You</span>
                {activeTab === 'for_you' && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                )}
              </button>

              <button
                onClick={() => {
                  if (!user) {
                    openAuthModal('login');
                  } else {
                    setActiveTab('following');
                  }
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition cursor-pointer relative ${
                  activeTab === 'following'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>Following</span>
                {activeTab === 'following' && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('trending');
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition cursor-pointer relative ${
                  activeTab === 'trending'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="flex items-center justify-center space-x-1">
                  <Flame className="w-3.5 h-3.5 text-[var(--color-coral)]" />
                  <span>Trending</span>
                </span>
                {activeTab === 'trending' && (
                  <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                )}
              </button>
            </div>

            {/* Horizontal Category Pills */}
            <div className="w-full min-w-0 flex items-center space-x-1.5 px-3 sm:px-4 py-2 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer shrink-0 ${
                    activeCategory === cat.slug
                      ? 'bg-[var(--bg-surface)] text-[var(--color-coral)] border border-[var(--border-color)] font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Social Post Composer Teaser */}
          <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)] w-full min-w-0 box-border">
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] cursor-pointer transition w-full min-w-0"
            >
              <Avatar
                src={user?.avatarUrl}
                name={user?.displayName || user?.username}
                username={user?.username}
                size="sm"
              />
              <div className="flex-1 min-w-0 text-xs text-[var(--text-muted)] font-medium truncate">
                What’s on your mind? Share your opinion...
              </div>
              <button className="px-3 py-1.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow-sm transition shrink-0 flex items-center space-x-1 cursor-pointer">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Post</span>
              </button>
            </div>
          </div>

          {/* Feed Content */}
          <div className="divide-y divide-[var(--border-subtle)] w-full min-w-0">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Loading opinions...</p>
              </div>
            ) : debates.length > 0 ? (
              debates.map((debate) => <DebateCard key={debate.id} {...debate} />)
            ) : (
              <div className="py-24 text-center space-y-3 p-6 sm:p-8">
                <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {activeTab === 'following'
                    ? 'No debates from people you follow yet'
                    : 'Be the first opinion on IndoBid.'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  {activeTab === 'following'
                    ? 'Follow more debaters to curate your feed.'
                    : 'Post your opinion with ₹10 conviction and let the community respond.'}
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-2 px-4 py-2 bg-[var(--color-coral)] text-[#071B21] font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Post Opinion · ₹10
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Discovery Sidebar (Desktop) */}
        <RightSidebar />
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />

      {/* Create Debate Modal */}
      <CreateDebateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          fetchFeed();
        }}
      />
    </div>
  );
}
