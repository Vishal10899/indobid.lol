'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Send, RefreshCw } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function ConversationThreadPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<{ id: string; username: string; displayName: string; avatarUrl?: string | null } | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchThread = async () => {
    try {
      const res = await fetch(`/api/messages/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setOtherUser(data.otherUser || null);
      }
    } catch (e) {
      console.error('Error fetching conversation thread:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputContent.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setInputContent('');
      }
    } catch (e) {
      console.error('Send message error:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] w-full overflow-x-hidden">
      <div className="lg:hidden w-full">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen border-r-0 lg:border-r border-[var(--border-subtle)] flex flex-col justify-between pb-24 lg:pb-6">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] p-3.5 sm:p-4 flex items-center space-x-3 w-full min-w-0">
            <Link
              href="/messages"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
              aria-label="Back to messages"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            {otherUser && (
              <div className="flex items-center space-x-2.5">
                <Avatar
                  src={otherUser.avatarUrl}
                  name={otherUser.displayName}
                  username={otherUser.username}
                  size="sm"
                />
                <Link
                  href={`/profile/${otherUser.username}`}
                  className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition flex items-center space-x-1"
                >
                  <span>{otherUser.displayName}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">@{otherUser.username}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-[var(--color-coral)] animate-spin mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">Loading conversation...</p>
              </div>
            ) : messages.length > 0 ? (
              messages.map((m) => {
                const isMe = m.senderId === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-[var(--color-coral)] text-[#071B21] font-medium rounded-br-none'
                          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="text-[9px] text-[var(--text-muted)] mt-1 px-1">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                Say hello to start the conversation!
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSend} className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/50 flex items-center space-x-2">
            <input
              type="text"
              required
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={sending || !inputContent.trim()}
              className="p-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] rounded-xl font-bold transition cursor-pointer disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </main>

        <RightSidebar />
      </div>

      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />
      <CreateDebateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
