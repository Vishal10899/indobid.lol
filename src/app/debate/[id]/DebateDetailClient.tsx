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
import {
  ShieldCheck,
  MessageSquare,
  Share2,
  Flag,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Heart,
  Bookmark,
  Check,
  ArrowLeft,
  Coins,
  Edit3,
  MoreHorizontal,
  EyeOff,
} from 'lucide-react';
import { formatINR, formatUSD } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { FormattedText } from '@/components/FormattedText';
import { EditDebateModal } from '@/components/EditDebateModal';

interface Contribution {
  id: string;
  amount: number;
  content: string;
  sequence: number;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorIsVerified?: boolean;
  isAnonymous?: boolean;
  isGhost?: boolean;
  isClickableProfile?: boolean;
  createdAt: string;
}

interface DebateDetail {
  id: string;
  title: string;
  content: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  authorId?: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorIsVerified?: boolean;
  authorRole?: string | null;
  isAnonymous?: boolean;
  isGhost?: boolean;
  isClickableProfile?: boolean;
  originalContribution: number;
  totalVerifiedContribution: number;
  contributionCount: number;
  lastContributionAmount: number;
  minimumNextContribution: number;
  likeCount?: number;
  hashtags?: string | null;
  createdAt: string;
  updatedAt?: string;
  contributions: Contribution[];
  rewardBreakdown?: {
    creatorInitialPaise: number;
    creatorSelfContinuationsPaise: number;
    eligibleExternalBackingPaise: number;
    creatorRewardPaise: number;
  };
}

interface DebateDetailProps {
  initialDebate: DebateDetail;
}

export function DebateDetailClient({ initialDebate }: DebateDetailProps) {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const [debate, setDebate] = useState<DebateDetail>(initialDebate);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hiding, setHiding] = useState(false);

  const canEdit = Boolean(
    !debate.isAnonymous &&
    user && (
      (debate.authorId && user.id === debate.authorId) ||
      (user.username && debate.authorUsername && user.username.toLowerCase() === debate.authorUsername.toLowerCase()) ||
      user.role === 'founder' ||
      user.role === 'admin' ||
      user.username === 'vishalchaudhary'
    )
  );

  const handleHidePost = async () => {
    if (!confirm('Are you sure you want to hide this opinion from public feeds?')) return;

    setHiding(true);
    try {
      const res = await fetch(`/api/debates/${debate.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to hide opinion');
      }
    } catch {
      alert('Network error hiding opinion');
    } finally {
      setHiding(false);
      setIsMenuOpen(false);
    }
  };

  // Social interactions
  const [likes, setLikes] = useState(initialDebate.likeCount || 0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Continue Debate Form State
  const minPaise = debate.minimumNextContribution;
  const minRupees = Math.ceil(minPaise / 100);

  const [amountRupees, setAmountRupees] = useState(minRupees);
  const [replyText, setReplyText] = useState('');
  const [username, setUsername] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Check initial like, bookmark & impressions
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [lRes, bRes] = await Promise.all([
          fetch(`/api/debates/${debate.id}/like`),
          fetch(`/api/debates/${debate.id}/bookmark`),
        ]);
        if (lRes.ok) {
          const lData = await lRes.json();
          setLiked(lData.liked);
          if (typeof lData.likeCount === 'number') setLikes(lData.likeCount);
        }
        if (bRes.ok) {
          const bData = await bRes.json();
          setSaved(bData.saved);
        }
      } catch {}
    };
    checkStatus();

    fetch(`/api/debates/${debate.id}/impression`, { method: 'POST' }).catch(() => {});
  }, [debate.id]);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      if (user.email) setEmail(user.email);
    }
  }, [user]);

  // Sync minRupees if debate updates
  useEffect(() => {
    const nextMinRupees = Math.ceil(debate.minimumNextContribution / 100);
    setAmountRupees((prev) => Math.max(prev, nextMinRupees));
  }, [debate.minimumNextContribution]);

  const refreshDebate = async () => {
    try {
      const res = await fetch(`/api/debates/${debate.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.debate) {
          setDebate(data.debate);
        }
      }
    } catch (err) {
      console.error('Failed to refresh debate:', err);
    }
  };

  const handleLikeToggle = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikes((prev: number) => (newLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/debates/${debate.id}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikes(data.likeCount);
      }
    } catch {
      setLiked(!newLiked);
      setLikes((prev: number) => (newLiked ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleBookmarkToggle = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const newSaved = !saved;
    setSaved(newSaved);

    try {
      const res = await fetch(`/api/debates/${debate.id}/bookmark`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.saved);
      }
    } catch {
      setSaved(!newSaved);
    }
  };

  const handleContinueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const amountPaise = amountRupees * 100;

      // 1. Call continue debate API
      const res = await fetch(`/api/debates/${debate.id}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyText,
          amountPaise,
          authorUsername: isAnonymous ? undefined : username || undefined,
          isAnonymous,
          email: email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize contribution');
      }

      const { orderId, keyId, contributionId } = data;

      // 2. Razorpay Checkout
      if (typeof window !== 'undefined' && (window as any).Razorpay && keyId && keyId !== 'rzp_test_placeholder') {
        const options = {
          key: keyId,
          amount: amountPaise,
          currency: 'INR',
          name: 'IndoBid.lol',
          description: `Back Opinion (#${debate.contributionCount + 1})`,
          order_id: orderId,
          prefill: {
            name: isAnonymous ? 'Anonymous' : (username || 'Debater'),
            email: email || undefined,
          },
          theme: {
            color: '#D99176',
          },
          handler: async function (response: any) {
            setVerifying(true);
            try {
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  debateId: debate.id,
                  contributionId,
                  amountPaise,
                }),
              });

              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
                setReplyText('');
                setSuccessMsg('Your contribution was verified and published to the timeline.');
                await refreshDebate();
              } else {
                throw new Error(verifyData.error || 'Payment verification failed');
              }
            } catch (verErr) {
              setErrorMsg(verErr instanceof Error ? verErr.message : 'Payment verification failed');
            } finally {
              setVerifying(false);
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Dev/Mock Fallback
        setVerifying(true);
        const mockPayId = `rzp_mock_${Date.now()}`;
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_payment_id: mockPayId,
            razorpay_order_id: orderId,
            razorpay_signature: 'dev_mock_signature',
            debateId: debate.id,
            contributionId,
            amountPaise,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          setReplyText('');
          setSuccessMsg('Your contribution was verified and published to the timeline.');
          await refreshDebate();
        } else {
          throw new Error(verifyData.error || 'Failed to verify simulated payment in test environment');
        }
        setVerifying(false);
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error submitting contribution');
      setLoading(false);
      setVerifying(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/debates/${debate.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      });
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setReportModalOpen(false);
          setReportSuccess(false);
          setReportReason('');
        }, 1500);
      }
    } catch {
    } finally {
      setReportSubmitting(false);
    }
  };

  const presetAmounts = [
    { label: `Min $${minRupees}`, value: minRupees },
    { label: `$${minRupees + 3}`, value: minRupees + 3 },
    { label: `$${minRupees + 8}`, value: minRupees + 8 },
    { label: `$${minRupees + 23}`, value: minRupees + 23 },
  ];

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      {/* Mobile Top Navbar */}
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        {/* Center Main Thread */}
        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[var(--bg-page)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] p-3.5 sm:p-4 flex items-center justify-between min-w-0">
            <Link
              href="/"
              className="inline-flex items-center space-x-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to opinions</span>
            </Link>

            <span className="text-xs font-mono font-bold text-[var(--color-amber)]">
              {formatINR(debate.totalVerifiedContribution)} backed
            </span>
          </div>

          <div className="p-4 sm:p-5 space-y-6">
            {/* 1. Primary Opinion Section */}
            <article className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Avatar
                    src={debate.authorAvatarUrl}
                    name={debate.authorDisplayName}
                    username={debate.authorUsername}
                    size="md"
                    isAnonymous={debate.isAnonymous || debate.isGhost}
                  />

                  <div>
                    <div className="flex items-center space-x-1.5 text-xs">
                      {debate.isAnonymous || debate.isGhost || debate.isClickableProfile === false ? (
                        <span className="font-bold text-[var(--text-primary)]">
                          {debate.authorDisplayName || 'Anonymous'}
                        </span>
                      ) : (
                        <Link
                          href={`/profile/${debate.authorUsername}`}
                          className="font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition"
                        >
                          {debate.authorDisplayName}
                        </Link>
                      )}
                      {!debate.isAnonymous && !debate.isGhost && debate.authorIsVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-lime)] shrink-0" />
                      )}
                      {!debate.isAnonymous && !debate.isGhost && (debate.authorRole === 'founder' || debate.authorRole === 'admin') && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[var(--color-coral)]/15 text-[var(--color-coral)] border border-[var(--color-coral)]/30 shrink-0">
                          Founder
                        </span>
                      )}
                    </div>
                    {!debate.isAnonymous && !debate.isGhost && (
                      <span className="text-[11px] text-[var(--text-muted)]">@{debate.authorUsername}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 relative">
                  <span className="text-xs font-medium text-[var(--text-secondary)] px-2.5 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    {debate.category.name}
                  </span>

                  {canEdit && (
                    <div className="relative">
                      <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface)] transition cursor-pointer"
                        title="Author Options"
                        aria-label="Author Options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute right-0 top-full mt-1 w-36 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              setIsEditModalOpen(true);
                            }}
                            className="w-full px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] flex items-center space-x-2 cursor-pointer transition"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[var(--color-coral)]" />
                            <span>Edit Post</span>
                          </button>

                          <button
                            onClick={handleHidePost}
                            disabled={hiding}
                            className="w-full px-3 py-2 text-left text-red-400 hover:bg-[var(--bg-card-hover)] flex items-center space-x-2 cursor-pointer transition disabled:opacity-50"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>{hiding ? 'Hiding...' : 'Hide Post'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Full Argument */}
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-snug break-words">
                  {debate.title}
                </h1>
                <div className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-normal break-words">
                  <FormattedText text={debate.content} />
                </div>

                {debate.hashtags && (
                  <div className="flex flex-wrap gap-1.5 pt-1 min-w-0">
                    {debate.hashtags.split(' ').map((tag, idx) => (
                      <span key={idx} className="text-xs font-mono text-[var(--color-coral)] break-all">
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Statistics Grid (PRD Section 13) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                    Total Value
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-[var(--color-amber)] block">
                    {formatUSD(debate.totalVerifiedContribution)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                    Paid Participants
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-[var(--text-primary)] block">
                    {debate.contributionCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                    Arguments
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-[var(--text-primary)] block">
                    {debate.contributions.length}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                    Current Min
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-[var(--color-coral)] block">
                    {formatUSD(debate.minimumNextContribution)}
                  </span>
                </div>
              </div>

              {/* Verified Backing & 50/50 Revenue Split Note (PRD Section 16 & 48) */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-[var(--bg-page-deep)] text-[var(--color-amber)] shrink-0">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-[var(--text-primary)] block truncate">
                      {formatUSD(debate.totalVerifiedContribution)} Total Financial Conviction
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] block truncate">
                      50% Creator pool / 50% Platform protocol allocation
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[var(--color-coral)]/10 text-[var(--color-coral)] font-bold">
                    Start: {debate.originalContribution ? formatUSD(debate.originalContribution) : 'Free ($0)'}
                  </span>
                </div>
              </div>

              {/* Interaction Metrics Row */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] select-none">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleLikeToggle}
                    className={`flex items-center space-x-1.5 transition cursor-pointer ${
                      liked ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)] hover:text-[var(--color-danger)]'
                    }`}
                    title="Like this opinion"
                    aria-label="Like"
                  >
                    <Heart className={`w-4 h-4 ${liked ? 'fill-[var(--color-danger)]' : ''}`} />
                    <span className="font-bold">{likes}</span>
                  </button>

                  <div className="flex items-center space-x-1 font-mono font-bold text-[var(--color-amber)]" title="Total verified support">
                    <span>{formatUSD(debate.totalVerifiedContribution)} supported</span>
                  </div>

                  <div className="flex items-center space-x-1 text-[var(--text-muted)]" title="Responses in chain">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{debate.contributionCount} responses</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBookmarkToggle}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      saved ? 'text-[var(--color-amber)]' : 'text-[var(--text-muted)] hover:text-[var(--color-amber)]'
                    }`}
                    title="Bookmark"
                    aria-label="Bookmark"
                  >
                    <Bookmark className={`w-4 h-4 ${saved ? 'fill-[var(--color-amber)]' : ''}`} />
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--color-coral)] transition cursor-pointer"
                    title="Share link"
                    aria-label="Share"
                  >
                    {copied ? <Check className="w-4 h-4 text-[var(--color-lime)]" /> : <Share2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setReportModalOpen(true)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition cursor-pointer"
                    title="Report"
                    aria-label="Report"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>

            {/* 2. Conversation Timeline */}
            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Conversation Progression ({debate.contributions.length})
              </h2>

              <div className="space-y-3">
                {debate.contributions.map((c, index) => {
                  const isFirst = index === 0;
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-[var(--bg-surface)]/80 border border-[var(--border-subtle)] space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Avatar
                            src={c.authorAvatarUrl}
                            name={c.authorDisplayName}
                            username={c.authorUsername}
                            size="xs"
                            isAnonymous={c.isAnonymous || c.isGhost}
                          />

                          <span className="font-mono text-[11px] font-bold text-[var(--color-amber)] shrink-0">
                            #{c.sequence} · {formatUSD(c.amount)} supported
                          </span>
                          <span className="text-[var(--text-muted)]">·</span>
                          {c.isAnonymous || c.isGhost || c.isClickableProfile === false ? (
                            <span className="font-bold text-[var(--text-primary)] truncate">
                              {c.authorDisplayName || 'Anonymous'}
                            </span>
                          ) : (
                            <Link
                              href={`/profile/${c.authorUsername}`}
                              className="font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition truncate"
                            >
                              @{c.authorUsername}
                            </Link>
                          )}
                          {isFirst && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--color-coral)]/15 text-[var(--color-coral)] shrink-0">
                              Origin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                          {new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-normal break-words">
                        <FormattedText text={c.content} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. Continue / Back This Debate Composer */}
            <section className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Support & Continue Debate</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Put skin in the game to challenge or defend this opinion.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--text-muted)] block">Minimum Next Support</span>
                  <span className="text-xs font-mono font-bold text-[var(--color-amber)]">
                    {formatUSD(debate.minimumNextContribution)}
                  </span>
                </div>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {verifying ? (
                <div className="py-6 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-[var(--color-coral)] animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[var(--text-primary)]">Verifying Contribution...</p>
                </div>
              ) : (
                <form onSubmit={handleContinueSubmit} className="space-y-3">
                  <textarea
                    required
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your counter-argument, reasoning, or additional facts..."
                    maxLength={3000}
                    className="w-full bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/20 rounded-xl p-3 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition resize-none font-normal leading-relaxed"
                  />

                  {/* Anonymous Mode Toggle */}
                  <div className="flex items-center justify-between p-3 bg-[var(--bg-page-deep)]/80 rounded-xl border border-white/[0.08]">
                    <div>
                      <span className="text-xs font-semibold text-[var(--text-primary)] block">Anonymous</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Hide username on this response</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[var(--color-slate)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-coral)]"></div>
                    </label>
                  </div>

                  {/* Amount Presets and Stepper */}
                  <div className="bg-[var(--bg-page-deep)]/80 p-3.5 rounded-xl border border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--text-secondary)] text-[11px] uppercase tracking-wider">
                        Your Support Amount (USD)
                      </span>
                      <span className="font-mono font-bold text-[var(--color-amber)]">
                        Minimum ${minRupees}
                      </span>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {presetAmounts.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setAmountRupees(p.value)}
                          className={`py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer ${
                            amountRupees === p.value
                              ? 'bg-[var(--color-coral)] text-[#071B21] shadow-xs'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/[0.07]'
                          }`}
                        >
                          ${p.value}
                        </button>
                      ))}
                    </div>

                    {/* Stepper Input */}
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAmountRupees((prev) => Math.max(minRupees, prev - 1))}
                        disabled={amountRupees <= minRupees}
                        className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-white/[0.08] text-[var(--text-primary)] font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)] transition cursor-pointer flex items-center justify-center shrink-0"
                      >
                        −
                      </button>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-[var(--color-coral)]">$</span>
                        <input
                          type="number"
                          min={minRupees}
                          value={amountRupees}
                          onChange={(e) => setAmountRupees(Math.max(minRupees, parseInt(e.target.value || '0', 10)))}
                          className="w-full bg-[var(--bg-surface)] border border-white/[0.08] focus:border-[var(--color-coral)] rounded-xl pl-7 pr-3 py-1.5 text-xs font-bold text-[var(--text-primary)] font-mono focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setAmountRupees((prev) => prev + 1)}
                        className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-white/[0.08] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--bg-card-hover)] transition cursor-pointer flex items-center justify-center shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || amountRupees < minRupees}
                    className="w-full h-12 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#07171C] font-semibold text-sm rounded-xl shadow-md shadow-[var(--color-coral)]/15 hover:shadow-lg hover:shadow-[var(--color-coral)]/25 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>Support Opinion · ${amountRupees}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </section>
          </div>
        </main>

        {/* Right Sidebar */}
        <RightSidebar />
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] max-w-md w-full rounded-2xl p-6 shadow-2xl relative my-auto">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Report Debate</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              IndoBid is moderated for safety and compliance. Reports are reviewed by administrators.
            </p>

            {reportSuccess ? (
              <div className="p-3 bg-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Report submitted successfully.</span>
              </div>
            ) : (
              <form onSubmit={handleReport} className="space-y-3">
                <textarea
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Reason for report (e.g. spam, harassment, illegal content)..."
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />
      <CreateDebateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      {/* Author Edit Modal */}
      {canEdit && (
        <EditDebateModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          debateId={debate.id}
          initialTitle={debate.title}
          initialContent={debate.content}
          initialHashtags={debate.hashtags}
          authorUsername={debate.authorUsername}
          onUpdated={(updated) => {
            setDebate((prev) => ({
              ...prev,
              title: updated.title,
              content: updated.content,
              hashtags: updated.hashtags,
              updatedAt: updated.updatedAt,
              contributions: prev.contributions.map((c, idx) =>
                idx === 0 ? { ...c, content: updated.content } : c
              ),
            }));
          }}
        />
      )}
    </div>
  );
}

export default DebateDetailClient;
