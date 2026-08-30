import React from 'react';
import { Trophy, ShieldCheck, Building2, Zap } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: <Building2 className="w-5 h-5 text-[#DE8063]" />,
      bg: 'bg-[#F8E5DE] border-[#F0BCAD]',
      title: '1. Claim Your Building',
      desc: 'Starts at ₹2 for new startups. For existing buildings, pay only the difference to reach your target total.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#087F78]" />,
      bg: 'bg-[#DDF2EF] border-[#B9DFDA]',
      title: '2. Instant Verification',
      desc: 'Complete payment through the gateway. Cryptographic webhooks instantly verify the transaction.',
    },
    {
      icon: <Trophy className="w-5 h-5 text-[#DE8063]" />,
      bg: 'bg-[#F8E5DE] border-[#F0BCAD]',
      title: '3. Real-Time Skyline',
      desc: 'Rankings and building heights in the 3D city are strictly determined by verified cumulative bids.',
    },
    {
      icon: <Zap className="w-5 h-5 text-[#087F78]" />,
      bg: 'bg-[#DDF2EF] border-[#B9DFDA]',
      title: '4. Direct Outbound Traffic',
      desc: 'All visitors click straight through to your destination URL with 0% algorithmic filtering or bias.',
    },
  ];

  return (
    <section id="how-it-works" className="py-12 bg-[#F2EFE4] border-t border-[#E5DDCC]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="text-xs font-bold text-[#087F78] uppercase tracking-wide">
            Rules & Mechanics
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102536] mt-1 tracking-tight">
            How The Startup City Works
          </h2>
          <p className="text-xs sm:text-sm text-[#405866] mt-1.5 font-medium">
            100% transparent. No hidden algorithmic bias. Verified cumulative bids determine placement in the live city skyline.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-[#E5DDCC] shadow-2xs space-y-2.5"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${s.bg}`}>
                {s.icon}
              </div>
              <h3 className="font-bold text-sm text-[#102536]">{s.title}</h3>
              <p className="text-xs text-[#405866] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
