import React from 'react';
import Link from 'next/link';
import { Building2, ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[#E5DDCC] bg-[#F2EFE4] pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-xs text-[#405866]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-[#E5DDCC]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-[#087F78] flex items-center justify-center font-bold text-white shadow-xs">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-[#102536] text-sm">
                indobid<span className="text-[#DE8063] font-black">.lol</span>
              </span>
              <p className="text-[11px] text-[#71818A]">Live Interactive Startup City Leaderboard</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-bold text-[#405866]">
            <Link href="/#live-office" className="hover:text-[#102536] transition">Live Office</Link>
            <Link href="/#leaderboard" className="hover:text-[#102536] transition">Leaderboard</Link>
            <Link href="/#best-of-all" className="hover:text-[#102536] transition">Best of All</Link>
            <Link href="/#how-it-works" className="hover:text-[#102536] transition">How it Works</Link>
          </div>
        </div>

        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#71818A]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>&copy; {new Date().getFullYear()} indobid.lol</span>
            <span>·</span>
            <span className="text-[#405866] font-medium">Built by Vishal Kumar</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[#087F78] font-bold bg-[#DDF2EF] px-2.5 py-1 rounded-lg border border-[#B9DFDA]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Cryptographic Checkout</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
