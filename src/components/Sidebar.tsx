'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Flame,
  Activity,
  Bell,
  Bookmark,
  MessageSquare,
  User,
  Plus,
  ShieldCheck,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatINR } from '@/lib/money';
import { Logo } from '@/components/Logo';
import { Avatar } from '@/components/Avatar';

interface SidebarProps {
  onOpenCreate: () => void;
}

export function Sidebar({ onOpenCreate }: SidebarProps) {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/explore', label: 'Explore', icon: Compass },
    { href: '/trending', label: 'Trending', icon: Flame },
    { href: '/activity', label: 'Activity', icon: Activity },
    { href: '/notifications', label: 'Notifications', icon: Bell, requiresAuth: true, badge: user?.unreadNotificationsCount },
    { href: '/saved', label: 'Saved', icon: Bookmark, requiresAuth: true },
    { href: '/messages', label: 'Messages', icon: MessageSquare, requiresAuth: true, badge: user?.unreadMessagesCount },
    { href: user ? `/profile/${user.username}` : '/profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-[280px] h-screen sticky top-0 py-6 px-4 border-r border-[var(--border-subtle)] bg-[var(--bg-page)]/80 backdrop-blur-xl shrink-0 select-none overflow-y-auto scrollbar-none">
      <div className="space-y-6">
        {/* Brand Logo Header */}
        <div className="px-2 pt-1 pb-1">
          <Logo size="md" />
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
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition group ${
                  isActive
                    ? 'bg-white/[0.05] text-[var(--text-primary)] font-bold shadow-xs border border-white/[0.08]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-[var(--color-coral)]' : 'text-[var(--text-muted)] group-hover:text-[var(--color-coral)]'
                    }`}
                  />
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-coral)] text-[#071B21]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Primary Action Button: + Start Conversation */}
        <div className="px-1 pt-2">
          <button
            onClick={onOpenCreate}
            className="w-full py-3.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#07171C] font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-[var(--color-coral)]/15 transition flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Start Conversation</span>
          </button>
        </div>
      </div>

      {/* User Mini-Profile / Sign In CTA */}
      <div className="pt-4 border-t border-[var(--border-subtle)] px-1">
        {user ? (
          <div className="glass-panel rounded-2xl p-3 flex items-center justify-between transition hover:border-white/[0.14]">
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
              <div className="overflow-hidden leading-tight min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition truncate block">
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
              className="p-1.5 text-[var(--text-muted)] hover:text-red-400 rounded-xl hover:bg-[var(--bg-page-deep)] transition cursor-pointer shrink-0 ml-1"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            className="w-full py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
          >
            <LogIn className="w-4 h-4 text-[var(--color-coral)]" />
            <span>Sign In / Join</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
