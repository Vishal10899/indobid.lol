'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, Activity, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface BottomNavProps {
  onOpenCreate: () => void;
}

export function BottomNav({ onOpenCreate }: BottomNavProps) {
  const pathname = usePathname();
  const { user, openAuthModal } = useAuth();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-page)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-6 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between max-w-md mx-auto relative">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center py-1 transition ${
            pathname === '/' ? 'text-[var(--color-coral)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Home</span>
        </Link>

        {/* Explore */}
        <Link
          href="/explore"
          className={`flex flex-col items-center py-1 transition ${
            pathname === '/explore' ? 'text-[var(--color-coral)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Explore</span>
        </Link>

        {/* Center Floating + Post Button */}
        <div className="relative -top-5">
          <button
            onClick={onOpenCreate}
            className="w-12 h-12 rounded-2xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] flex items-center justify-center shadow-lg shadow-[var(--color-coral)]/30 hover:scale-105 active:scale-95 transition cursor-pointer"
            aria-label="Start Conversation"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Activity */}
        <Link
          href="/activity"
          className={`flex flex-col items-center py-1 transition ${
            pathname === '/activity' ? 'text-[var(--color-coral)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Activity</span>
        </Link>

        {/* Profile */}
        <Link
          href={user ? `/profile/${user.username}` : '#'}
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              openAuthModal('login');
            }
          }}
          className={`flex flex-col items-center py-1 transition ${
            pathname.startsWith('/profile') ? 'text-[var(--color-coral)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Profile</span>
        </Link>
      </div>
    </div>
  );
}

export default BottomNav;
