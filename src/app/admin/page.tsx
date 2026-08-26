'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert, Key, Mail, Eye, EyeOff, Search, RefreshCw, ArrowLeft, DollarSign, Layers } from 'lucide-react';
import { PlatformIcon } from '@/components/PlatformIcon';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [activeTab, setActiveTab] = useState<'listings' | 'payments'>('listings');
  
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [authError, setAuthError] = useState<string | null>(null);

  // Check existing session via /api/admin/me
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
      const [listingsRes, paymentsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/listings'),
        fetch('/api/admin/payments'),
        fetch('/api/categories'),
      ]);

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
        setCategories(data.categories || []);
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
      setAdminKey(''); // Clear secret from state
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
      }
    } catch (e) {
      console.error('Toggle status failed:', e);
    }
  };

  const handleChangeCategory = async (listingId: string, newCategoryId: string) => {
    try {
      const res = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listingId, categoryId: newCategoryId }),
      });

      if (res.ok) {
        const catObj = categories.find((c) => c.id === newCategoryId);
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId
              ? {
                  ...l,
                  categoryId: newCategoryId,
                  category: catObj ? { id: catObj.id, name: catObj.name, slug: '' } : l.category,
                }
              : l
          )
        );
      }
    } catch (e) {
      console.error('Change category failed:', e);
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
                <span>Admin Moderation Control</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/20">
                  Authenticated
                </span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">Manage listings, moderate URLs, inspect verified transactions</p>
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
        <div className="flex items-center space-x-2 border-b border-[var(--border-color)] pb-1">
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
            <DollarSign className="w-3.5 h-3.5" />
            <span>Payments ({payments.length})</span>
          </button>
        </div>

        {/* Listings Tab */}
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
                {['all', 'active', 'hidden'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                      statusFilter === status
                        ? 'bg-[var(--text-primary)] text-[var(--bg-card)] font-semibold'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    {status}
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
                      <th className="py-2.5 px-3 font-semibold">Verified Bid</th>
                      <th className="py-2.5 px-3 font-semibold">Clicks</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredListings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                          No listings in database.
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
                                <a
                                  href={l.destinationUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] truncate block text-[11px]"
                                >
                                  {l.canonicalUrl}
                                </a>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <select
                              value={l.categoryId}
                              onChange={(e) => handleChangeCategory(l.id, e.target.value)}
                              className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] cursor-pointer focus:outline-none"
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-[var(--text-primary)]">
                            ${(l.verifiedBid / 100).toLocaleString()}
                          </td>

                          <td className="py-3 px-3 text-[var(--text-secondary)]">
                            {l.clickCount.toLocaleString()}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                l.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleToggleStatus(l.id, l.status)}
                              className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer inline-flex items-center space-x-1 ${
                                l.status === 'active'
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                              }`}
                            >
                              {l.status === 'active' ? (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  <span>Hide</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>Restore</span>
                                </>
                              )}
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

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--text-secondary)] border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Payment ID / Order</th>
                    <th className="py-2.5 px-3 font-semibold">Listing</th>
                    <th className="py-2.5 px-3 font-semibold">Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Provider</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--bg-surface)] transition">
                        <td className="py-3 px-3 font-mono text-[var(--text-secondary)] text-[11px]">
                          {p.providerPaymentId}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[var(--text-primary)]">{p.listing?.title || 'Unknown'}</div>
                          <div className="text-[var(--text-muted)] text-[11px]">{p.listing?.canonicalUrl}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ${(p.amount / 100).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 capitalize text-[var(--text-secondary)]">
                          {p.provider}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[var(--text-muted)] font-mono text-[11px]">
                          {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
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
