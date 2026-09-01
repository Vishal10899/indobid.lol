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
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';

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
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorIsVerified?: boolean;
  originalContribution: number;
  totalVerifiedContribution: number;
  contributionCount: number;
  lastContributionAmount: number;
  minimumNextContribution: number;
  trendingScore: number;
  likeCount?: number;
  impressionCount?: number;
  isAnonymous?: boolean;
  hashtags?: string | null;
  createdAt: string | Date;
}

export function DebateCard(props: DebateCardProps) {
  const {
    id,
    title,
    content,
    category,
    authorUsername,
    authorDisplayName,
    authorAvatarUrl,
    authorIsVerified,
    totalVerifiedContribution,
    contributionCount,
    minimumNextContribution,
    likeCount = 0,
    impressionCount = 0,
    isAnonymous = false,
    hashtags,
    createdAt,
  } = props;

  const { user, openAuthModal } = useAuth();
  const [likes, setLikes] = useState(likeCount);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

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
            isAnonymous={isAnonymous}
          />

          <div className="flex items-center space-x-1 sm:space-x-1.5 text-xs truncate min-w-0 flex-1">
            {isAnonymous ? (
              <span className="font-bold text-[var(--text-primary)] shrink-0">Anonymous</span>
            ) : (
              <Link
                href={`/profile/${authorUsername}`}
                className="font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {authorDisplayName}
              </Link>
            )}
            {!isAnonymous && authorIsVerified && (
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-lime)] shrink-0" />
            )}
            {!isAnonymous && (
              <span className="text-[var(--text-muted)] truncate hidden sm:inline">@{authorUsername}</span>
            )}
            <span className="text-[var(--text-muted)] shrink-0">·</span>
            <span className="text-[var(--text-muted)] shrink-0 text-[11px]">{formattedDate}</span>
          </div>
        </div>

        {/* Topic Pill */}
        <Link
          href={`/explore?category=${category.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--color-coral)] px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition shrink-0"
        >
          {category.name}
        </Link>
      </div>

      {/* Opinion Title & Content */}
      <Link href={`/debate/${id}`} className="block space-y-1 sm:space-y-1.5 group w-full min-w-0">
        <h2 className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition leading-snug break-words overflow-hidden">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed font-normal break-words overflow-hidden">
          {content}
        </p>

        {hashtags && (
          <div className="flex flex-wrap gap-1.5 pt-0.5 min-w-0">
            {hashtags.split(' ').map((tag, idx) => (
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

          {/* ₹ Backed (Prominent Amber Gold Conviction) */}
          <div className="flex items-center space-x-1 font-mono text-[11px] font-bold text-[var(--color-amber)] shrink-0" title="Total verified backed conviction">
            <span>{formatINR(totalVerifiedContribution)} backed</span>
          </div>

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

      {/* Back Opinion Action Strip */}
      <div className="pt-1.5 flex items-center justify-between gap-2 text-xs border-t border-[var(--border-subtle)]/60 w-full min-w-0">
        <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] shrink-0">
          {contributionCount} {contributionCount === 1 ? 'opinion' : 'opinions'}
        </span>

        <Link
          href={`/debate/${id}`}
          className="inline-flex items-center space-x-1 text-[11px] sm:text-xs font-bold text-[var(--color-coral)] hover:text-[var(--color-coral-bright)] hover:underline transition py-1 truncate min-w-0"
        >
          <span className="truncate">Back this opinion · {formatINR(minimumNextContribution)} min</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
        </Link>
      </div>
    </article>
  );
}

export default DebateCard;
