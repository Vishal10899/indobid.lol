'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Key,
  Mail,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  BarChart3,
  Flame,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Tag,
  Users,
  MessageSquare,
  Coins,
  Eye,
  EyeOff,
  Flag,
  UserX,
  UserCheck,
  TrendingDown,
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  X,
  Play,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { formatINR } from '@/lib/money';

interface AdminStats {
  debates: {
    total: number;
    active: number;
    todayNew?: number;
    pendingPayment: number;
    hidden: number;
    removed: number;
  };
  contributions: {
    total: number;
    verified: number;
    pending: number;
    failed: number;
    canceled: number;
  };
  financials: {
    currency: string;
    totalRevenuePaise: number;
    totalRevenueRupees: number;
    todayRevenueRupees: number;
    weekRevenueRupees: number;
    monthRevenueRupees: number;
    totalCreatorRewardsPaise?: number;
    totalCreatorRewardsRupees?: number;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
    canceled: number;
    pending: number;
  };
  users: {
    total: number;
    todayNew?: number;
  };
  moderation: {
    pendingReports: number;
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

interface AdminDebate {
  id: string;
  title: string;
  content: string;
  authorUsername: string;
  originalContribution: number;
  totalVerifiedContribution: number;
  contributionCount: number;
  status: string;
  trendingScore?: number;
  reportCount?: number;
  createdAt: string;
  category: { name: string };
  _count?: { contributions: number; payments: number; reports: number };
}

interface AdminReport {
  id: string;
  debateId: string;
  reason: string;
  status: string;
  createdAt: string;
  debate: { id: string; title: string; authorUsername: string; status: string };
}

interface AdminPayment {
  id: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string | null;
  createdAt: string;
}

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  bio: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  role: string;
  rank: number;
  createdAt: string;
  _count: { debates: number; contributions: number; followers: number; following: number };
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'debates' | 'users' | 'reports' | 'payments' | 'creators' | 'indobid-daily'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [debates, setDebates] = useState<AdminDebate[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [creatorEconomy, setCreatorEconomy] = useState<any>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [debateSearch, setDebateSearch] = useState('');
  const [debateStatusFilter, setDebateStatusFilter] = useState('all');
  const [deleteConfirmDebate, setDeleteConfirmDebate] = useState<AdminDebate | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // IndoBid Daily Engine State
  const [dailyData, setDailyData] = useState<any>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyRunning, setDailyRunning] = useState(false);
  const [dailyDryRun, setDailyDryRun] = useState(true);
  const [dailyForce, setDailyForce] = useState(false);
  const [dailyRunResult, setDailyRunResult] = useState<any>(null);
  const [dailyMessage, setDailyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Founder Post Creation State
  const [founderPostTitle, setFounderPostTitle] = useState('');
  const [founderPostContent, setFounderPostContent] = useState('');
  const [founderCategorySlug, setFounderCategorySlug] = useState('ai');
  const [founderHashtags, setFounderHashtags] = useState('');
  const [founderIsAnonymous, setFounderIsAnonymous] = useState(false);
  const [founderPostLoading, setFounderPostLoading] = useState(false);
  const [founderPostSuccess, setFounderPostSuccess] = useState<string | null>(null);
  const [founderPostError, setFounderPostError] = useState<string | null>(null);

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            loadAdminData();
          }
        }
      } catch {}
    };
    checkSession();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, debatesRes, usersRes, reportsRes, paymentsRes, creatorRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/debates'),
        fetch('/api/admin/users'),
        fetch('/api/admin/reports?status=all'),
        fetch('/api/admin/payments'),
        fetch('/api/admin/creator-economy'),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.metrics || null);
      }
      if (debatesRes.ok) {
        const data = await debatesRes.json();
        setDebates(data.debates || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (creatorRes.ok) {
        const data = await creatorRes.json();
        setCreatorEconomy(data);
      }
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data.reports || []);
      }
      if (paymentsRes.ok) {
        const data = await paymentsRes.json();
        setPayments(data.payments || []);
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
      console.error('Login error:', err);
      setAuthError('Connection error.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {}
    setIsAuthenticated(false);
  };

  const handleCreateFounderPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFounderPostLoading(true);
    setFounderPostError(null);
    setFounderPostSuccess(null);

    try {
      const text = founderPostContent.trim();
      if (!text || text.length < 5) {
        throw new Error('Post content must be at least 5 characters');
      }

      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      let title = founderPostTitle.trim() || lines[0] || text;
      if (title.length < 5) title = text.substring(0, 180).trim();

      const res = await fetch('/api/admin/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: text,
          categorySlug: founderCategorySlug,
          hashtags: founderHashtags.trim() || undefined,
          isAnonymous: founderIsAnonymous,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to publish Founder post');
      }

      setFounderPostSuccess(`Post "${data.debate.title}" published directly as Founder to public feed!`);
      setFounderPostTitle('');
      setFounderPostContent('');
      setFounderHashtags('');
      loadAdminData();
    } catch (err) {
      setFounderPostError(err instanceof Error ? err.message : 'Failed to publish Founder post');
    } finally {
      setFounderPostLoading(false);
    }
  };

  const handleToggleDebateStatus = async (debateId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'hidden' : 'active';
    try {
      const res = await fetch('/api/admin/debates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: debateId, status: newStatus }),
      });

      if (res.ok) {
        setDebates((prev) =>
          prev.map((d) => (d.id === debateId ? { ...d, status: newStatus } : d))
        );
        loadAdminData();
      }
    } catch (e) {
      console.error('Toggle status error:', e);
    }
  };

  const handleRankDownDebate = async (debateId: string, penalty = 50) => {
    setActionLoadingId(debateId);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/debates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: debateId, action: 'rankdown', penalty }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to rank down post');
      }
      setDebates((prev) =>
        prev.map((d) =>
          d.id === debateId
            ? { ...d, trendingScore: data.debate?.trendingScore ?? (d.trendingScore || 0) - penalty }
            : d
        )
      );
      setActionMessage({
        type: 'success',
        text: `Post ranked down by ${penalty} points (new score: ${data.debate?.trendingScore})`,
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Rank down error:', err);
      setActionMessage({ type: 'error', text: err.message || 'Failed to rank down post' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetRankDebate = async (debateId: string) => {
    setActionLoadingId(debateId);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/debates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: debateId, action: 'reset_rank' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset post ranking');
      }
      setDebates((prev) =>
        prev.map((d) =>
          d.id === debateId ? { ...d, trendingScore: data.debate?.trendingScore ?? 0 } : d
        )
      );
      setActionMessage({
        type: 'success',
        text: `Post ranking restored to natural organic score (${data.debate?.trendingScore})`,
      });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Reset rank error:', err);
      setActionMessage({ type: 'error', text: err.message || 'Failed to reset post rank' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteDebate = async (debateId: string) => {
    setActionLoadingId(debateId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/debates?id=${debateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete post');
      }
      setDebates((prev) => prev.filter((d) => d.id !== debateId));
      setDeleteConfirmDebate(null);
      setActionMessage({ type: 'success', text: 'Post permanently deleted from platform.' });
      loadAdminData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      console.error('Delete debate error:', err);
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete post' });
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleToggleUserSuspension = async (userId: string, isSuspended: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isSuspended: !isSuspended }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isSuspended: !isSuspended } : u))
        );
      }
    } catch (e) {
      console.error('Toggle user suspension error:', e);
    }
  };

  const handleToggleUserVerification = async (userId: string, isVerified: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isVerified: !isVerified }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isVerified: !isVerified } : u))
        );
      }
    } catch (e) {
      console.error('Toggle user verification error:', e);
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status } : r))
        );
        loadAdminData();
      }
    } catch (e) {
      console.error('Report status error:', e);
    }
  };

  const loadDailyData = async () => {
    setDailyLoading(true);
    try {
      const res = await fetch('/api/admin/indobid-daily');
      if (res.ok) {
        const data = await res.json();
        setDailyData(data);
      }
    } catch (err: any) {
      console.error('Failed to load IndoBid Daily status:', err);
    } finally {
      setDailyLoading(false);
    }
  };

  const handleTriggerDailyRun = async () => {
    setDailyRunning(true);
    setDailyMessage(null);
    setDailyRunResult(null);
    try {
      const res = await fetch('/api/admin/indobid-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: dailyDryRun,
          force: dailyForce,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Pipeline run failed');
      }
      setDailyRunResult(data.result);
      setDailyMessage({
        type: 'success',
        text: data.message || 'Run completed successfully!',
      });
      loadDailyData();
      loadAdminData();
    } catch (err: any) {
      console.error('Daily run error:', err);
      setDailyMessage({ type: 'error', text: err.message || 'Pipeline execution failed' });
    } finally {
      setDailyRunning(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4 text-[var(--text-primary)]">
        <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-page-deep)] border border-[var(--border-color)] text-[var(--color-coral)] flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-[var(--text-primary)]">Admin Authentication</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              IndoBid Operations & Moderation Console
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                Admin Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                Admin Secret Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter administrator secret key..."
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <Key className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-black rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In as Administrator'}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              &larr; Return to public feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-3 sm:p-6 space-y-6 w-full overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-6 min-w-0">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)] w-full min-w-0">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center space-x-2">
                <span>IndoBid Admin Console</span>
                <span className="text-[10px] bg-[var(--color-coral)]/15 text-[var(--color-coral)] px-2 py-0.5 rounded-full font-bold border border-[var(--color-coral)]/30">
                  Authoritative Server
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Verified INR financial ledgers, content moderation, reports, and analytics.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadAdminData}
              className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--color-coral)] border border-[var(--border-color)] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-red-400 border border-[var(--border-color)] rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-2 border-b border-[var(--border-subtle)] pb-3 overflow-x-auto scrollbar-none w-full min-w-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'overview'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Revenue & Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('debates')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'debates'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Debates ({debates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'users'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'reports'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Reports ({reports.filter((r) => r.status === 'pending').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'payments'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payment Ledger ({payments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('creators')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'creators'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Creator Economy</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('indobid-daily');
              loadDailyData();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'indobid-daily'
                ? 'bg-[var(--color-coral)] text-[#071B21]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>IndoBid Daily Engine</span>
          </button>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6 w-full min-w-0">
            {/* Analytics KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 w-full min-w-0">
              {/* Total Users */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Total Users
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono block">
                  {stats.users.total.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--color-lime)] font-medium block truncate">
                  +{stats.users.todayNew || 0} joined today
                </span>
              </div>

              {/* Live Visitors */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block">
                    Live Now
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono block">
                  {stats.visitors?.liveActive ?? 0}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] block truncate">
                  Active past 5 mins
                </span>
              </div>

              {/* Published Posts */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Published Posts
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono block">
                  {stats.debates.active.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--color-coral)] font-medium block truncate">
                  +{stats.debates.todayNew || 0} today
                </span>
              </div>

              {/* Total Backing (Revenue) */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Total Backing
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--color-amber)] font-mono block">
                  ₹{stats.financials.totalRevenueRupees.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] block truncate">
                  {stats.payments.successful} payments
                </span>
              </div>

              {/* Creator Rewards */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Creator Rewards
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--color-lime)] font-mono block">
                  ₹{((stats.financials as any).totalCreatorRewardsRupees || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block truncate">
                  10% distributed
                </span>
              </div>

              {/* Verified Payments */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Verified Payments
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono block">
                  {stats.payments.successful.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] block truncate">
                  Razorpay verified
                </span>
              </div>
            </div>

            {/* FOUNDER POST CREATOR STUDIO */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-coral)]/15 text-[var(--color-coral)] border border-[var(--color-coral)]/30">
                      Founder Publishing Studio
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Author: Vishal Chaudhary (@vishalchaudhary)
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Publish official Founder opinions directly to feed with ₹0 payment requirement. Community can still back and debate.
                  </p>
                </div>
                <div className="text-[11px] font-mono text-[var(--color-amber)] font-bold">
                  ₹0 Cost · Instant Live
                </div>
              </div>

              {founderPostSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{founderPostSuccess}</span>
                </div>
              )}

              {founderPostError && (
                <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{founderPostError}</span>
                </div>
              )}

              <form onSubmit={handleCreateFounderPost} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                    Post Content / Opinion
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={founderPostContent}
                    onChange={(e) => setFounderPostContent(e.target.value)}
                    placeholder="Write the official Founder opinion or viewpoint..."
                    className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl p-3 text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none font-medium leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Headline / Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={founderPostTitle}
                      onChange={(e) => setFounderPostTitle(e.target.value)}
                      placeholder="Auto-derived if empty"
                      className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Topic / Category
                    </label>
                    <select
                      value={founderCategorySlug}
                      onChange={(e) => setFounderCategorySlug(e.target.value)}
                      className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-medium cursor-pointer"
                    >
                      <option value="ai">AI & Models</option>
                      <option value="startups">Startups & Venture</option>
                      <option value="money">Markets & Economy</option>
                      <option value="technology">Tech & Dev</option>
                      <option value="society">Society & Culture</option>
                      <option value="business">Business Strategy</option>
                      <option value="general">General Opinions</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Hashtags (Optional)
                    </label>
                    <input
                      type="text"
                      value={founderHashtags}
                      onChange={(e) => setFounderHashtags(e.target.value)}
                      placeholder="#IndoBid #Conviction"
                      className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={founderIsAnonymous}
                      onChange={(e) => setFounderIsAnonymous(e.target.checked)}
                      className="rounded text-[var(--color-coral)] focus:ring-0"
                    />
                    <span>Post anonymously (hide Founder name)</span>
                  </label>

                  <button
                    type="submit"
                    disabled={founderPostLoading || founderPostContent.trim().length < 5}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {founderPostLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Publishing as Founder...</span>
                      </>
                    ) : (
                      <>
                        <span>Publish Post as Founder · ₹0 Free</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. DEBATES TAB */}
        {activeTab === 'debates' && (
          <div className="space-y-4 w-full min-w-0">
            {/* Action Feedback Banner */}
            {actionMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between space-x-2 border transition ${
                  actionMessage.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {actionMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="font-medium">{actionMessage.text}</span>
                </div>
                <button
                  onClick={() => setActionMessage(null)}
                  className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg w-full min-w-0">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={debateSearch}
                  onChange={(e) => setDebateSearch(e.target.value)}
                  placeholder="Search opinions by title, author, or category..."
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center space-x-1 bg-[var(--bg-page-deep)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs">
                  {(['all', 'active', 'hidden', 'removed'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setDebateStatusFilter(st)}
                      className={`px-3 py-1 rounded-lg font-bold capitalize transition cursor-pointer text-[11px] ${
                        debateStatusFilter === st
                          ? 'bg-[var(--color-coral)] text-[#071B21]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => loadAdminData()}
                  className="p-2 rounded-xl bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  title="Refresh debates"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Debates Management Table */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-x-auto shadow-xl w-full min-w-0">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-3 px-4">Debate Opinion</th>
                    <th className="py-3 px-4">Author</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Total Backed</th>
                    <th className="py-3 px-4">Rank Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {debates
                    .filter((d) => {
                      if (debateStatusFilter !== 'all' && d.status !== debateStatusFilter) return false;
                      if (debateSearch.trim()) {
                        const q = debateSearch.toLowerCase().trim();
                        const titleMatch = (d.title || '').toLowerCase().includes(q);
                        const authorMatch = (d.authorUsername || '').toLowerCase().includes(q);
                        const catMatch = (d.category?.name || '').toLowerCase().includes(q);
                        return titleMatch || authorMatch || catMatch;
                      }
                      return true;
                    })
                    .map((d) => {
                      const score = d.trendingScore ?? 0;
                      const isPenalized = score < 0 || (d.reportCount && d.reportCount > 0);
                      const isOperating = actionLoadingId === d.id;

                      return (
                        <tr key={d.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                          <td className="py-3 px-4 max-w-xs">
                            <Link
                              href={`/debate/${d.id}`}
                              target="_blank"
                              className="font-bold text-[var(--text-primary)] hover:text-[var(--color-coral)] transition truncate block"
                              title={d.title}
                            >
                              {d.title}
                            </Link>
                            <span className="text-[10px] text-[var(--text-muted)] truncate block">
                              {d.content?.substring(0, 70)}...
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[var(--text-secondary)]">
                            @{d.authorUsername}
                          </td>
                          <td className="py-3 px-4 text-[var(--text-secondary)]">
                            <span className="px-2 py-0.5 rounded-full bg-[var(--bg-page-deep)] text-[11px] border border-[var(--border-subtle)]">
                              {d.category?.name || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[var(--color-amber)]">
                            {formatINR(d.totalVerifiedContribution)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-1.5 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  score < 0
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : score > 50
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {score < 0 ? `🔻 ${score}` : `🔥 ${score}`}
                              </span>
                              {isPenalized && (
                                <button
                                  onClick={() => handleResetRankDebate(d.id)}
                                  disabled={isOperating}
                                  className="p-1 rounded hover:bg-[var(--bg-page-deep)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer"
                                  title="Reset rank to organic score"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                d.status === 'active'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : d.status === 'removed'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* 1. Rank Down Action */}
                              <button
                                onClick={() => handleRankDownDebate(d.id, 50)}
                                disabled={isOperating}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 flex items-center space-x-1 disabled:opacity-50"
                                title="Rank down this post in feeds by 50 points"
                              >
                                <TrendingDown className="w-3 h-3 shrink-0" />
                                <span>Rank Down</span>
                              </button>

                              {/* 2. Hide / Unhide Action */}
                              <button
                                onClick={() => handleToggleDebateStatus(d.id, d.status)}
                                disabled={isOperating}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                                  d.status === 'active'
                                    ? 'bg-[var(--bg-page-deep)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                                }`}
                              >
                                {d.status === 'active' ? 'Hide' : 'Unhide'}
                              </button>

                              {/* 3. Delete Action */}
                              <button
                                onClick={() => setDeleteConfirmDebate(d)}
                                disabled={isOperating}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 flex items-center space-x-1 disabled:opacity-50"
                                title="Permanently delete post and its data"
                              >
                                <Trash2 className="w-3 h-3 shrink-0" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {debates.length === 0 && (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  No debates found on platform.
                </div>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmDebate && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
                <div className="bg-[var(--bg-surface)] border border-red-500/30 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Delete Post Permanently?
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Are you sure you want to permanently delete this opinion and all its replies from the database? This action cannot be reversed.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-[var(--bg-page-deep)] rounded-xl border border-[var(--border-subtle)] space-y-1 text-xs">
                    <div className="font-bold text-[var(--text-primary)] truncate">
                      "{deleteConfirmDebate.title}"
                    </div>
                    <div className="text-[var(--text-muted)] font-mono text-[11px]">
                      Author: @{deleteConfirmDebate.authorUsername} · Backed: {formatINR(deleteConfirmDebate.totalVerifiedContribution)}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setDeleteConfirmDebate(null)}
                      disabled={actionLoadingId === deleteConfirmDebate.id}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteDebate(deleteConfirmDebate.id)}
                      disabled={actionLoadingId === deleteConfirmDebate.id}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {actionLoadingId === deleteConfirmDebate.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Post</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}


        {/* 3. USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-4 w-full min-w-0">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-x-auto shadow-xl w-full min-w-0">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Debates</th>
                    <th className="py-3 px-4">Followers</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[var(--text-primary)]">{u.displayName}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">@{u.username}</span>
                          {u.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-lime)]" />}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{u.email || '—'}</td>
                      <td className="py-3 px-4 font-mono">{u._count.debates}</td>
                      <td className="py-3 px-4 font-mono">{u._count.followers}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isSuspended
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {u.isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleUserVerification(u.id, u.isVerified)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--bg-page-deep)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] transition cursor-pointer"
                        >
                          {u.isVerified ? 'Unverify' : 'Verify'}
                        </button>
                        <button
                          onClick={() => handleToggleUserSuspension(u.id, u.isSuspended)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            u.isSuspended
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/15 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {u.isSuspended ? 'Restore' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-4 w-full min-w-0">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-x-auto shadow-xl w-full min-w-0">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-3 px-4">Report Reason</th>
                    <th className="py-3 px-4">Reported Debate</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                      <td className="py-3 px-4 text-red-300 font-medium">{r.reason}</td>
                      <td className="py-3 px-4 text-[var(--text-primary)]">
                        {r.debate?.title || 'Unknown debate'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {r.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleResolveReport(r.id, 'resolved')}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleResolveReport(r.id, 'dismissed')}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--bg-page-deep)] text-[var(--text-muted)] border border-[var(--border-subtle)] cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. PAYMENTS LEDGER TAB */}
        {activeTab === 'payments' && (
          <div className="space-y-4 w-full min-w-0">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-x-auto shadow-xl w-full min-w-0">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-3 px-4">Payment ID</th>
                    <th className="py-3 px-4">Amount (INR)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                      <td className="py-3 px-4 font-mono text-[var(--color-coral)]">
                        {p.providerPaymentId}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--color-amber)]">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'succeeded'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{p.customerEmail || '—'}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. CREATOR ECONOMY TAB */}
        {activeTab === 'creators' && (
          <div className="space-y-6">
            {/* KPI Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Creator Rewards Generated
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--color-amber)] font-mono mt-1 block">
                  {formatINR(creatorEconomy?.summary?.totalCreatorRewardsPaise || 0)}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">10% of external backing</span>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Eligible Community Backing
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono mt-1 block">
                  {formatINR(creatorEconomy?.summary?.totalVerifiedBackingPaise || 0)}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">Verified challenger responses</span>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Pending / In Settlement
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-secondary)] font-mono mt-1 block">
                  {formatINR(creatorEconomy?.summary?.totalPendingRewardsPaise || 0)}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">Settlement verification</span>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Earning Creators
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1 block">
                  {creatorEconomy?.summary?.earningCreatorsCount || 0}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">Active opinion authors</span>
              </div>
            </div>

            {/* Top Earners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Earning Creators */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Top Earning Creators
                  </h3>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">10% Rate</span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {creatorEconomy?.topEarningCreators?.length > 0 ? (
                    creatorEconomy.topEarningCreators.map((c: any, i: number) => (
                      <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[var(--text-muted)] text-[11px]">#{i + 1}</span>
                          <span className="font-bold text-[var(--text-primary)]">@{c.username}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">({c.count} responses)</span>
                        </div>
                        <span className="font-mono font-bold text-[var(--color-amber)]">
                          {formatINR(c.totalEarnedPaise)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-[var(--text-muted)]">No creator earnings recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Top Earning Opinions */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Top Earning Opinions
                  </h3>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">Ranked by Reward</span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {creatorEconomy?.topEarningOpinions?.length > 0 ? (
                    creatorEconomy.topEarningOpinions.map((o: any, i: number) => (
                      <div key={i} className="py-2.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--text-primary)] truncate max-w-[240px]">
                            {o.title}
                          </span>
                          <span className="font-mono font-bold text-[var(--color-amber)]">
                            {formatINR(o.creatorRewardPaise)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                          <span>by @{o.creatorUsername}</span>
                          <span>Total Backed: {formatINR(o.totalBackingPaise)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-[var(--text-muted)]">No opinions with external backing yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Auditable Creator Earnings Ledger Table */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Immutable Creator Earnings Ledger
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Audit trail: Opinion → Contribution → Verified Payment → Creator Reward (10%)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Search by creator, opinion..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none w-56"
                  />
                  <select
                    value={ledgerStatusFilter}
                    onChange={(e) => setLedgerStatusFilter(e.target.value)}
                    className="bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="available">Available</option>
                    <option value="paid">Paid</option>
                    <option value="reversed">Reversed</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="py-3 px-4">Creator</th>
                      <th className="py-3 px-4">Opinion Topic</th>
                      <th className="py-3 px-4">Contributed By</th>
                      <th className="py-3 px-4">Gross Backing</th>
                      <th className="py-3 px-4">Creator Reward (10%)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {creatorEconomy?.ledger?.items?.length > 0 ? (
                      creatorEconomy.ledger.items
                        .filter((e: any) => {
                          if (ledgerStatusFilter !== 'all' && e.status !== ledgerStatusFilter) return false;
                          if (ledgerSearch) {
                            const q = ledgerSearch.toLowerCase();
                            return (
                              e.creatorUsername.toLowerCase().includes(q) ||
                              e.debateTitle.toLowerCase().includes(q) ||
                              e.contributorUsername.toLowerCase().includes(q)
                            );
                          }
                          return true;
                        })
                        .map((e: any) => (
                          <tr key={e.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                            <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                              @{e.creatorUsername}
                            </td>
                            <td className="py-3 px-4 text-[var(--text-secondary)] max-w-xs truncate">
                              {e.debateTitle}
                            </td>
                            <td className="py-3 px-4 text-[var(--text-muted)]">
                              @{e.contributorUsername} (Seq #{e.contributionSequence})
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">
                              {formatINR(e.grossAmountPaise)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[var(--color-amber)]">
                              {formatINR(e.creatorRewardPaise)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  e.status === 'available' || e.status === 'paid'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : e.status === 'reversed'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[var(--text-muted)]">
                              {new Date(e.createdAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No creator earnings ledger entries recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 7. INDOBID DAILY ENGINE TAB */}
        {activeTab === 'indobid-daily' && (
          <div className="space-y-6 w-full min-w-0">
            {/* Action Feedback Message */}
            {dailyMessage && (
              <div
                className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  dailyMessage.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}
              >
                <span>{dailyMessage.text}</span>
                <button
                  onClick={() => setDailyMessage(null)}
                  className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Config & Control Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Configuration Status */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-[var(--color-coral)]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                      Engine Configuration
                    </h3>
                  </div>
                  <button
                    onClick={loadDailyData}
                    disabled={dailyLoading}
                    className="p-1.5 hover:bg-[var(--bg-page-deep)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${dailyLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Master Engine State</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dailyData?.config?.enabled
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {dailyData?.config?.enabled ? 'AUTO ENABLED' : 'STANDBY / MANUAL'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Dry Run Mode Default</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {dailyData?.config?.dryRunDefault ? 'Enabled (Safe)' : 'Disabled (Live Publish)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Trend Score Threshold</span>
                    <span className="font-mono font-bold text-[var(--color-coral)]">
                      {dailyData?.config?.trendScoreThreshold ?? 50} / 100
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Max Posts Per Day</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {dailyData?.config?.maxPostsPerDay ?? 10}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--text-secondary)]">Topic Cooldown</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {dailyData?.config?.cooldownHours ?? 24} hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Engine Metrics */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-[var(--color-coral)]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                    Engine Totals
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] p-3 rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">
                      Total Automated Posts
                    </span>
                    <span className="text-2xl font-black text-[var(--text-primary)]">
                      {dailyData?.stats?.totalAutomatedPosts ?? 0}
                    </span>
                  </div>

                  <div className="bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] p-3 rounded-xl">
                    <span className="text-[10px] text-[var(--text-muted)] block uppercase font-bold">
                      Total Pipeline Runs
                    </span>
                    <span className="text-2xl font-black text-[var(--text-primary)]">
                      {dailyData?.stats?.totalRuns ?? 0}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--text-secondary)] pt-2 leading-relaxed">
                  Posts are published under the verified bot <span className="text-[var(--color-coral)] font-bold">@indobiddaily</span>. They are permanent, authoritative posts that never auto-delete.
                </div>
              </div>

              {/* Trigger Pipeline Run */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2">
                  <Play className="w-4 h-4 text-[var(--color-coral)]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                    Manual Execution
                  </h3>
                </div>

                <div className="space-y-3 pt-1">
                  <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dailyDryRun}
                      onChange={(e) => setDailyDryRun(e.target.checked)}
                      className="rounded border-[var(--border-color)] text-[var(--color-coral)] focus:ring-0"
                    />
                    <span className="text-[var(--text-primary)] font-bold">
                      Dry Run Mode (Simulate without publishing)
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dailyForce}
                      onChange={(e) => setDailyForce(e.target.checked)}
                      className="rounded border-[var(--border-color)] text-[var(--color-coral)] focus:ring-0"
                    />
                    <span className="text-[var(--text-secondary)]">
                      Force Execution (Bypass disabled state / daily cap)
                    </span>
                  </label>

                  <button
                    onClick={handleTriggerDailyRun}
                    disabled={dailyRunning}
                    className="w-full py-2.5 px-4 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {dailyRunning ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Running Discovery Engine...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{dailyDryRun ? 'Simulate Pipeline (Dry Run)' : 'Execute & Publish Live Posts'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Run Result Preview (if recent execution) */}
            {dailyRunResult && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center space-x-2">
                    <span>Latest Run Output Preview</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${dailyRunResult.isDryRun ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {dailyRunResult.isDryRun ? 'Dry Run' : 'Live Run'}
                    </span>
                  </h3>
                  <button
                    onClick={() => setDailyRunResult(null)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[var(--bg-page-deep)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[10px]">Sources Queried</span>
                    <span className="font-bold text-[var(--text-primary)]">{dailyRunResult.sourcesSuccessful} / {dailyRunResult.sourcesAttempted}</span>
                  </div>
                  <div className="bg-[var(--bg-page-deep)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[10px]">Articles Fetched</span>
                    <span className="font-bold text-[var(--text-primary)]">{dailyRunResult.articlesFetched}</span>
                  </div>
                  <div className="bg-[var(--bg-page-deep)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[10px]">Clusters Formed</span>
                    <span className="font-bold text-[var(--text-primary)]">{dailyRunResult.clustersCreated}</span>
                  </div>
                  <div className="bg-[var(--bg-page-deep)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] block text-[10px]">Candidates / Published</span>
                    <span className="font-bold text-[var(--color-coral)]">{dailyRunResult.candidatesSelected} / {dailyRunResult.postsPublished}</span>
                  </div>
                </div>

                {dailyRunResult.publishedPosts?.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                      {dailyRunResult.isDryRun ? 'Top Evaluated Candidates:' : 'Published Posts:'}
                    </span>
                    <div className="space-y-1.5">
                      {dailyRunResult.publishedPosts.map((p: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-[var(--bg-page-deep)] rounded-xl border border-[var(--border-subtle)] text-xs">
                          <div className="flex items-center space-x-2 min-w-0 pr-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--color-coral)]/20 text-[var(--color-coral)] shrink-0">
                              {p.category}
                            </span>
                            <span className="font-bold text-[var(--text-primary)] truncate">{p.title}</span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[11px] font-mono font-bold text-[var(--color-coral)]">Score {Math.round(p.trendScore)}</span>
                            {p.debateId && (
                              <Link
                                href={`/debate/${p.debateId}`}
                                target="_blank"
                                className="p-1 hover:bg-white/10 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Automation Runs Table */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Execution History (Recent Pipeline Runs)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                  <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Run Time</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Sources</th>
                      <th className="py-3 px-4">Fetched</th>
                      <th className="py-3 px-4">Deduped</th>
                      <th className="py-3 px-4">Clusters</th>
                      <th className="py-3 px-4">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {dailyData?.recentRuns?.length > 0 ? (
                      dailyData.recentRuns.map((r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                          <td className="py-3 px-4 text-[var(--text-primary)] font-mono text-[11px]">
                            {new Date(r.startedAt).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'success'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : r.status === 'dry_run'
                                  ? 'bg-sky-500/20 text-sky-400'
                                  : r.status === 'running'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4">{r.sourcesSuccessful}/{r.sourcesAttempted}</td>
                          <td className="py-3 px-4">{r.articlesFetched}</td>
                          <td className="py-3 px-4">{r.duplicatesRemoved}</td>
                          <td className="py-3 px-4">{r.clustersCreated}</td>
                          <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                            {r.postsPublished}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No pipeline runs executed yet. Trigger a run above to test.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Automated Posts */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Published Automated Posts ({dailyData?.stats?.totalAutomatedPosts ?? 0})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[var(--text-secondary)]">
                  <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Published At</th>
                      <th className="py-3 px-4">Post Title</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Trend Score</th>
                      <th className="py-3 px-4">Sources</th>
                      <th className="py-3 px-4 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {dailyData?.recentPosts?.length > 0 ? (
                      dailyData.recentPosts.map((p: any) => (
                        <tr key={p.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                          <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap text-[11px]">
                            {new Date(p.createdAt).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4 font-bold text-[var(--text-primary)] max-w-md truncate">
                            {p.debate?.title || 'Untitled Post'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-coral)]/15 text-[var(--color-coral)] border border-[var(--color-coral)]/30">
                              {p.debate?.category?.name || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[var(--color-coral)]">
                            {Math.round(p.trendScore)}
                          </td>
                          <td className="py-3 px-4">{p.sourceCount} sources</td>
                          <td className="py-3 px-4 text-right">
                            {p.debateId && (
                              <Link
                                href={`/debate/${p.debateId}`}
                                target="_blank"
                                className="inline-flex items-center space-x-1 text-xs text-[var(--color-coral)] hover:underline"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No automated posts published yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
