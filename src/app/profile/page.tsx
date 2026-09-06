'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/context/AuthContext';
import { AuthGate } from '@/components/AuthGate';
import { User, ArrowRight } from 'lucide-react';

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [usernameInput, setUsernameInput] = useState('');

  useEffect(() => {
    if (user?.username) {
      router.replace(`/profile/${user.username}`);
    } else if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('indobid_username');
      if (saved && saved.trim()) {
        router.replace(`/profile/${saved.trim()}`);
      }
    }
  }, [user, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      const clean = usernameInput.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      router.push(`/profile/${clean}`);
    }
  };

  return (
    <AuthGate>
      <div className="min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)] w-full overflow-x-hidden">
        <Navbar />

        <main className="flex-1 max-w-md w-full mx-auto px-4 py-16 flex items-center justify-center pb-24 lg:pb-12 min-w-0">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-8 w-full text-center space-y-4 shadow-xl min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-page-deep)] border border-[var(--border-color)] text-[var(--color-coral)] flex items-center justify-center mx-auto shadow-inner">
              <User className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Find Debater Profile</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                View public debate statistics, follower rank, and verified contributions for any user.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-[var(--text-muted)]">@</span>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="enter username"
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#092328] font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <span>View Profile</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </form>
          </div>
        </main>

        <Footer />
        <BottomNav onOpenCreate={() => {}} />
      </div>
    </AuthGate>
  );
}
