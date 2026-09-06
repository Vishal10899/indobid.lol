'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, Activity, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface BottomNavProps {
  onOpenCreate: () => void;
}

export function BottomNav({ onOpenCreate }: BottomNavProps) {
  const pathname = usePathname();
  const { user, openAuthModal } = useAuth();

  const isHome = pathname === '/' || pathname === '';
  const isExplore = pathname.startsWith('/explore');
  const isActivity = pathname.startsWith('/activity');
  const isMessages = pathname.startsWith('/messages');

  // Strict unauthenticated hide: logged-out visitors never see the mobile app navbar
  if (!user) {
    return null;
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-page)]/85 backdrop-blur-xl border-t border-[var(--border-subtle)] px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto relative">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isHome
              ? 'text-[var(--color-coral)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
          }`}
          aria-current={isHome ? 'page' : undefined}
        >
          <Home className={`w-5 h-5 transition-transform ${isHome ? 'scale-105' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Home</span>
        </Link>

        {/* 2. Explore */}
        <Link
          href="/explore"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isExplore
              ? 'text-[var(--color-coral)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
          }`}
          aria-current={isExplore ? 'page' : undefined}
        >
          <Compass className={`w-5 h-5 transition-transform ${isExplore ? 'scale-105' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Explore</span>
        </Link>

        {/* 3. Center Floating + Post Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={onOpenCreate}
            className="w-12 h-12 -mt-5 rounded-2xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] flex items-center justify-center shadow-lg shadow-[var(--color-coral)]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-coral)]/50"
            aria-label="Start Conversation"
            title="Post Opinion"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* 4. Activity */}
        <Link
          href="/activity"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isActivity
              ? 'text-[var(--color-coral)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
          }`}
          aria-current={isActivity ? 'page' : undefined}
        >
          <Activity className={`w-5 h-5 transition-transform ${isActivity ? 'scale-105' : ''}`} />
          <span className="text-[10px] tracking-tight mt-0.5">Activity</span>
        </Link>

        {/* 5. Messages */}
        <Link
          href={user ? '/messages' : '#'}
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              openAuthModal('login');
            }
          }}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isMessages
              ? 'text-[var(--color-coral)] font-bold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium'
          }`}
          aria-current={isMessages ? 'page' : undefined}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 transition-transform ${isMessages ? 'scale-105' : ''}`} />
            {Boolean(user?.unreadMessagesCount && user.unreadMessagesCount > 0) && (
              <span className="min-w-[15px] h-3.5 px-1 rounded-full bg-[var(--color-coral)] text-[#071B21] text-[9px] font-black absolute -top-1 -right-2 flex items-center justify-center leading-none shadow-xs">
                {(user?.unreadMessagesCount ?? 0) > 99 ? '99+' : user?.unreadMessagesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Messages</span>
        </Link>
      </div>
    </nav>
  );
}

export default BottomNav;
