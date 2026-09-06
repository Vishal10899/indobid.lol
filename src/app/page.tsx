'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { DebateCard } from '@/components/DebateCard';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Avatar } from '@/components/Avatar';
import { LandingPage } from '@/components/LandingPage';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import {
  Flame,
  Plus,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
}

function MainContent() {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<'for_you' | 'trending' | 'following'>('for_you');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: 'all', name: 'All', slug: 'all' },
    { id: '1', name: 'AI & Models', slug: 'ai' },
    { id: '2', name: 'Startups', slug: 'startups' },
    { id: '3', name: 'Technology', slug: 'technology' },
    { id: '4', name: 'Business', slug: 'business' },
    { id: '5', name: 'Markets', slug: 'money' },
    { id: '6', name: 'Politics', slug: 'politics' },
    { id: '7', name: 'Society', slug: 'society' },
    { id: '8', name: 'Philosophy', slug: 'philosophy' },
    { id: '9', name: 'Culture', slug: 'culture' },
  ]);
  const [debates, setDebates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Handle URL auth/redirect parameters
  useEffect(() => {
    if (authLoading) return;

    const redirectTarget = searchParams.get('redirect');
    const authAction = searchParams.get('auth');
    const createParam = searchParams.get('create');

    if (user) {
      // If authenticated and there is a safe redirect target, navigate to it
      if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')) {
        router.replace(redirectTarget);
      } else if (createParam === 'true') {
        setIsCreateModalOpen(true);
      }
    } else {
      // If unauthenticated and auth modal is requested via query param
      if (authAction === 'signup') {
        openAuthModal('signup');
      } else if (authAction === 'login') {
        openAuthModal('login');
      }
    }
  }, [user, authLoading, searchParams, router, openAuthModal]);

  const fetchFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let sortParam = 'for_you';
      if (activeTab === 'trending') sortParam = 'trending';
      else if (activeTab === 'following') sortParam = 'following';

      const url = new URL('/api/debates', window.location.origin);
      url.searchParams.set('sort', sortParam);
      if (activeCategory !== 'all') {
        url.searchParams.set('category', activeCategory);
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setDebates(data.items || []);
      }
    } catch (e) {
      console.error('Failed to load feed:', e);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, activeCategory]);

  useEffect(() => {
    if (user) {
      fetchFeed();
    }
  }, [user, fetchFeed]);

  // 1. Initial Session Resolution Splash
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center space-y-4">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
        <div className="w-5 h-5 border-2 border-[var(--color-coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Unauthenticated Experience: Public Landing Page
  if (!user) {
    return <LandingPage />;
  }

  // 3. Authenticated Experience: Primary IndoBid Application
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      {/* Mobile Top Header */}
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        {/* Left Column: Fixed Navigation Sidebar (Desktop) */}
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        {/* Center Column: Primary Feed Stream */}
        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {/* Top Sticky Header with Feed Tabs & Category Chips */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] w-full min-w-0">
            {/* Primary Feed Tabs: For You, Trending, Following */}
            <div className="flex border-b border-[var(--border-subtle)] w-full overflow-x-auto scrollbar-none">
              {/* For You */}
              <button
                onClick={() => {
                  setActiveTab('for_you');
                  setActiveCategory('all');
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition cursor-pointer relative shrink-0 ${
                  activeTab === 'for_you'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>For You</span>
                {activeTab === 'for_you' && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--color-coral)] rounded-full" />
                )}
              </button>

              {/* Trending */}
              <button
                onClick={() => {
                  setActiveTab('trending');
                  setActiveCategory('all');
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition cursor-pointer relative shrink-0 flex items-center justify-center space-x-1 ${
                  activeTab === 'trending'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${activeTab === 'trending' ? 'text-[var(--color-coral)]' : ''}`} />
                <span>Trending</span>
                {activeTab === 'trending' && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--color-coral)] rounded-full" />
                )}
              </button>

              {/* Following */}
              <button
                onClick={() => {
                  setActiveTab('following');
                  setActiveCategory('all');
                }}
                className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center transition cursor-pointer relative shrink-0 ${
                  activeTab === 'following'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>Following</span>
                {activeTab === 'following' && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--color-coral)] rounded-full" />
                )}
              </button>
            </div>

            {/* Horizontal Category Chips (Desktop only - Mobile has clean tabs-to-feed layout) */}
            <div className="hidden sm:flex w-full min-w-0 items-center space-x-1.5 px-3 sm:px-4 py-2 overflow-x-auto scrollbar-none">
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

          {/* Quick Post Composer (Desktop only - Mobile uses bottom '+' navigation action) */}
          <div className="hidden sm:block p-3 sm:p-4 border-b border-[var(--border-subtle)] w-full min-w-0 box-border">
            <div
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2.5 sm:space-x-3 p-2.5 sm:p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] cursor-pointer transition w-full min-w-0 group shadow-xs"
            >
              <Avatar
                src={user?.avatarUrl}
                name={user?.displayName || user?.username}
                username={user?.username}
                size="sm"
              />
              <div className="flex-1 min-w-0 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] font-medium truncate">
                State your opinion with conviction...
              </div>
              <button className="px-3 py-1.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow-xs transition shrink-0 flex items-center space-x-1 cursor-pointer active:scale-[0.98]">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Post Opinion</span>
              </button>
            </div>
          </div>

          {/* Feed List Content */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Loading opinions...</p>
              </div>
            ) : debates.length > 0 ? (
              debates.map((debate) => <DebateCard key={debate.id} {...debate} />)
            ) : (
              <div className="py-12 sm:py-24 text-center space-y-3 sm:space-y-4 p-6 sm:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {activeTab === 'following'
                      ? 'No opinions from people you follow'
                      : 'No conversations yet'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                    {activeTab === 'following'
                      ? 'Follow active debaters or explore the latest opinions on IndoBid.'
                      : 'Be the first to publish an opinion with conviction.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow-xs transition cursor-pointer inline-flex items-center space-x-1.5 active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Start Conversation</span>
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Fixed Trending Sidebar (Desktop) */}
        <RightSidebar />
      </div>

      {/* Mobile Floating Bottom Nav */}
      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />

      {/* Create Debate Modal */}
      <CreateDebateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => fetchFeed()}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center space-y-4">
          <div className="animate-pulse">
            <Logo size="lg" />
          </div>
          <div className="w-5 h-5 border-2 border-[var(--color-coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MainContent />
    </Suspense>
  );
}
