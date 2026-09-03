'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  MessageSquare,
  Sun,
  Moon,
  Plus,
  LogIn,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Bookmark,
  Coins,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';

interface NavbarProps {
  onOpenCreate?: () => void;
}

export function Navbar({ onOpenCreate }: NavbarProps) {
  const router = useRouter();
  const { user, openAuthModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/explore?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--bg-page)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Brand Logo */}
        <div className="shrink-0">
          <Logo size="sm" />
        </div>

        {/* Global Search Bar (Medium & Up) */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-sm relative min-w-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opinions, debaters..."
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition"
          />
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
        </form>

        {/* Action Items */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Notifications Bell */}
          <Link
            href={user ? '/notifications' : '#'}
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                openAuthModal('login');
              }
            }}
            className="p-1.5 sm:p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition relative"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {Boolean(user?.unreadNotificationsCount && user.unreadNotificationsCount > 0) && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-coral)] absolute top-1 right-1" />
            )}
          </Link>

          {/* Messages Link (Desktop & Tablet) */}
          <Link
            href={user ? '/messages' : '#'}
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                openAuthModal('login');
              }
            }}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition relative hidden sm:flex"
            title="Messages"
            aria-label="Messages"
          >
            <MessageSquare className="w-4 h-4" />
            {Boolean(user?.unreadMessagesCount && user.unreadMessagesCount > 0) && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-coral)] absolute top-1.5 right-1.5" />
            )}
          </Link>

          {/* + Post Button */}
          {onOpenCreate ? (
            <button
              onClick={onOpenCreate}
              className="px-2.5 sm:px-3 py-1.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Post Opinion</span>
              <span className="sm:hidden font-bold">Post</span>
            </button>
          ) : (
            <Link
              href="/?create=true"
              className="px-2.5 sm:px-3 py-1.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center space-x-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span className="hidden sm:inline">Post Opinion</span>
              <span className="sm:hidden font-bold">Post</span>
            </Link>
          )}

          {/* Profile Dropdown or Sign In */}
          {user ? (
            <div className="relative shrink-0">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="rounded-xl overflow-hidden cursor-pointer transition focus:outline-none p-0.5"
                aria-label="User menu"
              >
                <Avatar
                  src={user.avatarUrl}
                  name={user.displayName}
                  username={user.username}
                  size="sm"
                />
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl py-1.5 z-50 text-xs"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                    <p className="font-bold text-[var(--text-primary)] truncate">{user.displayName}</p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">@{user.username}</p>
                  </div>

                  <Link
                    href={`/profile/${user.username}`}
                    className="flex items-center space-x-2 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-[var(--color-coral)]" />
                    <span>View Profile</span>
                  </Link>

                  <Link
                    href={`/profile/${user.username}?tab=earnings`}
                    className="flex items-center space-x-2 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
                  >
                    <Coins className="w-3.5 h-3.5 text-[var(--color-amber)]" />
                    <span>Creator Earnings</span>
                  </Link>

                  <Link
                    href="/saved"
                    className="flex items-center space-x-2 px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[var(--color-amber)]" />
                    <span>Saved Opinions</span>
                  </Link>

                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="flex items-center space-x-2 px-3 py-2 text-[var(--color-amber)] hover:bg-[var(--bg-card-hover)] transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Admin Console</span>
                    </Link>
                  )}

                  <button
                    onClick={logout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-red-400 hover:bg-[var(--bg-card-hover)] transition cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-bold transition flex items-center space-x-1 cursor-pointer shrink-0"
            >
              <LogIn className="w-3.5 h-3.5 text-[var(--color-coral)]" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
