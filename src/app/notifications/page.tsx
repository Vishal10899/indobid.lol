'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { useAuth } from '@/context/AuthContext';
import { Bell, Heart, UserPlus, Coins, MessageSquare, Check, RefreshCw, LogIn } from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

import { AuthGate } from '@/components/AuthGate';

function NotificationsContent() {
  const { user, openAuthModal, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {
        console.error('Failed to load notifications:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUser();
    } catch {}
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-[var(--color-danger)]" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-[var(--color-lime)]" />;
      case 'continuation':
        return <Coins className="w-4 h-4 text-[var(--color-amber)]" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-[var(--color-coral)]" />;
      default:
        return <Bell className="w-4 h-4 text-[var(--color-coral)]" />;
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] p-3.5 sm:p-4 flex items-center justify-between w-full min-w-0">
            <div className="flex items-center space-x-2.5">
              <Bell className="w-5 h-5 text-[var(--color-coral)]" />
              <h1 className="text-lg font-bold font-bodoni text-[var(--text-primary)]">Notifications</h1>
            </div>

            {notifications.some((n) => !n.isRead) && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--color-coral)] hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {!user ? (
              <div className="py-20 text-center space-y-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8">
                <Bell className="w-10 h-10 text-[var(--color-coral)] mx-auto opacity-70" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Stay updated</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  Sign in to receive notifications when someone likes your opinions, continues your debates, or follows you.
                </p>
                <button
                  onClick={() => openAuthModal('login')}
                  className="mt-2 px-4 py-2 bg-[var(--color-coral)] text-[#071B21] font-black text-xs rounded-xl shadow cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            ) : loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Loading notifications...</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((n) => {
                const CardWrapper = n.linkUrl ? Link : 'div';
                return (
                  <CardWrapper
                    key={n.id}
                    href={n.linkUrl || '#'}
                    className={`block p-4 rounded-xl border transition ${
                      n.isRead
                        ? 'bg-[var(--bg-surface)] border-[var(--border-subtle)] opacity-85'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-color)] shadow-sm'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] shrink-0 mt-0.5">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{n.title}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {new Date(n.createdAt).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{n.message}</p>
                      </div>
                    </div>
                  </CardWrapper>
                );
              })
            ) : (
              <div className="py-20 text-center space-y-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8">
                <Bell className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">No notifications yet</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  When other debaters interact with your opinions, you&apos;ll see updates here.
                </p>
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>

      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />
      <CreateDebateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <AuthGate>
      <NotificationsContent />
    </AuthGate>
  );
}
