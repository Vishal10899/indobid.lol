'use client';

import React from 'react';

/**
 * IndoBid Global Atmospheric Background System
 * 
 * Provides a deep charcoal / near-black layered canvas with 2-4 soft, heavily blurred
 * ambient gradients suggesting activity, conversation, and movement without visual noise.
 * Automatically adapts between desktop and mobile to maintain clean readability.
 */
export function GlobalAtmosphericBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none"
      aria-hidden="true"
    >
      {/* Base Charcoal Canvas */}
      <div className="absolute inset-0 bg-[#080E12]" />

      {/* Subtle Central Depth Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 1300px 900px at 50% 12%, rgba(20, 34, 46, 0.40) 0%, rgba(8, 14, 18, 0.85) 65%, #05090C 100%)',
        }}
      />

      {/* Atmospheric Area 1 (Upper Right): Warm Peach / Coral Accent Glow */}
      <div
        className="absolute -top-32 right-[-8%] w-[650px] sm:w-[850px] h-[650px] sm:h-[850px] rounded-full blur-[160px] sm:blur-[220px] opacity-[0.06] sm:opacity-[0.08]"
        style={{
          background:
            'radial-gradient(circle, rgba(217, 138, 108, 0.40) 0%, rgba(226, 152, 125, 0.12) 45%, transparent 75%)',
        }}
      />

      {/* Atmospheric Area 2 (Center Left): Cool Slate-Blue / Teal Atmospheric Whisper (Desktop only) */}
      <div
        className="hidden md:block absolute top-[28%] -left-32 w-[700px] h-[700px] rounded-full blur-[240px] opacity-[0.055]"
        style={{
          background:
            'radial-gradient(circle, rgba(60, 110, 138, 0.35) 0%, rgba(35, 70, 92, 0.10) 50%, transparent 75%)',
        }}
      />

      {/* Atmospheric Area 3 (Bottom Right): Deep Indigo-Slate Activity Movement (Desktop only) */}
      <div
        className="hidden lg:block absolute -bottom-48 right-[10%] w-[800px] h-[600px] rounded-full blur-[260px] opacity-[0.08]"
        style={{
          background:
            'radial-gradient(circle, rgba(28, 48, 68, 0.50) 0%, rgba(14, 26, 38, 0.15) 55%, transparent 75%)',
        }}
      />

      {/* Atmospheric Area 4 (Top Left): Subtle Warm Amber Accent (Large screens only) */}
      <div
        className="hidden xl:block absolute top-10 left-[15%] w-[450px] h-[450px] rounded-full blur-[190px] opacity-[0.03]"
        style={{
          background:
            'radial-gradient(circle, rgba(216, 178, 87, 0.30) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

export default GlobalAtmosphericBackground;
