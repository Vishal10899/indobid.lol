'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Heart,
  Bookmark,
  Share2,
  ArrowRight,
  ShieldCheck,
  Eye,
  Check,
  Edit3,
  MoreHorizontal,
  EyeOff,
} from 'lucide-react';
import { formatINR, formatUSD } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { FormattedText } from '@/components/FormattedText';
import { EditDebateModal } from '@/components/EditDebateModal';

export interface DebateCardProps {
  id: string;
  title: string;
  content: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  };
  authorId?: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorIsVerified?: boolean;
  authorRole?: string | null;
  originalContribution: number;
  totalVerifiedContribution: number;
  contributionCount: number;
  lastContributionAmount: number;
  minimumNextContribution: number;
  trendingScore: number;
  likeCount?: number;
  impressionCount?: number;
  isAnonymous?: boolean;
  isGhost?: boolean;
  isClickableProfile?: boolean;
  hashtags?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export function DebateCard(props: DebateCardProps) {
  const {
    id,
    title: initialTitle,
    content: initialContent,
    category,
    authorId,
    authorUsername,
    authorDisplayName,
    authorAvatarUrl,
    authorIsVerified,
    authorRole,
    totalVerifiedContribution,
    contributionCount,
    minimumNextContribution,
    likeCount = 0,
    impressionCount = 0,
    isAnonymous = false,
    isGhost = false,
    isClickableProfile = true,
    hashtags: initialHashtags,
    createdAt,
    updatedAt: initialUpdatedAt,
  } = props;

  const { user, openAuthModal } = useAuth();
  const [likes, setLikes] = useState(likeCount);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Author Edit & Hide State
  const [currentTitle, setCurrentTitle] = useState(initialTitle);
  const [currentContent, setCurrentContent] = useState(initialContent);
  const [currentHashtags, setCurrentHashtags] = useState(initialHashtags);
  const [isEdited, setIsEdited] = useState(
    Boolean(initialUpdatedAt && new Date(initialUpdatedAt).getTime() - new Date(createdAt).getTime() > 2000)
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCardHidden, setIsCardHidden] = useState(false);
  const [hiding, setHiding] = useState(false);

  const canEdit = Boolean(
    !isAnonymous &&
    user && (
      (authorId && user.id === authorId) ||
      (user.username && authorUsername && user.username.toLowerCase() === authorUsername.toLowerCase()) ||
      user.role === 'founder' ||
      user.role === 'admin' ||
      user.username === 'vishalchaudhary'
    )
  );

  const handleHidePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to hide this opinion from public feeds?')) return;

    setHiding(true);
    try {
      const res = await fetch(`/api/debates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setIsCardHidden(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to hide post');
      }
    } catch {
      alert('Network error hiding post');
    } finally {
      setHiding(false);
      setIsMenuOpen(false);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [likeRes, saveRes] = await Promise.all([
          fetch(`/api/debates/${id}/like`),
          fetch(`/api/debates/${id}/bookmark`),
        ]);
        if (likeRes.ok) {
          const lData = await likeRes.json();
          setLiked(lData.liked);
          if (typeof lData.likeCount === 'number') setLikes(lData.likeCount);
        }
        if (saveRes.ok) {
          const sData = await saveRes.json();
          setSaved(sData.saved);
        }
      } catch {}
    };
    checkStatus();

    fetch(`/api/debates/${id}/impression`, { method: 'POST' }).catch(() => {});
  }, [id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newLiked = !liked;
    setLiked(newLiked);
    setLikes((prev) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/debates/${id}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikes(data.likeCount);
      }
    } catch {
      setLiked(!newLiked);
      setLikes((prev) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      openAuthModal('login');
      return;
    }

    const newSaved = !saved;
    setSaved(newSaved);

    try {
      const res = await fetch(`/api/debates/${id}/bookmark`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
      }
    } catch {
      setSaved(!newSaved);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/debate/${id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleEditUpdated = (updated: { title: string; content: string; hashtags?: string | null; updatedAt: string }) => {
    setCurrentTitle(updated.title);
    setCurrentContent(updated.content);
    setCurrentHashtags(updated.hashtags);
    setIsEdited(true);
  };

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (isCardHidden) {
    return (
      <div className="p-3 bg-[var(--bg-surface)]/50 border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] italic flex items-center justify-between">
        <span>Opinion hidden by author.</span>
      </div>
    );
  }

  return (
    <article className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-card)]/30 p-3.5 sm:p-5 transition duration-150 space-y-2.5 sm:space-y-3 group w-full max-w-full min-w-0 overflow-hidden box-border">
      {/* Author Header */}
      <div className="flex items-center justify-between gap-2 min-w-0 w-full">
        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0 flex-1 overflow-hidden">
          <Avatar
            src={authorAvatarUrl}
            name={authorDisplayName}
            username={authorUsername}
            size="sm"
            isAnonymous={isAnonymous || isGhost}
          />

          <div className="flex items-center space-x-1 sm:space-x-1.5 text-xs truncate min-w-0 flex-1">
            {isAnonymous || isGhost || !isClickableProfile ? (
              <span className="font-bold text-[var(--text-primary)] shrink-0">
                {authorDisplayName || 'Anonymous'}
              </span>
            ) : (
              <Link
                href={`/profile/${authorUsername}`}
                className="font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {authorDisplayName}
              </Link>
            )}
            {!isAnonymous && !isGhost && authorIsVerified && (
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-lime)] shrink-0" />
            )}
            {!isAnonymous && !isGhost && (authorRole === 'founder' || authorRole === 'admin') && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--color-coral)]/15 text-[var(--color-coral)] border border-[var(--color-coral)]/30 shrink-0">
                Founder
              </span>
            )}
            {!isAnonymous && !isGhost && (
              <span className="text-[var(--text-muted)] truncate hidden sm:inline">@{authorUsername}</span>
            )}
            <span className="text-[var(--text-muted)] shrink-0">·</span>
            <span className="text-[var(--text-muted)] shrink-0 text-[11px]">
              {formattedDate}
              {isEdited && <span className="ml-1 text-[10px] opacity-75 font-normal">(edited)</span>}
            </span>
          </div>
        </div>

        {/* Action Header Items: Topic Pill & Author Overflow Menu */}
        <div className="flex items-center space-x-1.5 shrink-0 relative">
          <Link
            href={`/explore?category=${category.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--color-coral)] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition shrink-0"
          >
            {category.name}
          </Link>

          {canEdit && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-md hover:bg-[var(--bg-surface)] transition cursor-pointer"
                title="Author Options"
                aria-label="Author Options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-[var(--border-subtle)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="py-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        setIsEditModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] flex items-center space-x-2.5 cursor-pointer transition font-medium"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[var(--color-coral)]" />
                      <span>Edit post</span>
                    </button>

                    <button
                      onClick={handleHidePost}
                      disabled={hiding}
                      className="w-full px-3.5 py-2 text-left text-red-400 hover:bg-[var(--bg-card-hover)] flex items-center space-x-2.5 cursor-pointer transition disabled:opacity-50 font-medium"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{hiding ? 'Hiding...' : 'Hide / Move to Draft'}</span>
                    </button>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-1.5 text-left text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] flex items-center space-x-2 cursor-pointer transition text-[11px]"
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Opinion Title & Content */}
      <Link href={`/debate/${id}`} className="block space-y-1 sm:space-y-1.5 group w-full min-w-0">
        <h2 className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition leading-snug break-words overflow-hidden">
          {currentTitle}
        </h2>
        <div className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed font-normal break-words overflow-hidden">
          <FormattedText text={currentContent} />
        </div>

        {currentHashtags && (
          <div className="flex flex-wrap gap-1.5 pt-0.5 min-w-0">
            {currentHashtags.split(' ').map((tag, idx) => (
              <span key={idx} className="text-xs font-mono text-[var(--color-coral)] break-all">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </Link>

      {/* Social Engagement & Backing Row */}
      <div className="pt-1 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)] select-none w-full min-w-0">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-wrap gap-y-1">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center space-x-1 transition cursor-pointer p-1 -m-1 rounded-md hover:bg-[var(--bg-surface)] shrink-0 ${
              liked
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--text-muted)] hover:text-[var(--color-danger)]'
            }`}
            title="Like this opinion"
            aria-label="Like"
          >
            <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-[var(--color-danger)]' : ''}`} />
            <span className="font-medium text-[11px]">{likes}</span>
          </button>

          {/* Conviction / Backing Indicator */}
          {totalVerifiedContribution > 0 ? (
            <div className="flex items-center space-x-1 font-mono text-[11px] font-bold text-[var(--color-amber)] shrink-0" title="Total verified support">
              <span>{formatUSD(totalVerifiedContribution)} supported</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-[11px] font-medium text-[var(--text-secondary)] shrink-0" title="Open community opinion">
              <span className="px-1.5 py-0.2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px]">Open</span>
            </div>
          )}

          {/* Responses */}
          <Link
            href={`/debate/${id}`}
            className="flex items-center space-x-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0"
            title="Responses in conversation"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">{contributionCount}</span>
          </Link>

          {/* Impressions */}
          <div className="hidden xs:flex sm:flex items-center space-x-1 text-[var(--text-muted)] shrink-0" title="Verified impressions">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[11px]">{impressionCount > 999 ? `${(impressionCount / 1000).toFixed(1)}K` : impressionCount}</span>
          </div>
        </div>

        {/* Right Action Icons: Save & Share */}
        <div className="flex items-center space-x-1 shrink-0 ml-auto sm:ml-0">
          <button
            onClick={handleBookmark}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              saved
                ? 'text-[var(--color-amber)]'
                : 'text-[var(--text-muted)] hover:text-[var(--color-amber)] hover:bg-[var(--bg-surface)]'
            }`}
            title="Bookmark opinion"
            aria-label="Bookmark"
          >
            <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-[var(--color-amber)]' : ''}`} />
          </button>

          <button
            onClick={handleShare}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-coral)] hover:bg-[var(--bg-surface)] transition cursor-pointer"
            title="Copy share link"
            aria-label="Share"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-lime)]" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Support Action Strip */}
      <div className="pt-1.5 flex items-center justify-between gap-2 text-xs border-t border-[var(--border-subtle)]/60 w-full min-w-0">
        <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] shrink-0">
          {contributionCount} {contributionCount === 1 ? 'opinion' : 'opinions'}
        </span>

        <Link
          href={`/debate/${id}`}
          className="inline-flex items-center space-x-1 text-[11px] sm:text-xs font-bold text-[var(--color-coral)] hover:text-[var(--color-coral-bright)] hover:underline transition py-1 truncate min-w-0"
        >
          <span className="truncate">Support this opinion · {formatUSD(minimumNextContribution)} min</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
        </Link>
      </div>

      {/* Author Edit Modal */}
      {canEdit && (
        <EditDebateModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          debateId={id}
          initialTitle={currentTitle}
          initialContent={currentContent}
          initialHashtags={currentHashtags}
          authorUsername={authorUsername}
          onUpdated={handleEditUpdated}
        />
      )}
    </article>
  );
}

export default DebateCard;
