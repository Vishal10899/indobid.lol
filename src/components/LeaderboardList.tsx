'use client';

import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
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
    <div id="leaderboard" className="w-full space-y-3">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-color)]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] flex items-center space-x-2">
            <span>{categoryName ? `${categoryName} Leaderboard` : 'Global Leaderboard'}</span>
            <span className="text-xs font-normal text-[var(--text-secondary)]">
              ({totalItems} {totalItems === 1 ? 'listing' : 'listings'})
            </span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Highest verified bid first · Earliest timestamp breaks ties.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search listings..."
            className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-amber-500 rounded-lg py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition shadow-2xs"
          />
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] animate-pulse"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        /* Clean Production Empty State */
        <div className="py-12 text-center bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 space-y-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {searchQuery ? `No listings matching "${searchQuery}"` : 'No listings yet.'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            {searchQuery ? 'Try a different search keyword.' : 'Be the first to claim a position.'}
          </p>
          {onOpenSubmit && !searchQuery && (
            <button
              onClick={onOpenSubmit}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer shadow-2xs mt-2"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Submit & Rank</span>
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
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] disabled:opacity-40 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <span className="text-xs text-[var(--text-secondary)] font-medium">
            Page <strong className="text-[var(--text-primary)]">{page}</strong> of <strong className="text-[var(--text-primary)]">{totalPages}</strong>
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] disabled:opacity-40 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
