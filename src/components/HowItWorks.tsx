'use client';

import React from 'react';
import { Eye, MessageSquare, Coins, TrendingUp, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export function HowItWorks() {
  return (
    <section className="w-full py-10 px-4 sm:px-6 bg-[#123846]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#D99A7D]/15 text-[#D99A7D] border border-[#D99A7D]/30 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>The IndoBid Philosophy</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#FAF6F0] tracking-tight">
            Read Free. Post Free. Back with Conviction.
          </h2>
          <p className="text-sm text-[#E4D5CE]">
            Great opinions don&apos;t require payment to be heard. Money adds weight, not bought reach.
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
                <span>READ & DISCOVER</span>
              </h3>
              <p className="text-xs text-[#E4D5CE] leading-relaxed">
                Every opinion, debate, and discussion is completely free to read, bookmark, and share.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D99A7D]/15 text-[11px] font-semibold text-[#D99A7D]">
              100% Free Forever
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#184555] border border-[#D99A7D]/25 rounded-2xl p-6 relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0B242D] border border-[#AA756A]/40 text-[#AA756A] flex items-center justify-center font-black text-sm mb-4">
                02
              </div>
              <h3 className="text-lg font-bold text-[#FAF6F0] mb-2 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#AA756A]" />
                <span>POST & DISCUSS</span>
              </h3>
              <p className="text-xs text-[#E4D5CE] leading-relaxed">
                Publish your viewpoints and arguments freely. Quality content and authentic discussions earn organic momentum.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D99A7D]/15 text-[11px] font-semibold text-[#AA756A]">
              Free Publishing
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#184555] border border-[#D99A7D]/25 rounded-2xl p-6 relative flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0B242D] border border-[#D99A7D]/40 text-[#D99A7D] flex items-center justify-center font-black text-sm mb-4">
                03
              </div>
              <h3 className="text-lg font-bold text-[#FAF6F0] mb-2 flex items-center space-x-2">
                <Coins className="w-4 h-4 text-[#D99A7D]" />
                <span>BACK CONVICTION</span>
              </h3>
              <p className="text-xs text-[#E4D5CE] leading-relaxed">
                Optionally put money behind arguments to signal skin in the game. Backing adds economic weight with a 50/50 creator split.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D99A7D]/15 text-[11px] font-semibold text-[#D99A7D]">
              Optional Financial Weight
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
