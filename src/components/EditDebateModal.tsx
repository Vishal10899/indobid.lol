'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Edit3,
  AtSign,
  Hash,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { FormattedText } from '@/components/FormattedText';

interface EditDebateModalProps {
  isOpen: boolean;
  onClose: () => void;
  debateId: string;
  initialTitle?: string;
  initialContent: string;
  initialHashtags?: string | null;
  authorUsername?: string;
  onUpdated?: (updated: {
    title: string;
    content: string;
    hashtags?: string | null;
    updatedAt: string;
  }) => void;
}

export function EditDebateModal({
  isOpen,
  onClose,
  debateId,
  initialTitle = '',
  initialContent,
  initialHashtags = '',
  authorUsername = '',
  onUpdated,
}: EditDebateModalProps) {
  const [content, setContent] = useState(initialContent || '');
  const [hashtags, setHashtags] = useState(initialHashtags || '');
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent || '');
      setHashtags(initialHashtags || '');
      setErrorMsg(null);
      setSuccessMsg(false);
      setActiveTab('write');

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !loading) {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, initialContent, initialHashtags, loading, onClose]);

  if (!isOpen) return null;

  const handleInsertMention = () => {
    const mentionInput = prompt('Enter username to mention (without @):');
    if (mentionInput && mentionInput.trim()) {
      const cleanUsername = mentionInput.trim().replace(/^@/, '');
      const insertText = ` @${cleanUsername} `;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = content.substring(0, start) + insertText + content.substring(end);
        setContent(newText);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + insertText.length, start + insertText.length);
        }, 50);
      } else {
        setContent((prev) => `${prev} @${cleanUsername} `);
      }
    }
  };

  const handleInsertHashtag = () => {
    const tagInput = prompt('Enter hashtag topic (without #):');
    if (tagInput && tagInput.trim()) {
      const cleanTag = tagInput.trim().replace(/^#/, '');
      setHashtags((prev) => (prev ? `${prev} #${cleanTag}` : `#${cleanTag}`));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = content.trim();
    if (trimmed.length < 5) {
      setErrorMsg('Post content must be at least 5 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/debates/${debateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          hashtags: hashtags.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update post');
      }

      setSuccessMsg(true);
      if (onUpdated && data.debate) {
        onUpdated({
          title: data.debate.title,
          content: data.debate.content,
          hashtags: data.debate.hashtags,
          updatedAt: data.debate.updatedAt || new Date().toISOString(),
        });
      }

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving your changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md w-full h-[100dvh] overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="glass-modal w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),0_0_40px_rgba(217,138,108,0.04)] overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85vh] min-w-0 border border-white/[0.09]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-coral)]/15 border border-[var(--color-coral)]/30 flex items-center justify-center text-[var(--color-coral)]">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-bodoni text-[var(--text-primary)]">Edit Opinion</h2>
              {authorUsername && (
                <p className="text-[11px] text-[var(--text-muted)]">Posting as @{authorUsername}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Write / Preview Tab switcher */}
            <div className="flex items-center bg-[var(--bg-page-deep)] rounded-xl p-0.5 border border-white/[0.08] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeTab === 'write'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center space-x-1 ${
                  activeTab === 'preview'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>
            </div>

            <button
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page-deep)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex items-start space-x-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Opinion updated successfully!</span>
            </div>
          )}

          {activeTab === 'write' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Opinion Content
                </label>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="Edit your opinion... Use @username to mention others and #hashtags for topics."
                  maxLength={5000}
                  className="w-full bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/20 rounded-xl p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition leading-relaxed resize-y font-normal"
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1 px-1">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleInsertMention}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[var(--bg-page)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--color-coral)] transition cursor-pointer"
                      title="Add @mention"
                    >
                      <AtSign className="w-3 h-3 text-[var(--color-coral)]" />
                      <span>Mention</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInsertHashtag}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[var(--bg-page)] hover:bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--color-coral)] transition cursor-pointer"
                      title="Add #hashtag"
                    >
                      <Hash className="w-3 h-3 text-[var(--color-coral)]" />
                      <span>Hashtag</span>
                    </button>
                  </div>
                  <span className={content.length > 4500 ? 'text-[var(--color-danger)] font-bold' : ''}>
                    {content.length}/5,000
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Hashtags &amp; Topics
                </label>
                <div className="relative">
                  <Hash className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#AI #Startups #Markets"
                    className="w-full bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/20 rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3.5 rounded-xl bg-[var(--bg-page-deep)]/70 border border-white/[0.08] min-h-[160px]">
              <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Live Formatted Preview
              </div>
              <div className="text-sm text-[var(--text-primary)] leading-relaxed break-words">
                <FormattedText text={content} />
              </div>
              {hashtags && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.06]">
                  {hashtags.split(' ').map((tag, idx) => (
                    <span key={idx} className="text-xs font-mono text-[var(--color-coral)]">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[var(--border-subtle)] shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-11 px-4 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page-deep)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || content.trim().length < 5}
              className="h-11 px-5 rounded-xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] disabled:opacity-50 text-[#07171C] font-semibold text-xs shadow-md shadow-[var(--color-coral)]/15 transition flex items-center space-x-1.5 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditDebateModal;
