'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { MessageSquare, Plus, RefreshCw, LogIn, X, Send } from 'lucide-react';

interface ConversationItem {
  id: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: string;
    isRead: boolean;
  } | null;
  lastMessageAt: string;
}

import { AuthGate } from '@/components/AuthGate';

function MessagesContent() {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Message Modal
  const [newMsgModalOpen, setNewMsgModalOpen] = useState(false);
  const [targetUsername, setTargetUsername] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/messages');
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (e) {
        console.error('Failed to load messages:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSending(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUsername: targetUsername.trim(),
          content: messageContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start conversation');
      }

      setNewMsgModalOpen(false);
      router.push(`/messages/${data.conversationId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error sending message');
    } finally {
      setSending(false);
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
              <MessageSquare className="w-5 h-5 text-[var(--color-coral)]" />
              <h1 className="text-lg font-bold font-bodoni text-[var(--text-primary)]">Direct Messages</h1>
            </div>

            {user && (
              <button
                onClick={() => setNewMsgModalOpen(true)}
                className="px-3 py-1.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-semibold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer shadow-sm shadow-[var(--color-coral)]/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Message</span>
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {!user ? (
              <div className="py-20 text-center space-y-3 glass-panel rounded-2xl p-8">
                <MessageSquare className="w-10 h-10 text-[var(--color-coral)] mx-auto opacity-70" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Private Conversations</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  Sign in to exchange private messages and discuss opinions directly with other debaters.
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
                <p className="text-xs text-[var(--text-secondary)]">Loading messages...</p>
              </div>
            ) : conversations.length > 0 ? (
              conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/messages/${c.id}`}
                  className="block p-4 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-color)] transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Avatar
                        src={c.otherUser.avatarUrl}
                        name={c.otherUser.displayName}
                        username={c.otherUser.username}
                        size="sm"
                      />
                      <div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {c.otherUser.displayName}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)] ml-1.5">
                          @{c.otherUser.username}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(c.lastMessageAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {c.lastMessage && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-1 pl-10">
                      {c.lastMessage.content}
                    </p>
                  )}
                </Link>
              ))
            ) : (
              <div className="py-20 text-center space-y-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8">
                <MessageSquare className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">No messages yet</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Start a private conversation with any user on the platform.
                </p>
                <button
                  onClick={() => setNewMsgModalOpen(true)}
                  className="mt-2 px-4 py-2 bg-[var(--color-coral)] text-[#071B21] font-bold text-xs rounded-xl shadow cursor-pointer inline-flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start Conversation</span>
                </button>
              </div>
            )}
          </div>
        </main>

        <RightSidebar />
      </div>

      {/* New Message Modal */}
      {newMsgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md overflow-y-auto">
          <div className="glass-modal max-w-md w-full rounded-2xl p-6 shadow-2xl relative my-auto border border-white/[0.09]">
            <button
              onClick={() => setNewMsgModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-white/[0.05] transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">New Direct Message</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Send a secure private message to another debater.
            </p>

            {errorMsg && (
              <div className="mb-3 p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleStartConversation} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5">
                  Recipient (@username)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs text-[var(--text-muted)]">@</span>
                  <input
                    type="text"
                    required
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="w-full h-11 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)]/60 rounded-xl pl-8 pr-3 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-coral)]/20 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  required
                  rows={3}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)]/60 rounded-xl p-3 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-coral)]/20 resize-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full h-11 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow-lg shadow-[var(--color-coral)]/20 transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Sending...' : 'Send Message'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />
      <CreateDebateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <AuthGate>
      <MessagesContent />
    </AuthGate>
  );
}
