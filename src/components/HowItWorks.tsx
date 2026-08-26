import React from 'react';
import { DollarSign, Trophy, ShieldCheck, Zap } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: <DollarSign className="w-5 h-5 text-amber-500" />,
      title: '1. Choose Target Bid',
      desc: 'Starts at $2 for new listings. For existing listings, pay only the difference to reach your target total.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      title: '2. Instant Verification',
      desc: 'Complete payment through the gateway. Webhook cryptographically confirms transaction.',
    },
    {
      icon: <Trophy className="w-5 h-5 text-amber-500" />,
      title: '3. Deterministic Ranking',
      desc: 'Rankings are strictly ordered by verified cumulative bid. Earliest timestamp breaks ties.',
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-500" />,
      title: '4. Direct Outbound Traffic',
      desc: 'All visitors click straight through to your destination URL with 0% algorithmic filtering.',
    },
  ];

  return (
    <section id="how-it-works" className="py-12 bg-[var(--bg-section)] border-t border-[var(--border-color)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="text-xs font-semibold text-amber-500 uppercase tracking-wide">
            Rules & Mechanics
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
            How Ranking Works
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5">
            100% transparent. No hidden ranking algorithms. Verified cumulative bids determine placement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] shadow-2xs space-y-2"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center">
                {s.icon}
              </div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">{s.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
