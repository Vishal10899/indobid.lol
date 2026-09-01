'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { DebateCard } from '@/components/DebateCard';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Search, Flame, Sparkles, TrendingUp, RefreshCw, Compass } from 'lucide-react';

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialSearch = searchParams.get('search') || searchParams.get('q') || '';

  const [debates, setDebates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState<'trending' | 'rising' | 'newest' | 'top'>('trending');
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

  const fetchExplore = useCallback(async () => {
    setLoading(true);
    try {
      const q = encodeURIComponent(search.trim());
      const cat = encodeURIComponent(category);
      const res = await fetch(`/api/debates?sort=${sort}&category=${cat}&search=${q}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setDebates(data.items || []);
      }
    } catch (e) {
      console.error('Error fetching explore debates:', e);
    } finally {
      setLoading(false);
    }
  }, [category, sort, search]);

  useEffect(() => {
    fetchExplore();
  }, [fetchExplore]);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {/* Header & Search Bar */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] p-3.5 sm:p-4 space-y-3 w-full min-w-0">
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-[var(--color-coral)]" />
              <h1 className="text-lg font-black text-[var(--text-primary)]">Explore & Discover</h1>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search opinions, #hashtags, debaters..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-medium"
              />
            </div>

            {/* Sort Tabs */}
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pt-0.5">
              {[
                { id: 'trending', label: 'Trending' },
                { id: 'rising', label: 'Rising' },
                { id: 'newest', label: 'Newest' },
                { id: 'top', label: 'Top Backed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSort(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    sort === tab.id
                      ? 'bg-[var(--color-coral)] text-[#071B21]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setCategory(cat.slug)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    category === cat.slug
                      ? 'bg-[var(--bg-surface)] text-[var(--color-coral)] border border-[var(--border-color)] font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results Feed */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="py-24 text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Searching active debates...</p>
              </div>
            ) : debates.length > 0 ? (
              debates.map((d) => <DebateCard key={d.id} {...d} />)
            ) : (
              <div className="py-24 text-center space-y-3 p-8">
                <Search className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">No debates found</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Try searching for different keywords or explore other topics.
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

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)]" />}>
      <ExploreContent />
    </Suspense>
  );
}
