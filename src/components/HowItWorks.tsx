'use client';

import React from 'react';
import { Eye, Coins, TrendingUp, ArrowRight, ShieldCheck } from 'lucide-react';

export function HowItWorks() {
  return (
    <section className="w-full py-10 px-4 sm:px-6 bg-[#123846]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D99A7D]/15 text-[#D99A7D] border border-[#D99A7D]/30 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>The IndoBid Mechanic</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#FAF6F0] tracking-tight">
            Read for free. Pay to participate.
          </h2>
          <p className="text-sm text-[#E4D5CE]">
            Everyone has an opinion. On IndoBid, put money behind it.
          </p>
        </div>

        {/* 3 Step Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Step 1 */}
          <div className="bg-[#184555] border border-[#D99A7D]/25 rounded-2xl p-6 relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0B242D] border border-[#D99A7D]/40 text-[#D99A7D] flex items-center justify-center font-black text-sm mb-4">
                01
              </div>
              <h3 className="text-lg font-bold text-[#FAF6F0] mb-2 flex items-center space-x-2">
                <Eye className="w-4 h-4 text-[#D99A7D]" />
                <span>READ</span>
              </h3>
              <p className="text-xs text-[#E4D5CE] leading-relaxed">
                Every public debate and response is completely free to read, explore, and share with anyone.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D99A7D]/15 text-[11px] font-semibold text-[#D99A7D]">
              100% Free Public Reading
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#184555] border border-[#D99A7D]/25 rounded-2xl p-6 relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0B242D] border border-[#AA756A]/40 text-[#AA756A] flex items-center justify-center font-black text-sm mb-4">
                02
              </div>
              <h3 className="text-lg font-bold text-[#FAF6F0] mb-2 flex items-center space-x-2">
                <Coins className="w-4 h-4 text-[#AA756A]" />
                <span>CONTRIBUTE</span>
              </h3>
              <p className="text-xs text-[#E4D5CE] leading-relaxed">
                Start a debate with ₹10. To reply and continue the conversation, your contribution must beat the previous one by at least ₹1.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D99A7D]/15 text-[11px] font-semibold text-[#AA756A]">
              Skin in the Game
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#184555] border border-[#D99A7D]/25 rounded-2xl p-6 relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0B242D] border border-[#D99A7D]/40 text-[#D99A7D] flex items-center justify-center font-black text-sm mb-4">
                03
              </div>
              <h3 className="text-lg font-bold text-[#FAF6F0] mb-2 flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#D99A7D]" />
                <span>CLIMB</span>
              </h3>
              <p className="text-xs text-[#E4D5CE] leading-relaxed">
                More verified contribution creates stronger momentum and pushes active debates to the top of Trending.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D99A7D]/15 text-[11px] font-semibold text-[#D99A7D]">
              Verified Trending Rank
            </div>
          </div>
        </div>

        {/* Contribution Ladder Visual Explanation */}
        <div className="bg-[#0E2F3B] border border-[#D99A7D]/30 rounded-2xl p-5 sm:p-6">
          <div className="text-center mb-3">
            <span className="text-xs font-bold text-[#FAF6F0] uppercase tracking-wider">
              Contribution Chain Progression
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm font-mono font-extrabold text-[#FAF6F0]">
            <span className="px-3 py-1.5 rounded-lg bg-[#184555] border border-[#D99A7D]/40 text-[#D99A7D]">
              ₹10 (Start)
            </span>
            <ArrowRight className="w-4 h-4 text-[#AA756A]" />
            <span className="px-3 py-1.5 rounded-lg bg-[#184555] border border-[#D99A7D]/40 text-[#D99A7D]">
              ₹11 (Reply)
            </span>
            <ArrowRight className="w-4 h-4 text-[#AA756A]" />
            <span className="px-3 py-1.5 rounded-lg bg-[#184555] border border-[#D99A7D]/40 text-[#D99A7D]">
              ₹12 (Reply)
            </span>
            <ArrowRight className="w-4 h-4 text-[#AA756A]" />
            <span className="px-3 py-1.5 rounded-lg bg-[#184555] border border-[#AA756A]/50 text-[#AA756A]">
              ₹25 (Boost)
            </span>
            <ArrowRight className="w-4 h-4 text-[#AA756A]" />
            <span className="px-3 py-1.5 rounded-lg bg-[#4A4B5D] border border-[#D99A7D]/50 text-[#D99A7D]">
              ₹100 (Power Move)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
