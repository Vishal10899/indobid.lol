'use client';

import React from 'react';
import {
  Layers,
  Bot,
  Rocket,
  Cloud,
  Code,
  Sparkles,
  Share2,
  Megaphone,
  DollarSign,
  ShoppingCart,
  Store,
  Briefcase,
  ShoppingBag,
  Building,
  CheckCircle2,
  UserCheck,
  ShieldCheck,
  Coins,
  Gamepad2,
  Tv,
  Film,
  PackageCheck,
  Utensils,
  Plane,
  Truck,
  Car,
  Leaf,
  Sun,
  Building2,
  Shield,
  Scale,
  UserPlus,
  Cpu,
  HardDrive,
  Dna,
  Sprout,
  Globe,
} from 'lucide-react';

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
  saas: <Cloud className="w-3.5 h-3.5" />,
  startups: <Rocket className="w-3.5 h-3.5" />,
  startup: <Rocket className="w-3.5 h-3.5" />,
  fintech: <DollarSign className="w-3.5 h-3.5" />,
  'developer-tools': <Code className="w-3.5 h-3.5" />,
  healthtech: <CheckCircle2 className="w-3.5 h-3.5" />,
  edtech: <Building className="w-3.5 h-3.5" />,
  ecommerce: <ShoppingCart className="w-3.5 h-3.5" />,
  marketplace: <Store className="w-3.5 h-3.5" />,
  b2b: <Briefcase className="w-3.5 h-3.5" />,
  b2c: <ShoppingBag className="w-3.5 h-3.5" />,
  enterprise: <Building className="w-3.5 h-3.5" />,
  productivity: <CheckCircle2 className="w-3.5 h-3.5" />,
  marketing: <Megaphone className="w-3.5 h-3.5" />,
  social: <Share2 className="w-3.5 h-3.5" />,
  consumer: <UserCheck className="w-3.5 h-3.5" />,
  cybersecurity: <ShieldCheck className="w-3.5 h-3.5" />,
  'web3-crypto': <Coins className="w-3.5 h-3.5" />,
  gaming: <Gamepad2 className="w-3.5 h-3.5" />,
  'creator-economy': <Sparkles className="w-3.5 h-3.5" />,
  creators: <Sparkles className="w-3.5 h-3.5" />,
  media: <Tv className="w-3.5 h-3.5" />,
  entertainment: <Film className="w-3.5 h-3.5" />,
  d2c: <PackageCheck className="w-3.5 h-3.5" />,
  foodtech: <Utensils className="w-3.5 h-3.5" />,
  travel: <Plane className="w-3.5 h-3.5" />,
  logistics: <Truck className="w-3.5 h-3.5" />,
  mobility: <Car className="w-3.5 h-3.5" />,
  climatetech: <Leaf className="w-3.5 h-3.5" />,
  cleantech: <Sun className="w-3.5 h-3.5" />,
  proptech: <Building2 className="w-3.5 h-3.5" />,
  insurtech: <Shield className="w-3.5 h-3.5" />,
  legaltech: <Scale className="w-3.5 h-3.5" />,
  hrtech: <UserPlus className="w-3.5 h-3.5" />,
  deeptech: <Cpu className="w-3.5 h-3.5" />,
  hardware: <HardDrive className="w-3.5 h-3.5" />,
  robotics: <Bot className="w-3.5 h-3.5" />,
  biotech: <Dna className="w-3.5 h-3.5" />,
  agritech: <Sprout className="w-3.5 h-3.5" />,
  other: <Globe className="w-3.5 h-3.5" />,
};

export function CategoryNav({
  categories,
  selectedCategory,
  onSelectCategory,
  totalListings,
}: CategoryNavProps) {
  return (
    <div className="w-full overflow-x-auto py-2 scrollbar-none">
      <div className="flex items-center space-x-2 min-w-max pb-1">
        {/* All Categories Button */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-[#087F78] text-white shadow-xs border border-[#087F78]'
              : 'bg-white text-[#405866] hover:text-[#102536] hover:bg-[#F5F2E9] border border-[#E5DDCC]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Sectors</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedCategory === 'all'
                ? 'bg-[#DDF2EF] text-[#087F78]'
                : 'bg-[#EEE9DD] text-[#405866]'
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
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isSelected
                  ? 'bg-[#087F78] text-white shadow-xs border border-[#087F78]'
                  : 'bg-white text-[#405866] hover:text-[#102536] hover:bg-[#F5F2E9] border border-[#E5DDCC]'
              }`}
            >
              {ICON_MAP[cat.slug] || <Globe className="w-3.5 h-3.5" />}
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected
                    ? 'bg-[#DDF2EF] text-[#087F78]'
                    : 'bg-[#EEE9DD] text-[#405866]'
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
