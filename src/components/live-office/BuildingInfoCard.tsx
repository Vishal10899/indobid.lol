'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy, ExternalLink, ArrowRight, X, TrendingUp, MousePointerClick } from 'lucide-react';
import { LeaderboardItemData } from '@/components/LeaderboardCard';
import { PlatformIcon } from '@/components/PlatformIcon';
import { getCountryFlag, getCountryName } from '@/lib/countries';

interface BuildingInfoCardProps {
  item: LeaderboardItemData | null;
  onClose: () => void;
  onOutbid?: (item: LeaderboardItemData) => void;
}

export function BuildingInfoCard({ item, onClose, onOutbid }: BuildingInfoCardProps) {
  if (!item) return null;

  const isFirst = item.rank === 1;
  const dollars = item.verifiedBid / 100;

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 z-30 bg-white/96 backdrop-blur-md border border-[#E5DDCC] rounded-2xl p-4 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Header with Rank & Close button */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E5DDCC]">
        <div className="flex items-center space-x-2">
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 ${
              isFirst
                ? 'bg-[#DE8063] text-white shadow-xs'
                : 'bg-[#DDF2EF] text-[#087F78] border border-[#B9DFDA]'
            }`}
          >
            {isFirst && <Trophy className="w-3.5 h-3.5 mr-0.5 text-white" />}
            <span>Rank #{item.rank}</span>
          </div>
          <span className="text-xs text-[#71818A] font-medium">
            in {item.categoryName}
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-[#F5F2E9] text-[#71818A] hover:text-[#102536] flex items-center justify-center transition cursor-pointer"
          aria-label="Close building details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Info */}
      <div className="py-3 flex items-start space-x-3">
        {/* Logo / Platform Icon */}
        <Link href={`/listing/${item.id}`} className="shrink-0 group">
          {item.logoUrl ? (
            <img
              src={item.logoUrl}
              alt={item.title}
              className="w-12 h-12 rounded-xl object-cover border border-[#E5DDCC] group-hover:border-[#087F78] transition"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#F5F2E9] border border-[#E5DDCC] flex items-center justify-center text-[#087F78] group-hover:border-[#087F78] transition">
              <PlatformIcon type={item.destinationType} className="w-6 h-6" />
            </div>
          )}
        </Link>

        {/* Title, Country & Url */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 flex-wrap">
            <Link
              href={`/listing/${item.id}`}
              className="font-bold text-sm sm:text-base text-[#102536] hover:text-[#087F78] transition truncate"
            >
              {item.title}
            </Link>
            {item.countryCode && (
              <span
                className="text-xs cursor-default shrink-0"
                title={getCountryName(item.countryCode)}
              >
                {getCountryFlag(item.countryCode)}
              </span>
            )}
          </div>

          <a
            href={`/visit/${item.id}`}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="inline-flex items-center space-x-1 text-xs text-[#087F78] hover:underline mt-0.5 truncate max-w-[220px]"
          >
            <span className="truncate">{item.canonicalUrl}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-80" />
          </a>

          <p className="text-xs text-[#405866] line-clamp-2 mt-1">
            {item.description}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 py-2 border-t border-[#E5DDCC] bg-[#F5F2E9]/60 rounded-xl px-2.5 my-2">
        <div>
          <div className="text-[10px] uppercase font-bold text-[#71818A] tracking-wider">
            Verified Bid
          </div>
          <div className="text-sm font-extrabold text-[#087F78] font-mono">
            ₹{dollars.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-bold text-[#71818A] tracking-wider">
            Total Clicks
          </div>
          <div className="text-sm font-bold text-[#102536] font-mono flex items-center space-x-1">
            <MousePointerClick className="w-3 h-3 text-[#71818A]" />
            <span>{item.clickCount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2 pt-1">
        <Link
          href={`/listing/${item.id}`}
          className="flex-1 py-2 px-3 bg-[#F5F2E9] hover:bg-[#E5DDCC] text-[#102536] font-semibold text-xs rounded-xl transition text-center flex items-center justify-center space-x-1"
        >
          <span>View Listing</span>
          <ArrowRight className="w-3 h-3" />
        </Link>

        {onOutbid && (
          <button
            onClick={() => onOutbid(item)}
            className="flex-1 py-2 px-3 bg-[#DE8063] hover:bg-[#CF6F55] text-white font-bold text-xs rounded-xl shadow-xs transition text-center flex items-center justify-center space-x-1 cursor-pointer"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Outbid (₹{(dollars + 1).toLocaleString()})</span>
          </button>
        )}
      </div>
    </div>
  );
}
