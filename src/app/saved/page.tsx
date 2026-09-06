'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { DebateCard } from '@/components/DebateCard';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { useAuth } from '@/context/AuthContext';
import { Bookmark, RefreshCw, LogIn } from 'lucide-react';
import { AuthGate } from '@/components/AuthGate';

function SavedContent() {
  const { user, openAuthModal } = useAuth();
  const [debates, setDebates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchSaved = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/saved');
        if (res.ok) {
          const data = await res.json();
          setDebates(data.items || []);
        }
      } catch (e) {
        console.error('Failed to load saved debates:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSaved();
  }, [user]);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] p-3.5 sm:p-4 flex items-center space-x-2.5 w-full min-w-0">
            <Bookmark className="w-5 h-5 text-[var(--color-coral)]" />
            <h1 className="text-lg font-bold font-bodoni text-[var(--text-primary)]">Saved Opinions</h1>
          </div>

          <div>
            {!user ? (
              <div className="p-4 sm:p-6">
                <div className="py-20 text-center space-y-3 glass-panel rounded-2xl p-8">
                  <Bookmark className="w-10 h-10 text-[var(--color-coral)] mx-auto opacity-70" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Save debates for later</h3>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                    Sign in to bookmark opinions, follow the progression ladder, and track continuations.
                  </p>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="mt-2 px-4 py-2 bg-[var(--color-coral)] text-[#071B21] font-black text-xs rounded-xl shadow cursor-pointer inline-flex items-center space-x-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Loading saved bookmarks...</p>
              </div>
            ) : debates.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {debates.map((d) => <DebateCard key={d.id} {...d} />)}
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <div className="py-20 text-center space-y-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8">
                  <Bookmark className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h3 className="text-base font-bold text-[var(--text-primary)]">No saved debates yet</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Click the bookmark icon on any debate card in your feed to save it here.
                  </p>
                </div>
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

export default function SavedPage() {
  return (
    <AuthGate>
      <SavedContent />
    </AuthGate>
  );
}
