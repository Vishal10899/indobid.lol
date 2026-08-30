'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Building2, PlusCircle, Menu, X } from 'lucide-react';

interface NavbarProps {
  onOpenBidModal?: (initialData?: { url?: string; targetBidDollars?: number; categoryId?: string }) => void;
  minToTakeFirstDollars?: number;
}

export function Navbar({ onOpenBidModal, minToTakeFirstDollars }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleClaimClick = () => {
    if (onOpenBidModal) {
      onOpenBidModal({ targetBidDollars: minToTakeFirstDollars || 2 });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-color)] bg-[#F8F6EF]/95 backdrop-blur-md transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 sm:h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#087F78] flex items-center justify-center text-white font-bold shadow-xs transition-transform group-hover:scale-105">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-base tracking-tight text-[#102536]">
              indobid<span className="text-[#DE8063] font-black">.lol</span>
            </span>
            <span className="inline-flex items-center space-x-1 text-[10px] font-bold tracking-wider uppercase bg-[#DDF2EF] text-[#087F78] px-2 py-0.5 rounded-full border border-[#B9DFDA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#087F78] animate-pulse" />
              <span>City Live</span>
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-7 text-sm font-medium text-[#405866]">
          <Link
            href="/#live-office"
            className="text-[#102536] font-bold relative pb-0.5 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#087F78] after:rounded-full transition flex items-center space-x-1"
          >
            <span>Live Office</span>
          </Link>
          <Link
            href="/#leaderboard"
            className="hover:text-[#102536] transition"
          >
            Leaderboard
          </Link>
          <Link
            href="/#best-of-all"
            className="hover:text-[#102536] transition flex items-center space-x-1"
          >
            <span>Best of All</span>
          </Link>
          <Link
            href="/#how-it-works"
            className="hover:text-[#102536] transition"
          >
            How it Works
          </Link>
        </nav>

        {/* Desktop CTA & Mobile Toggle */}
        <div className="flex items-center space-x-3">
          {onOpenBidModal && (
            <button
              onClick={handleClaimClick}
              className="hidden md:inline-flex px-4 py-2 bg-[#DE8063] hover:bg-[#CF6F55] text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all duration-150 items-center space-x-1.5 cursor-pointer hover:shadow-sm active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>+ Claim Your Spot</span>
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 rounded-lg border border-[var(--border-color)] bg-white flex items-center justify-center text-[#102536] hover:bg-[var(--bg-surface)] transition cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border-color)] bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-150">
          <Link
            href="/#live-office"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-bold text-[#087F78] bg-[#DDF2EF]"
          >
            Live Office
          </Link>
          <Link
            href="/#leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-[#102536] hover:bg-[var(--bg-surface)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/#best-of-all"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-[#102536] hover:bg-[var(--bg-surface)]"
          >
            Best of All
          </Link>
          <Link
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-medium text-[#102536] hover:bg-[var(--bg-surface)]"
          >
            How it Works
          </Link>
          {onOpenBidModal && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleClaimClick();
              }}
              className="w-full mt-2 px-4 py-2.5 bg-[#DE8063] text-white font-bold rounded-xl text-sm shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>+ Claim Your Spot</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
