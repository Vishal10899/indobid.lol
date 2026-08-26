'use client';

import React from 'react';
import { Layers, Bot, Rocket, Cloud, Code, Sparkles, Share2, Megaphone, DollarSign, ShoppingCart, Palette, Gamepad2, Heart, GraduationCap, Tv, User, Globe } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  count: number;
}

interface CategoryNavProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
  totalListings: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  ai: <Bot className="w-3.5 h-3.5" />,
  startups: <Rocket className="w-3.5 h-3.5" />,
  saas: <Cloud className="w-3.5 h-3.5" />,
  'developer-tools': <Code className="w-3.5 h-3.5" />,
  creators: <Sparkles className="w-3.5 h-3.5" />,
  'social-media': <Share2 className="w-3.5 h-3.5" />,
  marketing: <Megaphone className="w-3.5 h-3.5" />,
  finance: <DollarSign className="w-3.5 h-3.5" />,
  ecommerce: <ShoppingCart className="w-3.5 h-3.5" />,
  design: <Palette className="w-3.5 h-3.5" />,
  gaming: <Gamepad2 className="w-3.5 h-3.5" />,
  health: <Heart className="w-3.5 h-3.5" />,
  education: <GraduationCap className="w-3.5 h-3.5" />,
  media: <Tv className="w-3.5 h-3.5" />,
  'personal-brand': <User className="w-3.5 h-3.5" />,
  other: <Globe className="w-3.5 h-3.5" />,
};

export function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
  totalListings,
}: CategoryNavProps) {
  return (
    <div className="w-full overflow-x-auto py-1 scrollbar-none">
      <div className="flex items-center space-x-1.5 min-w-max pb-1">
        {/* All Categories Button */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-[var(--text-primary)] text-[var(--bg-card)] font-semibold shadow-2xs'
              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-color)]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            {totalListings}
          </span>
        </button>

        {/* Individual Category Buttons */}
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.slug;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.slug)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isSelected
                  ? 'bg-[var(--text-primary)] text-[var(--bg-card)] font-semibold shadow-2xs'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-color)]'
              }`}
            >
              {ICON_MAP[cat.slug] || <Globe className="w-3.5 h-3.5" />}
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
