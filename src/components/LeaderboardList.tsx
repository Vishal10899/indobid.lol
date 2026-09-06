'use client';

import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, PlusCircle, Building2 } from 'lucide-react';
import { LeaderboardCard, LeaderboardItemData } from './LeaderboardCard';

interface LeaderboardListProps {
  items: LeaderboardItemData[];
  page: number;
  totalPages: number;
  totalItems: number;
  loading: boolean;
  onPageChange: (newPage: number) => void;
  onOutbid?: (item: LeaderboardItemData) => void;
  categoryName?: string;
  onOpenSubmit?: () => void;
}

export function LeaderboardList({
  items,
  page,
  totalPages,
  totalItems,
  loading,
  onPageChange,
  onOutbid,
  categoryName,
  onOpenSubmit,
}: LeaderboardListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.canonicalUrl.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.categoryName.toLowerCase().includes(q)
    );
  });

  return (
    <div id="leaderboard" className="w-full space-y-3 pt-1">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/[0.08]">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-bodoni text-[var(--text-primary)] flex items-center space-x-2">
            <span>{categoryName ? `${categoryName} Leaderboard` : 'Global Conviction Leaderboard'}</span>
            <span className="text-xs font-semibold text-[var(--color-coral)] bg-[var(--color-coral)]/10 px-2 py-0.5 rounded-full border border-[var(--color-coral)]/25">
              {totalItems} {totalItems === 1 ? 'opinion' : 'opinions'}
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
            Highest verified conviction first · Earliest timestamp breaks ties.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opinions, debaters..."
            className="w-full bg-[var(--bg-page-deep)]/80 border border-white/[0.09] focus:border-[var(--color-coral)]/80 focus:ring-1 focus:ring-[var(--color-coral)]/20 rounded-xl py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition shadow-2xs font-medium"
          />
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-[var(--bg-surface)] border border-white/[0.08] animate-pulse"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="py-10 text-center glass-panel rounded-2xl border border-white/[0.08] p-6 space-y-2.5 shadow-xs">
          <Building2 className="w-9 h-9 text-[var(--color-coral)] opacity-60 mx-auto" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {searchQuery ? `No listings matching "${searchQuery}"` : 'No opinions in this topic yet.'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            {searchQuery ? 'Try a different search keyword.' : 'Be the first to share an opinion backed by conviction.'}
          </p>
          {onOpenSubmit && !searchQuery && (
            <button
              onClick={onOpenSubmit}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#07171C] font-semibold rounded-xl text-xs transition cursor-pointer shadow-md shadow-[var(--color-coral)]/15 mt-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Share Opinion</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <LeaderboardCard key={item.id} item={item} onCustomOutbid={onOutbid} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] disabled:opacity-40 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Page <strong className="text-[var(--text-primary)] font-bold">{page}</strong> of <strong className="text-[var(--text-primary)] font-bold">{totalPages}</strong>
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] disabled:opacity-40 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
