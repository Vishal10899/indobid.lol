'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Flame,
  Activity,
  Bookmark,
  MessageSquare,
  User,
  Plus,
  ShieldCheck,
  LogOut,
  LogIn,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { formatINR } from '@/lib/money';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';

interface SidebarProps {
  onOpenCreate: () => void;
}

export function Sidebar({ onOpenCreate }: SidebarProps) {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/explore', label: 'Explore', icon: Compass },
    { href: '/trending', label: 'Trending', icon: Flame },
    { href: '/activity', label: 'Activity', icon: Activity },
    { href: '/saved', label: 'Saved', icon: Bookmark, requiresAuth: true },
    { href: '/messages', label: 'Messages', icon: MessageSquare, requiresAuth: true, badge: user?.unreadMessagesCount },
    { href: user ? `/profile/${user.username}` : '/profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 h-screen sticky top-0 py-6 px-4 border-r border-[var(--border-subtle)] bg-[var(--bg-page)] shrink-0 select-none">
      <div className="space-y-6">
        {/* Brand Logo & Theme Switcher */}
        <div className="flex items-center justify-between px-2">
          <Logo size="md" />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[var(--color-amber)]" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--color-slate)]" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/' && pathname === '');

            return (
              <Link
                key={item.label}
                href={item.requiresAuth && !user ? '#' : item.href}
                onClick={(e) => {
                  if (item.requiresAuth && !user) {
                    e.preventDefault();
                    openAuthModal('login');
                  }
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                  isActive
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[var(--color-coral)]' : 'text-[var(--text-muted)]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-coral)] text-[#071B21]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Primary Action Button: + Post Opinion · ₹10 */}
        <button
          onClick={onOpenCreate}
          className="w-full py-3 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Post Opinion · ₹10</span>
        </button>
      </div>

      {/* User Mini-Profile / Sign In CTA */}
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        {user ? (
          <div className="bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-2.5 flex items-center justify-between transition">
            <Link
              href={`/profile/${user.username}`}
              className="flex items-center space-x-2.5 overflow-hidden flex-1 group"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName}
                username={user.username}
                size="sm"
              />
              <div className="overflow-hidden leading-tight">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition truncate">
                    {user.displayName}
                  </span>
                  {user.isVerified && <ShieldCheck className="w-3 h-3 text-[var(--color-lime)] shrink-0" />}
                </div>
                <span className="text-[10px] text-[var(--color-amber)] font-mono block truncate">
                  {formatINR(user.totalContributedPaise)} backed
                </span>
              </div>
            </Link>

            <button
              onClick={logout}
              className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-lg hover:bg-[var(--bg-page-deep)] transition cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            className="w-full py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-[var(--color-coral)]" />
            <span>Sign In / Join</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
