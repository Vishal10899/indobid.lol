'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser, openAuthModal } = useAuth();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkToken() {
      if (!token || !email) {
        setVerifyingToken(false);
        setTokenValid(false);
        setErrorMsg('Invalid or missing password reset link.');
        return;
      }

      try {
        const res = await fetch('/api/auth/reset-password/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email }),
        });

        const data = await res.json();
        if (res.ok && data.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setErrorMsg(data.error || 'This password reset link is invalid or has expired.');
        }
      } catch {
        setTokenValid(false);
        setErrorMsg('Failed to verify reset link. Please check your internet connection.');
      } finally {
        setVerifyingToken(false);
      }
    }

    checkToken();
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setSuccessMsg('Your password has been successfully updated! Redirecting...');
      await refreshUser();

      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center p-4 text-[var(--text-primary)]">
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Set New Password
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Choose a secure new password for your IndoBid account.
          </p>
        </div>

        {verifyingToken ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-coral)]" />
            <span className="text-xs text-[var(--text-muted)]">Verifying security token...</span>
          </div>
        ) : !tokenValid ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-2xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Reset Link Expired or Invalid</p>
                <p className="mt-1 text-[11px] text-red-300/80">
                  {errorMsg || 'This password reset link is invalid or has already been used.'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  openAuthModal('login');
                  router.push('/');
                }}
                className="w-full py-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <span>Request New Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <Link
                href="/"
                className="w-full py-2.5 bg-[var(--bg-page-deep)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return Home</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-page-deep)] p-2.5 rounded-xl border border-[var(--border-subtle)] flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-[var(--color-coral)] shrink-0" />
              <span className="truncate">Resetting password for: <strong className="text-[var(--text-primary)]">{email}</strong></span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                New Password <span className="text-[var(--color-coral)]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="•••••••• (at least 6 characters)"
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-8 pr-9 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                Confirm New Password <span className="text-[var(--color-coral)]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-8 pr-9 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-2.5 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs rounded-xl shadow transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-2 text-center">
          <Link
            href="/"
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium inline-flex items-center space-x-1"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Return to public feed</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-coral)]" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
