'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { ActivityTicker } from '@/components/ActivityTicker';
import { HeroBidSection } from '@/components/HeroBidSection';
import { CategoryNav } from '@/components/CategoryNav';
import { LeaderboardList } from '@/components/LeaderboardList';
import { HowItWorks } from '@/components/HowItWorks';
import { Footer } from '@/components/Footer';
import { BidModal } from '@/components/BidModal';
import { LeaderboardItemData } from '@/components/LeaderboardCard';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  count: number;
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItemData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [highestBidCents, setHighestBidCents] = useState(0);
  const [minimumToTakeFirstCents, setMinimumToTakeFirstCents] = useState(200);
  const [loading, setLoading] = useState(true);

  // Bid Modal state
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [bidModalInitialData, setBidModalInitialData] = useState<{
    url?: string;
    targetBidDollars?: number;
    categoryId?: string;
    existingListingId?: string;
    title?: string;
    description?: string;
    logoUrl?: string;
  } | undefined>(undefined);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch leaderboard when category or page changes
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const url = `/api/leaderboard?category=${selectedCategory}&page=${page}&limit=50`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeaderboardItems(data.items || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setHighestBidCents(data.highestBidCents || 0);
        setMinimumToTakeFirstCents(data.minimumToTakeFirstCents || 200);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedCategory, page]);

  const handleOpenBidModal = (data?: {
    url?: string;
    targetBidDollars?: number;
    categoryId?: string;
    existingListingId?: string;
    title?: string;
    description?: string;
    logoUrl?: string;
  }) => {
    setBidModalInitialData(data);
    setIsBidModalOpen(true);
  };

  const handleOutbidCard = (item: LeaderboardItemData) => {
    const targetDollars = Math.ceil(item.minOutbidCents / 100);
    handleOpenBidModal({
      url: item.destinationUrl,
      targetBidDollars: targetDollars,
      categoryId: item.categoryId,
      existingListingId: item.id,
      title: item.title,
      description: item.description,
      logoUrl: item.logoUrl || undefined,
    });
  };

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setPage(1);
  };

  const currentCategoryObj = categories.find((c) => c.slug === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Top Navigation */}
      <Navbar
        onOpenBidModal={handleOpenBidModal}
        minToTakeFirstDollars={Math.ceil(minimumToTakeFirstCents / 100) || 2}
      />

      {/* Live Activity Ticker */}
      <ActivityTicker />

      {/* Hero Section with Interactive Bid Stepper */}
      <HeroBidSection
        categories={categories}
        highestBidCents={highestBidCents}
        minimumToTakeFirstCents={minimumToTakeFirstCents}
        onOpenBidModal={handleOpenBidModal}
      />

      {/* Main Leaderboard Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
        {/* Category Navigation Pills */}
        <CategoryNav
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          totalListings={categories.reduce((acc, c) => acc + c.count, 0) || totalItems}
        />

        {/* Leaderboard Cards */}
        <LeaderboardList
          items={leaderboardItems}
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={loading}
          onPageChange={setPage}
          onOutbid={handleOutbidCard}
          categoryName={currentCategoryObj?.name}
          onOpenSubmit={() => handleOpenBidModal({ targetBidDollars: 2 })}
        />
      </main>

      {/* How It Works & Transparency */}
      <HowItWorks />

      {/* Footer */}
      <Footer />

      {/* Interactive Bid Modal */}
      <BidModal
        isOpen={isBidModalOpen}
        onClose={() => setIsBidModalOpen(false)}
        categories={categories}
        initialData={bidModalInitialData}
      />
    </div>
  );
}
