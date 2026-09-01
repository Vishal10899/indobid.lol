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
} from 'lucide-react';
import { formatINR } from '@/lib/money';

interface AdminStats {
  debates: {
    total: number;
    active: number;
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
  createdAt: string;
  category: { name: string };
  _count: { contributions: number; payments: number; reports: number };
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
  amount: number;
  status: string;
  providerPaymentId: string;
  createdAt: string;
  debateId?: string | null;
  customerEmail?: string | null;
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
  const [adminEmail, setAdminEmail] = useState('vishalkumar75912@gmail.com');
  const [adminKey, setAdminKey] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'debates' | 'users' | 'reports' | 'payments' | 'creators'>('overview');
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
                  placeholder="Enter ADMIN_SECRET_KEY..."
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
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Total Verified Revenue
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--color-amber)] font-mono mt-1 block">
                  ₹{stats.financials.totalRevenueRupees.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  From {stats.payments.successful} verified payments
                </span>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Today&apos;s Revenue
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--color-amber)] font-mono mt-1 block">
                  ₹{stats.financials.todayRevenueRupees.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">Past 24 hours</span>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Active Debates
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono mt-1 block">
                  {stats.debates.active}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {stats.debates.total} total submitted
                </span>
              </div>

              <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl">
                <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block">
                  Total Debaters
                </span>
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono mt-1 block">
                  {stats.users.total}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">Registered accounts</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. DEBATES TAB */}
        {activeTab === 'debates' && (
          <div className="space-y-4 w-full min-w-0">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-x-auto shadow-xl w-full min-w-0">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-[var(--bg-page-deep)] text-[var(--text-muted)] uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-3 px-4">Debate Opinion</th>
                    <th className="py-3 px-4">Author</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Total Backed</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Moderation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {debates.map((d) => (
                    <tr key={d.id} className="hover:bg-[var(--bg-page-deep)]/50 transition">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)] max-w-xs truncate">
                        {d.title}
                      </td>
                      <td className="py-3 px-4 font-mono text-[var(--text-secondary)]">
                        @{d.authorUsername}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{d.category?.name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--color-amber)]">
                        {formatINR(d.totalVerifiedContribution)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleDebateStatus(d.id, d.status)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            d.status === 'active'
                              ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                          }`}
                        >
                          {d.status === 'active' ? 'Hide Debate' : 'Unhide Debate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      </div>
    </div>
  );
}
