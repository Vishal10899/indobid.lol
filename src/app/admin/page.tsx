'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Key,
  Mail,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  Layers,
  Sparkles,
  BarChart3,
  TrendingUp,
  CreditCard,
  MousePointerClick,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Tag,
  Users,
  Activity,
} from 'lucide-react';
import { PlatformIcon } from '@/components/PlatformIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { POPULAR_COUNTRIES, DEFAULT_COUNTRY_CODE, getCountryFlag, getCountryName } from '@/lib/countries';

interface AdminStats {
  listings: {
    total: number;
    active: number;
    pendingPayment: number;
    hidden: number;
    specialPromotional: number;
  };
  financials: {
    totalRevenueDollars: number;
    totalRevenueCents: number;
    totalVerifiedBidsDollars: number;
    totalVerifiedBidsCents: number;
    currency: string;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
    canceled: number;
  };
  bids: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    canceled: number;
  };
  users: {
    total: number;
  };
  traffic: {
    totalRecordedClicks: number;
    trafficModelNote: string;
  };
  visitors?: {
    liveActive: number;
    today: number;
    yesterday: number;
    last7Days: number;
    last30Days: number;
    allTime: number;
    totalPageViews: number;
  };
}

interface AdminListing {
  id: string;
  title: string;
  destinationUrl: string;
  canonicalUrl: string;
  destinationType: string;
  description: string;
  logoUrl: string | null;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  verifiedBid: number;
  clickCount: number;
  status: string;
  isSpecial: boolean;
  countryCode?: string | null;
  createdAt: string;
  bidReachedAt: string;
  _count: { bids: number; payments: number; clicks: number };
}

interface AdminPayment {
  id: string;
  listingId: string;
  listing: { id: string; title: string; canonicalUrl: string };
  provider: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const [adminEmail, setAdminEmail] = useState('vishalkumar75912@gmail.com');
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'payments' | 'special'>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [authError, setAuthError] = useState<string | null>(null);

  // Special Listing Form State
  const [specialUrl, setSpecialUrl] = useState('');
  const [specialTitle, setSpecialTitle] = useState('');
  const [specialDesc, setSpecialDesc] = useState('');
  const [specialCategory, setSpecialCategory] = useState('');
  const [specialCountry, setSpecialCountry] = useState(DEFAULT_COUNTRY_CODE);
  const [specialBidDollars, setSpecialBidDollars] = useState(50);
  const [specialSubmitting, setSpecialSubmitting] = useState(false);
  const [specialSuccessMsg, setSpecialSuccessMsg] = useState<string | null>(null);
  const [specialErrorMsg, setSpecialErrorMsg] = useState<string | null>(null);

  // Check active session on mount
  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      const res = await fetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          loadAdminData();
        }
      }
    } catch {
      // Not authenticated
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, listingsRes, paymentsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/listings'),
        fetch('/api/admin/payments'),
        fetch('/api/categories'),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.metrics || null);
      }
      if (listingsRes.ok) {
        const data = await listingsRes.json();
        setListings(data.listings || []);
      }
      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPayments(data.payments || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        const cats = data.categories || [];
        setCategories(cats);
        if (cats.length > 0 && !specialCategory) {
          setSpecialCategory(cats[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, secretKey: adminKey }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || 'Authentication failed. Access denied.');
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);
      setAdminKey('');
      loadAdminData();
    } catch (err) {
      console.error('Login request failed:', err);
      setAuthError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // Logout
    }
    setIsAuthenticated(false);
  };

  const handleToggleStatus = async (listingId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
    try {
      const res = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listingId, status: newStatus }),
      });

      if (res.ok) {
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l))
        );
        loadAdminData();
      }
    } catch (e) {
      console.error('Toggle status failed:', e);
    }
  };

  const handleCreateSpecialListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpecialSubmitting(true);
    setSpecialSuccessMsg(null);
    setSpecialErrorMsg(null);

    try {
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: specialUrl,
          title: specialTitle || undefined,
          description: specialDesc || undefined,
          categoryId: specialCategory,
          countryCode: specialCountry,
          verifiedBidDollars: specialBidDollars,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create promotional listing');
      }

      setSpecialSuccessMsg(
        `Successfully placed promotional listing for ${specialUrl} at $${specialBidDollars} rank. Zero fake payment records created.`
      );
      setSpecialUrl('');
      setSpecialTitle('');
      setSpecialDesc('');
      loadAdminData();
    } catch (err) {
      setSpecialErrorMsg(err instanceof Error ? err.message : 'Error creating special listing');
    } finally {
      setSpecialSubmitting(false);
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4 text-[var(--text-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-8 shadow-2xs">
          <div className="text-center mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Admin Moderation</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Authorized site administrators only</p>
          </div>

          {authError && (
            <div className="mb-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-lg text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Admin Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="vishalkumar75912@gmail.com"
                  required
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:outline-none transition"
                />
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Admin Secret Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter ADMIN_SECRET_KEY..."
                  required
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-amber-500 rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:outline-none transition"
                />
                <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition cursor-pointer mt-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-3 border-t border-[var(--border-color)] text-center">
            <Link href="/" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition">
              &larr; Return to public marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredListings = listings.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.canonicalUrl.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className="p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] flex items-center space-x-2">
                <span>Admin Operations & Moderation</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold border border-emerald-500/20">
                  vishalkumar75912@gmail.com
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">Production metrics, listing moderation, promotional placements</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <ThemeToggle />

            <button
              onClick={loadAdminData}
              className="px-2.5 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg border border-[var(--border-color)] text-xs flex items-center space-x-1 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-500/20 text-xs font-semibold cursor-pointer transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'overview'
                ? 'bg-[var(--text-primary)] text-[var(--bg-card)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Dashboard Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('listings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'listings'
                ? 'bg-[var(--text-primary)] text-[var(--bg-card)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Listings ({listings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'payments'
                ? 'bg-[var(--text-primary)] text-[var(--bg-card)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payments ({payments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('special')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'special'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Special Admin Listing</span>
          </button>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-4">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl shadow-2xs">
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold uppercase">Verified Revenue</div>
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                  ${stats.financials.totalRevenueDollars.toLocaleString()}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  From {stats.payments.successful} verified payments
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl shadow-2xs">
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold uppercase">Verified Bids Sum</div>
                <div className="text-xl sm:text-2xl font-extrabold text-amber-500 font-mono mt-1">
                  ${stats.financials.totalVerifiedBidsDollars.toLocaleString()}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  Across {stats.listings.active} active listings
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl shadow-2xs">
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold uppercase">Total Listings</div>
                <div className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] mt-1">
                  {stats.listings.total}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  {stats.listings.active} active · {stats.listings.pendingPayment} pending
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl shadow-2xs">
                <div className="text-[11px] text-[var(--text-secondary)] font-semibold uppercase">Outbound Clicks</div>
                <div className="text-xl sm:text-2xl font-extrabold text-sky-500 mt-1">
                  {stats.traffic.totalRecordedClicks}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  Deduplicated by IP hash
                </div>
              </div>
            </div>

            {/* Second Row: Payment Breakdown & Listing Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl space-y-2">
                <div className="text-xs font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center justify-between">
                  <span>Payment Ledger Status</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)]">Successful</div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.payments.successful}</div>
                  </div>
                  <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)]">Failed</div>
                    <div className="text-base font-bold text-rose-500 mt-0.5">{stats.payments.failed}</div>
                  </div>
                  <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)]">Canceled</div>
                    <div className="text-base font-bold text-[var(--text-secondary)] mt-0.5">{stats.payments.canceled}</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] pt-1">
                  Revenue is computed strictly from successful settled payments.
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl space-y-2">
                <div className="text-xs font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center justify-between">
                  <span>Listings & Promotional Status</span>
                  <Tag className="w-4 h-4 text-amber-500" />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)]">Active Public</div>
                    <div className="text-base font-bold text-[var(--text-primary)] mt-0.5">{stats.listings.active}</div>
                  </div>
                  <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)]">Pending Pay</div>
                    <div className="text-base font-bold text-amber-500 mt-0.5">{stats.listings.pendingPayment}</div>
                  </div>
                  <div className="bg-[var(--bg-surface)] p-2 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)]">Admin Special</div>
                    <div className="text-base font-bold text-purple-500 mt-0.5">{stats.listings.specialPromotional}</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] pt-1">
                  Pending listings are strictly invisible to the public leaderboard.
                </div>
              </div>
            </div>

            {/* Third Row: Real Production Visitor Analytics */}
            {stats.visitors && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-xl space-y-3">
                <div className="text-xs font-bold text-[var(--text-primary)] border-b border-[var(--border-color)] pb-2 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-emerald-500" />
                    <span>Real Production Visitor Analytics</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-semibold border border-emerald-500/20">
                    100% Genuine Browser Sessions
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Live Active (2m)</div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      <span>{stats.visitors.liveActive}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Today</div>
                    <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                      {stats.visitors.today}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Yesterday</div>
                    <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                      {stats.visitors.yesterday}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Last 7 Days</div>
                    <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                      {stats.visitors.last7Days}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">Last 30 Days</div>
                    <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">
                      {stats.visitors.last30Days}
                    </div>
                  </div>

                  <div className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-muted)] font-medium">All-Time Unique</div>
                    <div className="text-lg font-bold text-amber-500 mt-0.5">
                      {stats.visitors.allTime.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-[var(--text-muted)] pt-0.5">
                  Calculated exclusively from verified database browser sessions. Bot traffic, Render health checks (/api/health), and API polling are strictly excluded.
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SPECIAL ADMIN LISTING FORM */}
        {activeTab === 'special' && (
          <div className="max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                <span>Admin Special Placement</span>
              </div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Add Promotional / Special Listing</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Place a legitimate promotional listing at any rank without going through user payment. Creates <strong>zero fake payment/revenue records</strong>.
              </p>
            </div>

            {specialSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{specialSuccessMsg}</span>
              </div>
            )}

            {specialErrorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 rounded-lg text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{specialErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSpecialListing} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Destination URL <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={specialUrl}
                  onChange={(e) => setSpecialUrl(e.target.value)}
                  placeholder="https://partner-startup.com"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-2 px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Display Title
                  </label>
                  <input
                    type="text"
                    value={specialTitle}
                    onChange={(e) => setSpecialTitle(e.target.value)}
                    placeholder="e.g. Acme AI"
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-2 px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Category <span className="text-amber-500">*</span>
                  </label>
                  <select
                    value={specialCategory}
                    onChange={(e) => setSpecialCategory(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-2 px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                    Country <span className="text-amber-500">*</span>
                  </label>
                  <select
                    value={specialCountry}
                    onChange={(e) => setSpecialCountry(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-2 px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                  >
                    {POPULAR_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Displayed Ranking Bid ($ USD) <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-[var(--text-muted)]">$</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={specialBidDollars}
                    onChange={(e) => setSpecialBidDollars(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-2 pl-7 pr-3 text-xs text-[var(--text-primary)] font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  This sets the public leaderboard ranking position. It will NOT inflate verified revenue.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={specialDesc}
                  onChange={(e) => setSpecialDesc(e.target.value)}
                  placeholder="Official promotional partner..."
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg py-2 px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={specialSubmitting}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shadow-2xs transition cursor-pointer disabled:opacity-50"
              >
                {specialSubmitting ? 'Creating Special Listing...' : 'Activate Special Listing'}
              </button>
            </form>
          </div>
        )}

        {/* 3. LISTINGS TAB */}
        {activeTab === 'listings' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter listings..."
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-1.5">
                {['all', 'active', 'hidden', 'pending_payment'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                      statusFilter === status
                        ? 'bg-[var(--text-primary)] text-[var(--bg-card)] font-semibold'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Listings Table */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[var(--text-secondary)] border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Listing</th>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold">Country</th>
                      <th className="py-2.5 px-3 font-semibold">Verified Bid</th>
                      <th className="py-2.5 px-3 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold">Clicks</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredListings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No listings matching filter.
                        </td>
                      </tr>
                    ) : (
                      filteredListings.map((l) => (
                        <tr key={l.id} className="hover:bg-[var(--bg-surface)] transition">
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                                <PlatformIcon type={l.destinationType} className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 max-w-xs">
                                <div className="font-semibold text-[var(--text-primary)] truncate">{l.title}</div>
                                <div className="text-[10px] text-[var(--text-muted)] truncate">{l.canonicalUrl}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-[var(--text-secondary)]">
                            {l.category?.name || 'Uncategorized'}
                          </td>

                          <td className="py-3 px-3 text-[var(--text-secondary)]">
                            <span className="inline-flex items-center space-x-1 font-medium">
                              <span>{getCountryFlag(l.countryCode)}</span>
                              <span>{getCountryName(l.countryCode)}</span>
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            ${(l.verifiedBid / 100).toLocaleString()}
                          </td>

                          <td className="py-3 px-3">
                            {l.isSpecial ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                Admin Special
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                                Standard Paid
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono text-[var(--text-secondary)]">
                            {l.clickCount}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                                l.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : l.status === 'pending_payment'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {l.status.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleToggleStatus(l.id, l.status)}
                              className="px-2 py-1 bg-[var(--bg-surface)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded border border-[var(--border-color)] text-[11px] font-medium transition cursor-pointer"
                            >
                              {l.status === 'active' ? 'Hide' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--text-secondary)] border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Payment ID</th>
                    <th className="py-2.5 px-3 font-semibold">Listing</th>
                    <th className="py-2.5 px-3 font-semibold">Gateway</th>
                    <th className="py-2.5 px-3 font-semibold">Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Time (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        No payment records in ledger.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--bg-surface)] transition">
                        <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                          {p.providerPaymentId}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">
                          {p.listing?.title || 'Unknown'}
                        </td>
                        <td className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)] font-bold">
                          {p.provider}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${(p.amount / 100).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              p.status === 'succeeded'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-[var(--text-muted)]">
                          {new Date(p.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
