'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { RightSidebar } from '@/components/RightSidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { DebateCard } from '@/components/DebateCard';
import { CreateDebateModal } from '@/components/CreateDebateModal';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import {
  ShieldCheck,
  Calendar,
  UserPlus,
  UserCheck,
  Edit3,
  RefreshCw,
  X,
  Check,
  Camera,
  Trash2,
  Bookmark,
  MessageSquare,
  Coins,
  CreditCard,
  Building2,
  AlertCircle,
  CheckCircle2,
  Heart,
  Eye,
  ArrowRight,
  Lock,
  Wallet,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

interface PayoutAccountData {
  id?: string;
  accountType?: 'bank_account' | 'upi';
  accountHolderName?: string;
  maskedAccountNumber?: string;
  maskedIfsc?: string | null;
  status: 'not_connected' | 'pending_verification' | 'verified' | 'restricted';
  verifiedAt?: string | null;
  createdAt?: string | null;
}

interface CreatorEconomics {
  eligibleExternalBackingPaise: number;
  eligibleExternalBackingRupees: number;
  formattedEligibleExternalBacking: string;
  creatorEarningsPaise: number;
  creatorEarningsRupees: number;
  formattedCreatorEarnings: string;
  pendingEarningsPaise?: number;
  pendingEarningsRupees?: number;
  formattedPendingEarnings?: string;
  availableEarningsPaise?: number;
  availableEarningsRupees?: number;
  formattedAvailableEarnings?: string;
  paidEarningsPaise?: number;
  paidEarningsRupees?: number;
  formattedPaidEarnings?: string;
  creatorOwnStakePaise?: number;
  formattedCreatorOwnStake?: string;
  payoutAccount?: PayoutAccountData;
}

interface ProfileData {
  id: string | null;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  role?: string | null;
  rank: number;
  joinedDate: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  stats: {
    debatesStarted: number;
    contributionsMade: number;
    totalContributedPaise: number;
    totalContributedRupees: number;
  };
  creatorEconomics?: CreatorEconomics;
  debates: any[];
  contributions: any[];
}

function UserProfileContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawUsername = params.username as string;
  const username = decodeURIComponent(rawUsername);

  const { user, openAuthModal, refreshUser } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'debates' | 'contributions' | 'earnings' | 'saved'>('debates');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (tabParam === 'earnings' || tabParam === 'saved' || tabParam === 'contributions' || tabParam === 'debates') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Saved debates (for owner)
  const [savedDebates, setSavedDebates] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Payout Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutType, setPayoutType] = useState<'bank_account' | 'upi'>('bank_account');
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOwner = user?.username === username.toLowerCase();

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setIsFollowing(data.profile.isFollowing);
        setFollowersCount(data.profile.followersCount);
        setEditDisplayName(data.profile.displayName || '');
        setEditUsername(data.profile.username || '');
        setEditBio(data.profile.bio || '');
        setEditAvatarPreview(data.profile.avatarUrl || null);
        if (data.profile.creatorEconomics?.payoutAccount?.accountHolderName) {
          setHolderName(data.profile.creatorEconomics.payoutAccount.accountHolderName);
        }
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  useEffect(() => {
    if (isOwner && activeTab === 'saved') {
      const fetchSaved = async () => {
        setSavedLoading(true);
        try {
          const res = await fetch('/api/saved');
          if (res.ok) {
            const data = await res.json();
            setSavedDebates(data.items || []);
          }
        } catch {}
        finally {
          setSavedLoading(false);
        }
      };
      fetchSaved();
    }
  }, [isOwner, activeTab]);

  const handleFollowToggle = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowersCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
        setFollowersCount(data.followersCount);
      }
    } catch {
      setIsFollowing(!nextState);
      setFollowersCount((prev) => (nextState ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WebP, GIF)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image size must be 2MB or less');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditAvatarPreview(reader.result as string);
      setAvatarError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setAvatarError(null);

    try {
      if (editAvatarPreview !== profile?.avatarUrl) {
        if (editAvatarPreview) {
          const avatarRes = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: editAvatarPreview }),
          });
          if (!avatarRes.ok) {
            const errData = await avatarRes.json();
            throw new Error(errData.error || 'Failed to upload profile photo');
          }
        } else {
          await fetch('/api/auth/avatar', { method: 'DELETE' });
        }
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          bio: editBio.trim(),
        }),
      });

      if (res.ok) {
        await refreshUser();
        await fetchProfile();
        setIsEditModalOpen(false);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update profile');
      }
    } catch (e: any) {
      setAvatarError(e.message || 'Error saving profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePayoutAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);

    try {
      const res = await fetch('/api/profile/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: payoutType,
          accountHolderName: holderName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifscCode.trim(),
          upiId: upiId.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPayoutSuccess('Payout account verified and connected securely.');
        await fetchProfile();
        setTimeout(() => {
          setIsPayoutModalOpen(false);
          setPayoutSuccess(null);
        }, 1200);
      } else {
        throw new Error(data.error || 'Failed to connect payout account');
      }
    } catch (err: any) {
      setPayoutError(err.message || 'Failed to save payout account');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleDisconnectPayout = async () => {
    if (!confirm('Are you sure you want to disconnect this payout account?')) return;
    setSavingPayout(true);
    try {
      const res = await fetch('/api/profile/payout-account', { method: 'DELETE' });
      if (res.ok) {
        await fetchProfile();
        setIsPayoutModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPayout(false);
    }
  };

  const payoutAccount = profile?.creatorEconomics?.payoutAccount;
  const isPayoutConnected = payoutAccount && payoutAccount.status === 'verified';

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)] w-full flex flex-col">
      <div className="lg:hidden w-full shrink-0">
        <Navbar onOpenCreate={() => setIsCreateModalOpen(true)} />
      </div>

      <div className="w-full max-w-7xl mx-auto flex justify-center min-w-0 flex-1 lg:h-full lg:overflow-hidden">
        <Sidebar onOpenCreate={() => setIsCreateModalOpen(true)} />

        <main className="w-full min-w-0 flex-1 max-w-2xl min-h-screen lg:min-h-0 lg:h-full lg:overflow-y-auto border-r-0 lg:border-r border-[var(--border-subtle)] pb-24 lg:pb-12 scrollbar-none">
          {loading ? (
            <div className="py-32 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[var(--color-coral)] animate-spin mx-auto" />
              <p className="text-xs text-[var(--text-secondary)]">Loading debater profile...</p>
            </div>
          ) : profile ? (
            <div className="w-full min-w-0">
              {/* 1. PROFILE HEADER */}
              <div className="p-5 sm:p-7 border-b border-[var(--border-subtle)] space-y-5">
                <div className="flex items-start justify-between">
                  <div className="relative group">
                    <Avatar
                      src={profile.avatarUrl}
                      name={profile.displayName}
                      username={profile.username}
                      size="xl"
                    />
                    {isOwner && (
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[var(--color-coral)] text-[#071B21] shadow hover:scale-105 transition cursor-pointer"
                        title="Change profile photo"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isOwner ? (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[var(--color-coral)]" />
                      <span>Edit Profile</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleFollowToggle}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm ${
                        isFollowing
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-red-500/40 hover:text-red-400'
                          : 'bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21]'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                      {profile.displayName}
                    </h1>
                    {profile.isVerified && (
                      <ShieldCheck className="w-4 h-4 text-[var(--color-lime)] shrink-0" />
                    )}
                    {(profile.role === 'founder' || profile.role === 'admin' || profile.username === 'vishalchaudhary' || profile.username === 'vishalkumar') && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-coral)]/15 text-[var(--color-coral)] border border-[var(--color-coral)]/30 shrink-0">
                        Founder · IndoBid
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] font-mono">@{profile.username}</p>
                </div>

                {profile.bio && (
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-normal">
                    {profile.bio}
                  </p>
                )}

                {/* Follower Stats & Activity */}
                <div className="flex flex-wrap items-center gap-3.5 sm:gap-5 text-xs text-[var(--text-secondary)] pt-1">
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">{followersCount}</span>{' '}
                    <span className="text-[var(--text-muted)]">Followers</span>
                  </div>
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">{profile.followingCount}</span>{' '}
                    <span className="text-[var(--text-muted)]">Following</span>
                  </div>
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">{profile.stats.debatesStarted}</span>{' '}
                    <span className="text-[var(--text-muted)]">Opinions</span>
                  </div>
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">{profile.stats.contributionsMade}</span>{' '}
                    <span className="text-[var(--text-muted)]">Responses</span>
                  </div>
                  <div>
                    <span className="font-bold font-mono text-[var(--color-amber)]">{formatINR(profile.stats.totalContributedPaise)}</span>{' '}
                    <span className="text-[var(--text-muted)]">Backed</span>
                  </div>
                  {profile.joinedDate && (
                    <div className="hidden sm:flex items-center space-x-1 text-[var(--text-muted)]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Joined{' '}
                        {new Date(profile.joinedDate).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. CREATOR ECONOMY SUMMARY CARD (Owner Control Center) */}
                {isOwner && profile.creatorEconomics && (
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-[var(--bg-page-deep)] text-[var(--color-amber)]">
                          <Coins className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          Creator Earnings
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--color-lime)]/15 text-[var(--color-lime)] font-bold">
                        10% Creator Share
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
                      <div>
                        <span className="text-2xl sm:text-3xl font-black font-mono text-[var(--color-amber)] tracking-tight block">
                          {profile.creatorEconomics.formattedCreatorEarnings}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Lifetime earned from {profile.stats.debatesStarted} opinions
                        </span>
                      </div>

                      <button
                        onClick={() => setIsPayoutModalOpen(true)}
                        className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{isPayoutConnected ? 'Manage Payout' : 'Set Up Payout'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="bg-[var(--bg-page-deep)] p-3 rounded-xl border border-[var(--border-subtle)]">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                          Available Balance
                        </span>
                        <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                          {profile.creatorEconomics.formattedAvailableEarnings || profile.creatorEconomics.formattedCreatorEarnings}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">Matured earnings</span>
                      </div>

                      <div className="bg-[var(--bg-page-deep)] p-3 rounded-xl border border-[var(--border-subtle)]">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                          Pending Balance
                        </span>
                        <span className="text-sm sm:text-base font-bold text-[var(--text-secondary)] font-mono mt-0.5 block">
                          {profile.creatorEconomics.formattedPendingEarnings || '₹0'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">In settlement</span>
                      </div>

                      <div className="bg-[var(--bg-page-deep)] p-3 rounded-xl border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                          Community Backed
                        </span>
                        <span className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-mono mt-0.5 block">
                          {profile.creatorEconomics.formattedEligibleExternalBacking}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">On my opinions</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. PROFILE TABS */}
              <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-page)] overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveTab('debates')}
                  className={`flex-1 min-w-[100px] py-3.5 text-xs font-bold text-center transition cursor-pointer relative whitespace-nowrap ${
                    activeTab === 'debates'
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <span>Opinions ({profile.debates.length})</span>
                  {activeTab === 'debates' && (
                    <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('contributions')}
                  className={`flex-1 min-w-[100px] py-3.5 text-xs font-bold text-center transition cursor-pointer relative whitespace-nowrap ${
                    activeTab === 'contributions'
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <span>Responses ({profile.contributions.length})</span>
                  {activeTab === 'contributions' && (
                    <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                  )}
                </button>

                {isOwner && (
                  <button
                    onClick={() => setActiveTab('earnings')}
                    className={`flex-1 min-w-[120px] py-3.5 text-xs font-bold text-center transition cursor-pointer relative whitespace-nowrap ${
                      activeTab === 'earnings'
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <span>Earnings & Payouts</span>
                    {activeTab === 'earnings' && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                    )}
                  </button>
                )}

                {isOwner && (
                  <button
                    onClick={() => setActiveTab('saved')}
                    className={`flex-1 min-w-[100px] py-3.5 text-xs font-bold text-center transition cursor-pointer relative whitespace-nowrap ${
                      activeTab === 'saved'
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <span>Saved Bookmarks</span>
                    {activeTab === 'saved' && (
                      <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--color-coral)] rounded-full" />
                    )}
                  </button>
                )}
              </div>

              {/* 4. TAB CONTENTS */}
              <div className="divide-y divide-[var(--border-subtle)]">
                {activeTab === 'debates' ? (
                  /* MY POSTS / OPINIONS LIST */
                  profile.debates.length > 0 ? (
                    profile.debates.map((d) => (
                      <div key={d.id} className="p-4 sm:p-5 hover:bg-[var(--bg-card)]/20 transition space-y-2.5">
                        <Link href={`/debate/${d.id}`} className="block space-y-1.5 group">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-medium text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                              {d.category?.name || 'Opinion'}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {new Date(d.createdAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition leading-snug">
                            {d.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {d.content}
                          </p>
                        </Link>

                        {/* Metrics Row: Likes, Impressions, Backed, You Earned */}
                        <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs select-none">
                          <div className="flex items-center space-x-4 text-[var(--text-muted)]">
                            <div className="flex items-center space-x-1" title="Likes">
                              <Heart className="w-3.5 h-3.5" />
                              <span className="font-mono text-[11px]">{d.likeCount || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1" title="Impressions">
                              <Eye className="w-3.5 h-3.5" />
                              <span className="font-mono text-[11px]">{d.impressionCount || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-[var(--color-amber)] font-mono font-bold" title="Total Backed">
                              <span>{formatINR(d.totalVerifiedContribution)} backed</span>
                            </div>
                          </div>

                          {isOwner && d.creatorEarnedPaise > 0 && (
                            <span className="text-[11px] font-mono font-bold text-[var(--color-coral)] bg-[var(--color-coral)]/10 px-2 py-0.5 rounded-md">
                              You earned {formatINR(d.creatorEarnedPaise)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center text-xs text-[var(--text-muted)] p-6">
                      No published opinions from @{profile.username} yet.
                    </div>
                  )
                ) : activeTab === 'contributions' ? (
                  /* RESPONSES TAB */
                  profile.contributions.length > 0 ? (
                    profile.contributions.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 sm:p-5 hover:bg-[var(--bg-card)]/30 transition space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--text-primary)]">
                            Contributed to &ldquo;{c.debateTitle}&rdquo;
                          </span>
                          <span className="font-mono font-bold text-[var(--color-amber)]">
                            {formatINR(c.amount)} backed
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {c.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center text-xs text-[var(--text-muted)] p-6">
                      No responses yet.
                    </div>
                  )
                ) : activeTab === 'earnings' ? (
                  /* EARNINGS & PAYOUT SECTION */
                  <div className="p-4 sm:p-6 space-y-6">
                    {/* Payout Account Status Card */}
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 rounded-xl bg-[var(--bg-page-deep)] text-[var(--color-coral)]">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">Payout Account</h4>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Where your verified creator earnings will be disbursed.
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPayoutConnected
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-[var(--bg-page-deep)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          {isPayoutConnected ? '✓ Verified' : 'Not Connected'}
                        </span>
                      </div>

                      {isPayoutConnected ? (
                        <div className="p-3.5 bg-[var(--bg-page-deep)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                                {payoutAccount?.accountType === 'upi' ? 'UPI ID' : 'Bank Account'}
                              </span>
                              <span className="text-xs font-mono text-[var(--text-secondary)]">
                                {payoutAccount?.maskedAccountNumber}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              Account Holder: <span className="text-[var(--text-secondary)] font-medium">{payoutAccount?.accountHolderName}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setIsPayoutModalOpen(true)}
                            className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition cursor-pointer"
                          >
                            Manage Payout Account
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-[var(--bg-page-deep)] rounded-xl border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <p className="text-xs text-[var(--text-secondary)]">
                            Add a payout account to receive your creator earnings.
                          </p>
                          <button
                            onClick={() => setIsPayoutModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] text-xs font-bold transition cursor-pointer shrink-0"
                          >
                            Set Up Payout
                          </button>
                        </div>
                      )}

                      <p className="text-[11px] text-[var(--text-muted)]">
                        Your earnings are tracked securely. Payout availability will appear once your payout account is verified.
                      </p>
                    </div>

                    {/* Opinions Backing Ledger */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Opinions Backing Ledger ({profile.debates.length})
                      </h4>

                      {profile.debates.length > 0 ? (
                        profile.debates.map((d) => {
                          const externalBacking = Math.max(0, d.totalVerifiedContribution - (d.originalContribution || 1000));
                          const estReward = Math.floor(externalBacking * 0.10);
                          return (
                            <Link
                              key={d.id}
                              href={`/debate/${d.id}`}
                              className="block p-4 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] transition space-y-2 group"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h5 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--color-coral)] transition line-clamp-1">
                                  {d.title}
                                </h5>
                                <span className="text-[10px] font-mono font-bold text-[var(--color-amber)] shrink-0">
                                  {formatINR(d.totalVerifiedContribution)} backed
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]/60">
                                <span>{d.contributionCount} responses</span>
                                <span>Starting Stake: {formatINR(d.originalContribution || 1000)}</span>
                                <span className="font-bold text-[var(--color-coral)]">
                                  Creator Share (10%): {formatINR(estReward)}
                                </span>
                              </div>
                            </Link>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                          No opinions created yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* SAVED BOOKMARKS TAB */
                  savedLoading ? (
                    <div className="py-20 text-center space-y-3">
                      <RefreshCw className="w-7 h-7 text-[var(--color-coral)] animate-spin mx-auto" />
                      <p className="text-xs text-[var(--text-secondary)]">Loading saved bookmarks...</p>
                    </div>
                  ) : savedDebates.length > 0 ? (
                    savedDebates.map((d) => <DebateCard key={d.id} {...d} />)
                  ) : (
                    <div className="py-20 text-center text-xs text-[var(--text-muted)] p-6">
                      No saved bookmarks yet.
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="py-32 text-center text-xs text-[var(--text-muted)]">
              Debater profile not found.
            </div>
          )}
        </main>

        <RightSidebar />
      </div>

      {/* 5. EDIT PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto w-full">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] max-w-md w-full rounded-t-3xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl relative my-0 sm:my-auto max-h-[92vh] overflow-y-auto min-w-0">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-page-deep)] transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Edit Profile</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Update your public debater photo, display name, and bio.
            </p>

            {avatarError && (
              <div className="mb-3 p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl">
                {avatarError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Photo Area */}
              <div className="flex items-center space-x-3.5 p-3 rounded-xl bg-[var(--bg-page-deep)] border border-[var(--border-subtle)]">
                <Avatar
                  src={editAvatarPreview}
                  name={editDisplayName || profile?.displayName}
                  username={profile?.username}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[var(--text-primary)]">Profile Photo</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Max 2MB (PNG, JPG, WebP, GIF)</div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-bold bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg transition inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-[var(--color-coral)]" />
                    <span>{editAvatarPreview ? 'Change' : 'Upload'}</span>
                  </button>
                  {editAvatarPreview && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarPreview(null)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition cursor-pointer"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  maxLength={40}
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={300}
                  placeholder="Share your background, conviction, or areas of expertise..."
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2">
                  Theme & Appearance
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 text-xs font-bold transition cursor-pointer ${
                      themeMode === 'dark'
                        ? 'bg-[var(--bg-elevated)] border-[var(--color-coral)] text-[var(--color-coral)] shadow-sm'
                        : 'bg-[var(--bg-page-deep)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span className="text-[11px]">Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 text-xs font-bold transition cursor-pointer ${
                      themeMode === 'light'
                        ? 'bg-[var(--bg-elevated)] border-[var(--color-coral)] text-[var(--color-coral)] shadow-sm'
                        : 'bg-[var(--bg-page-deep)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span className="text-[11px]">Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center space-y-1 text-xs font-bold transition cursor-pointer ${
                      themeMode === 'system'
                        ? 'bg-[var(--bg-elevated)] border-[var(--color-coral)] text-[var(--color-coral)] shadow-sm'
                        : 'bg-[var(--bg-page-deep)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Laptop className="w-4 h-4" />
                    <span className="text-[11px]">System</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. PAYOUT ACCOUNT MODAL */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto w-full">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] max-w-md w-full rounded-t-3xl sm:rounded-2xl p-5 sm:p-7 shadow-2xl relative my-0 sm:my-auto max-h-[92vh] overflow-y-auto min-w-0">
            <button
              onClick={() => setIsPayoutModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-page-deep)] transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2 text-[var(--color-coral)] mb-1">
              <Building2 className="w-5 h-5" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Payout Account</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Configure your bank account or UPI ID to receive creator earnings.
            </p>

            {payoutError && (
              <div className="mb-3 p-2.5 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payoutError}</span>
              </div>
            )}

            {payoutSuccess && (
              <div className="mb-3 p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{payoutSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSavePayoutAccount} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-page-deep)] rounded-xl border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setPayoutType('bank_account')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    payoutType === 'bank_account'
                      ? 'bg-[var(--color-coral)] text-[#071B21]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutType('upi')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    payoutType === 'upi'
                      ? 'bg-[var(--color-coral)] text-[#071B21]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  UPI ID
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name as on bank records"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              {payoutType === 'bank_account' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1234567890"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-mono uppercase"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                    UPI ID (VPA)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. name@okhdfcbank"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-mono"
                  />
                </div>
              )}

              <div className="p-3 bg-[var(--bg-page-deep)] rounded-xl border border-[var(--border-subtle)] flex items-start space-x-2 text-[11px] text-[var(--text-muted)]">
                <Lock className="w-3.5 h-3.5 text-[var(--color-coral)] shrink-0 mt-0.5" />
                <p>
                  <strong>Security Guarantee:</strong> Credentials are encrypted and masked before saving. IndoBid never stores raw bank passwords or sensitive PINs.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="submit"
                  disabled={savingPayout}
                  className="w-full py-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingPayout ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying & Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save & Verify Payout Target</span>
                    </>
                  )}
                </button>

                {isPayoutConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnectPayout}
                    disabled={savingPayout}
                    className="w-full py-2 text-xs font-bold text-red-400 hover:text-red-300 transition cursor-pointer"
                  >
                    Disconnect Payout Account
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav onOpenCreate={() => setIsCreateModalOpen(true)} />
      <CreateDebateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)]" />}>
      <UserProfileContent />
    </Suspense>
  );
}
