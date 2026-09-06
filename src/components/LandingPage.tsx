'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  X,
  Shield,
  FileText,
  Info,
  HelpCircle,
  Users,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { isValidEmail } from '@/modules/auth/auth.validation';

type AuthTab = 'login' | 'signup' | 'verify-email' | 'forgot-password';
type InfoTab = 'about' | 'how-it-works' | 'terms' | 'privacy' | 'guidelines' | 'contact';

export function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  // Auth Panel State
  const [tab, setTab] = useState<AuthTab>('login');
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // Form Fields
  const [loginInput, setLoginInput] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email Verification State (for accounts requiring email code confirmation)
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState(0);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Information & Legal Modal State
  const [infoModal, setInfoModal] = useState<InfoTab | null>(null);

  // Respect URL query parameter if present (?auth=signup or ?auth=login or ?error=...)
  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (authParam === 'signup') {
      setTab('signup');
    } else if (authParam === 'login') {
      setTab('login');
    }

    const oauthError = searchParams.get('error');
    if (oauthError === 'google_oauth_denied') {
      setErrorMsg('Google sign-in was cancelled. Please try again.');
    } else if (oauthError === 'google_oauth_failed') {
      setErrorMsg('Google sign-in failed. Please try again or use another sign-in method.');
    } else if (oauthError === 'google_oauth_state_mismatch') {
      setErrorMsg('Security check failed during Google sign-in. Please try again.');
    } else if (oauthError === 'google_oauth_unavailable') {
      setErrorMsg('Google sign-in is temporarily unavailable. Please use another sign-in method.');
    }
  }, [searchParams]);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // Handle post-login navigation if redirected from protected route
  const handleAuthSuccess = async () => {
    await refreshUser();
    const redirectTarget = searchParams.get('redirect');
    if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')) {
      router.replace(redirectTarget);
    }
  };

  // Handle Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanLogin = loginInput.trim();
    if (!cleanLogin || !password) {
      setErrorMsg('Please enter your username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: cleanLogin,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.requiresVerification && data.email) {
          setVerificationEmail(data.email);
          setTab('verify-email');
          setCooldown(60);
          setErrorMsg(data.error || 'Please enter the verification code sent to your email.');
          return;
        }
        throw new Error(data.error || 'Invalid email, username or password.');
      }

      await handleAuthSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid email or password. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup Submit
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          displayName: displayName.trim() || cleanUsername,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account. Please check your inputs.');
      }

      if (data.requiresVerification) {
        setVerificationEmail(cleanEmail);
        setTab('verify-email');
        setCooldown(60);
        setSuccessMsg('A 6-digit verification code has been sent to your email.');
      } else {
        await handleAuthSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Email Verification OTP Submit
  const handleVerifyEmailOtp = async (codeOverride?: string) => {
    const code = codeOverride || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit code.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verificationEmail.trim().toLowerCase(),
          otp: code.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      await handleAuthSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Email Verification Code
  const handleResendEmailOtp = async () => {
    if (cooldown > 0 || !verificationEmail) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend code.');
      }
      setCooldown(60);
      setSuccessMsg('A new verification code has been sent to your email.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Submit
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = loginInput.includes('@') ? loginInput.trim().toLowerCase() : email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      setSuccessMsg(data.message || 'Check your email. We\'ve sent password reset instructions.');
    } catch {
      setSuccessMsg('Check your email. We\'ve sent password reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  // User-facing provider handlers
  const handleSocialClick = (provider: string) => {
    if (provider === 'Google') {
      const redirectTarget = searchParams.get('redirect');
      const googleUrl = redirectTarget
        ? `/api/auth/google?redirect=${encodeURIComponent(redirectTarget)}`
        : '/api/auth/google';
      window.location.href = googleUrl;
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[100dvh] w-full text-[#F6F2EB] flex flex-col justify-between relative overflow-x-hidden bg-transparent">
      {/* Subtle top illumination border */}
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#D98A6C]/20 to-transparent shrink-0" />

      {/* ============================================================ */}
      {/* MAIN VIEWPORT: BALANCED 2-COLUMN DESKTOP & 1-COLUMN MOBILE   */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16 w-full z-10 min-w-0">
        {/* Mobile-only Centered Brand Header (hidden on desktop) */}
        <div className="flex lg:hidden flex-col items-center text-center pt-2 pb-6 sm:pt-4 sm:pb-8">
          <div className="flex items-center space-x-2.5 mb-2.5">
            <div
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D98A6C] via-[#E2987D] to-[#D8A653] p-[1.5px] shadow-sm flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <div className="w-full h-full bg-[#0B1218] rounded-[inherit] flex items-center justify-center">
                <svg
                  viewBox="0 0 28 28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-[#D98A6C]"
                >
                  <rect x="5" y="4.5" width="10" height="2.5" rx="0.5" fill="currentColor" />
                  <rect x="8.5" y="7" width="3" height="13" rx="0.5" fill="currentColor" fillOpacity="0.9" />
                  <rect x="5" y="20" width="10" height="2.5" rx="0.5" fill="currentColor" />
                  <path d="M15 17.5L21.5 11L18 11V6H25V13H22L15 20V17.5Z" fill="currentColor" />
                  <circle cx="21" cy="20.5" r="2" fill="#D8A653" />
                </svg>
              </div>
            </div>

            <div className="flex items-baseline tracking-tight">
              <span className="font-bodoni font-black text-2.5xl tracking-tight text-[#F6F2EB]">
                INDO
              </span>
              <span className="font-bebas tracking-wider text-[#D98A6C] ml-1 text-2.5xl">
                BID
              </span>
            </div>
          </div>

          <div className="text-[10px] sm:text-[11px] font-mono tracking-[0.22em] uppercase text-[#D98A6C] font-medium mb-1.5 select-none">
            WHERE OPINIONS CARRY CONVICTION
          </div>
          <h1 className="text-xl sm:text-2xl font-bodoni font-bold text-[#F6F2EB] tracking-tight mb-1">
            Your opinion matters.
          </h1>
          <p className="text-xs sm:text-sm text-[#8E9FA5] max-w-xs leading-relaxed">
            Share what you believe. Discover perspectives worth hearing.
          </p>
        </div>

        <div className="w-full max-w-5xl xl:max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 xl:gap-20 items-center min-w-0">
          {/* ------------------------------------------------------------ */}
          {/* LEFT SIDE: BRAND EXPERIENCE (Desktop only)                   */}
          {/* ------------------------------------------------------------ */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-6 flex-col items-start text-left min-w-0 pr-4 xl:pr-10">
            {/* IndoBid Canonical Brand Mark & Wordmark */}
            <div className="flex items-center space-x-4 mb-8 xl:mb-10 group">
              <div
                className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D98A6C] via-[#E2987D] to-[#D8A653] p-[1.5px] shadow-md shadow-[#D98A6C]/10 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-[1.02]"
                aria-hidden="true"
              >
                <div className="w-full h-full bg-[#0B1218] rounded-[inherit] flex items-center justify-center relative overflow-hidden">
                  <svg
                    viewBox="0 0 28 28"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-[#D98A6C]"
                  >
                    <rect x="5" y="4.5" width="10" height="2.5" rx="0.5" fill="currentColor" />
                    <rect x="8.5" y="7" width="3" height="13" rx="0.5" fill="currentColor" fillOpacity="0.9" />
                    <rect x="5" y="20" width="10" height="2.5" rx="0.5" fill="currentColor" />
                    <path d="M15 17.5L21.5 11L18 11V6H25V13H22L15 20V17.5Z" fill="currentColor" />
                    <circle cx="21" cy="20.5" r="2" fill="#D8A653" />
                  </svg>
                </div>
              </div>

              <div className="flex items-baseline tracking-tight">
                <span className="font-bodoni font-black text-3.5xl xl:text-4xl tracking-tight text-[#F6F2EB]">
                  INDO
                </span>
                <span className="font-bebas tracking-wider text-[#D98A6C] ml-2 text-3.5xl xl:text-4xl">
                  BID
                </span>
              </div>
            </div>

            {/* Small Brand Eyebrow */}
            <div className="text-xs font-mono font-medium tracking-[0.25em] uppercase text-[#D98A6C] mb-4 select-none">
              WHERE OPINIONS CARRY CONVICTION
            </div>

            {/* Refined Editorial Headline */}
            <h1 className="text-4xl lg:text-[44px] xl:text-[50px] font-bold font-bodoni tracking-tight leading-[1.14] mb-5 text-[#F6F2EB]">
              Your opinion matters.
            </h1>

            {/* Short Supporting Description */}
            <p className="text-base lg:text-[17px] text-[#8E9FA5] font-normal leading-relaxed max-w-md">
              Share what you believe. Discover perspectives worth hearing.
            </p>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* RIGHT SIDE: AUTHENTICATION CARD                              */}
          {/* ------------------------------------------------------------ */}
          <div className="w-full lg:col-span-6 xl:col-span-6 flex justify-center lg:justify-end min-w-0 relative">
            {/* Subtle warm & cool ambient glow directly behind card */}
            <div
              className="absolute -inset-4 sm:-inset-6 rounded-3xl opacity-25 blur-2xl pointer-events-none -z-10"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(217, 138, 108, 0.14) 0%, rgba(56, 114, 150, 0.08) 50%, transparent 70%)',
              }}
              aria-hidden="true"
            />

            <div
              className="w-full max-w-[430px] mx-auto lg:ml-auto lg:mr-0 border border-white/[0.08] hover:border-white/[0.12] rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-9 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5),0_0_40px_rgba(217,138,108,0.03)] backdrop-blur-xl transition-all duration-300 relative"
              style={{
                background:
                  'linear-gradient(180deg, rgba(18, 29, 39, 0.72) 0%, rgba(13, 22, 30, 0.80) 100%)',
              }}
            >
              {/* TOP EQUAL-WIDTH TABS: "Log in" vs "Create account" */}
              <div className="flex border-b border-white/[0.08] mb-7">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 pb-3.5 text-sm font-semibold text-center transition-colors duration-200 relative cursor-pointer ${
                    tab === 'login'
                      ? 'text-[#F6F2EB]'
                      : 'text-[#8E9FA5] hover:text-[#F6F2EB]'
                  }`}
                >
                  Log in
                  {tab === 'login' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D98A6C] rounded-full shadow-[0_0_10px_rgba(217,138,108,0.4)]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 pb-3.5 text-sm font-semibold text-center transition-colors duration-200 relative cursor-pointer ${
                    tab === 'signup'
                      ? 'text-[#F6F2EB]'
                      : 'text-[#8E9FA5] hover:text-[#F6F2EB]'
                  }`}
                >
                  Create account
                  {tab === 'signup' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D98A6C] rounded-full shadow-[0_0_10px_rgba(217,138,108,0.4)]" />
                  )}
                </button>
              </div>

              {/* Alert Feedback Messages */}
              {errorMsg && (
                <div className="mb-5 p-3.5 bg-red-950/40 border border-red-500/30 text-red-200 text-xs sm:text-[13px] rounded-xl flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="line-clamp-2">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 p-3.5 bg-emerald-950/40 border border-[#00C896]/30 text-emerald-200 text-xs sm:text-[13px] rounded-xl flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00C896]" />
                  <span className="line-clamp-2">{successMsg}</span>
                </div>
              )}

              {/* ====================================================== */}
              {/* STATE 1: LOGIN                                         */}
              {/* ====================================================== */}
              {tab === 'login' && (
                <div className="space-y-5">
                  {/* Google Social Authentication Button (Premium Secondary Action) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleSocialClick('Google')}
                      className="w-full h-12 px-4 rounded-xl bg-[#0E1821]/80 hover:bg-[#152330] border border-white/[0.09] hover:border-white/[0.18] text-sm font-medium text-[#F6F2EB] transition-all duration-200 flex items-center justify-center space-x-3 cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  {/* Divider: OR */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/[0.07]" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-[0.2em] text-[#6C7D84]">
                      <span className="bg-[#0E1821] px-3">OR</span>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4.5">
                    {/* Login Input (Email, username or phone) */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-2">
                        Email / username
                      </label>
                      <div className="relative flex items-center">
                        <User className="w-4 h-4 text-[#6C7D84] absolute left-3.5 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={loginInput}
                          onChange={(e) => setLoginInput(e.target.value)}
                          placeholder="e.g. rohan or you@domain.com"
                          className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl pl-10 pr-3.5 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-2">
                        Password
                      </label>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-[#6C7D84] absolute left-3.5 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl pl-10 pr-11 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 text-[#6C7D84] hover:text-[#F6F2EB] transition-colors p-1 cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Options Row: Keep me signed in + Forgot password */}
                    <div className="flex items-center justify-between text-xs sm:text-[13px] pt-1 pb-0.5">
                      <label className="flex items-center space-x-2.5 text-[#8E9FA5] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={keepSignedIn}
                          onChange={(e) => setKeepSignedIn(e.target.checked)}
                          className="rounded bg-[#080E14] border-white/20 text-[#D98A6C] focus:ring-[#D98A6C]/30 w-4 h-4 cursor-pointer accent-[#D98A6C]"
                        />
                        <span>Keep me signed in</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setTab('forgot-password');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="font-medium text-[#D98A6C] hover:text-[#E2987D] hover:underline cursor-pointer transition-colors duration-200"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Primary CTA: "Log in" */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 px-4 rounded-xl bg-[#D98A6C] hover:bg-[#E2987D] text-[#07171C] font-semibold text-sm tracking-wide transition-all duration-200 shadow-md shadow-[#D98A6C]/15 hover:shadow-lg hover:shadow-[#D98A6C]/25 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <>
                          <span>Log in</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* ====================================================== */}
              {/* STATE 2: CREATE ACCOUNT                                */}
              {/* ====================================================== */}
              {tab === 'signup' && (
                <div className="space-y-4">
                  {/* Google Social Authentication Button (Premium Secondary Action) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleSocialClick('Google')}
                      className="w-full h-12 px-4 rounded-xl bg-[#0E1821]/80 hover:bg-[#152330] border border-white/[0.09] hover:border-white/[0.18] text-sm font-medium text-[#F6F2EB] transition-all duration-200 flex items-center justify-center space-x-3 cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  {/* Divider: OR */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/[0.07]" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-[0.2em] text-[#6C7D84]">
                      <span className="bg-[#0E1821] px-3">OR</span>
                    </div>
                  </div>

                  <form onSubmit={handleSignup} className="space-y-3.5">
                    {/* Username */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-1.5">
                        Username <span className="text-[#D98A6C]">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-xs text-[#6C7D84] font-mono pointer-events-none">@</span>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="username"
                          maxLength={25}
                          className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl pl-9 pr-3.5 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                        />
                      </div>
                    </div>

                    {/* Display Name */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-1.5">
                        Display name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        maxLength={40}
                        className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl px-4 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-1.5">
                        Email address <span className="text-[#D98A6C]">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-[#6C7D84] absolute left-3.5 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@domain.com"
                          className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl pl-10 pr-3.5 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-1.5">
                        Password <span className="text-[#D98A6C]">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-[#6C7D84] absolute left-3.5 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="•••••••• (min 6 characters)"
                          className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl pl-10 pr-11 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 text-[#6C7D84] hover:text-[#F6F2EB] transition-colors p-1 cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Primary CTA: "Create account" */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 px-4 rounded-xl bg-[#D98A6C] hover:bg-[#E2987D] text-[#07171C] font-semibold text-sm tracking-wide transition-all duration-200 shadow-md shadow-[#D98A6C]/15 hover:shadow-lg hover:shadow-[#D98A6C]/25 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create account</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* ====================================================== */}
              {/* STATE 3: EMAIL VERIFICATION                            */}
              {/* ====================================================== */}
              {tab === 'verify-email' && (
                <div>
                  <div className="mb-5">
                    <h2 className="text-lg sm:text-xl font-bold text-[#F6F2EB] tracking-tight">
                      Enter verification code
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#8E9FA5] mt-1 leading-relaxed">
                      We sent a 6-digit verification code to <span className="text-[#F6F2EB] font-medium">{verificationEmail}</span>.
                    </p>
                  </div>

                  <div className="space-y-4.5">
                    {/* Segmented OTP 6-box Input with auto-advance and paste */}
                    <div className="flex items-center justify-center space-x-2.5 py-1">
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => {
                            otpInputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(-1);
                            const newDigits = [...otpDigits];
                            newDigits[index] = val;
                            setOtpDigits(newDigits);
                            setErrorMsg(null);
                            if (val && index < 5) otpInputRefs.current[index + 1]?.focus();
                            if (newDigits.join('').length === 6) handleVerifyEmailOtp(newDigits.join(''));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
                              const newDigits = [...otpDigits];
                              newDigits[index - 1] = '';
                              setOtpDigits(newDigits);
                              otpInputRefs.current[index - 1]?.focus();
                            }
                          }}
                          className="w-10 sm:w-11 h-12 text-center text-lg font-bold font-mono bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl text-[#F6F2EB] focus:outline-none transition-all duration-200"
                        />
                      ))}
                    </div>

                    <div className="text-center text-xs sm:text-[13px] text-[#8E9FA5]">
                      {cooldown > 0 ? (
                        <span>Code expires in <strong className="text-[#F6F2EB] font-mono">{formatCountdown(cooldown)}</strong></span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleResendEmailOtp()}
                          disabled={loading}
                          className="font-semibold text-[#D98A6C] hover:underline cursor-pointer inline-flex items-center space-x-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Resend code</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleVerifyEmailOtp()}
                      disabled={loading || otpDigits.join('').length !== 6}
                      className="w-full h-12 px-4 rounded-xl bg-[#D98A6C] hover:bg-[#E2987D] text-[#07171C] font-semibold text-sm tracking-wide transition-all duration-200 shadow-md shadow-[#D98A6C]/15 hover:shadow-lg hover:shadow-[#D98A6C]/25 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify &amp; Continue</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTab('login');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs sm:text-[13px] text-[#8E9FA5] hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
                      >
                        &larr; Back to Log in
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================== */}
              {/* STATE 4: FORGOT PASSWORD                               */}
              {/* ====================================================== */}
              {tab === 'forgot-password' && (
                <div>
                  <div className="mb-5">
                    <h2 className="text-lg sm:text-xl font-bold text-[#F6F2EB] tracking-tight">
                      Reset your password
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#8E9FA5] mt-1 leading-relaxed">
                      Enter your email and we&apos;ll send you a secure reset link.
                    </p>
                  </div>

                  <form onSubmit={handleForgotPassword} className="space-y-4.5">
                    <div>
                      <label className="block text-xs sm:text-[13px] font-medium text-[#8E9FA5] mb-2">
                        Email address
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="w-4 h-4 text-[#6C7D84] absolute left-3.5 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={loginInput.includes('@') ? loginInput : email}
                          onChange={(e) => {
                            setLoginInput(e.target.value);
                            setEmail(e.target.value);
                          }}
                          placeholder="you@domain.com"
                          className="w-full h-12 bg-[#091016]/80 border border-white/[0.09] focus:border-[#D98A6C]/80 focus:ring-1 focus:ring-[#D98A6C]/25 rounded-xl pl-10 pr-3.5 text-sm text-[#F6F2EB] placeholder-[#5A6D75] focus:outline-none transition-all duration-200 font-normal"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 px-4 rounded-xl bg-[#D98A6C] hover:bg-[#E2987D] text-[#07171C] font-semibold text-sm tracking-wide transition-all duration-200 shadow-md shadow-[#D98A6C]/15 hover:shadow-lg hover:shadow-[#D98A6C]/25 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending link...</span>
                        </>
                      ) : (
                        <span>Send reset link &rarr;</span>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTab('login');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs sm:text-[13px] font-medium text-[#D98A6C] hover:underline cursor-pointer"
                      >
                        &larr; Back to Log in
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Legal Notice at bottom of card */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
                <p className="text-xs text-[#6C7D84] leading-relaxed">
                  By continuing, you agree to our{' '}
                  <button
                    type="button"
                    onClick={() => setInfoModal('terms')}
                    className="text-[#8E9FA5] hover:text-[#D98A6C] underline cursor-pointer transition-colors duration-200"
                  >
                    Terms
                  </button>
                  ,{' '}
                  <button
                    type="button"
                    onClick={() => setInfoModal('privacy')}
                    className="text-[#8E9FA5] hover:text-[#D98A6C] underline cursor-pointer transition-colors duration-200"
                  >
                    Privacy
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setInfoModal('guidelines')}
                    className="text-[#8E9FA5] hover:text-[#D98A6C] underline cursor-pointer transition-colors duration-200"
                  >
                    Community Guidelines
                  </button>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* RESPONSIVE FOOTER: CLEAN WRAPPED MOBILE, HORIZONTAL DESKTOP  */}
      {/* ============================================================ */}
      <footer className="w-full border-t border-white/[0.06] bg-[#0A1117]/80 py-5 sm:py-0 sm:h-14 px-4 sm:px-8 lg:px-12 z-10 shrink-0">
        {/* Mobile Footer (< 640px): Centered, stacked, generous spacing */}
        <div className="flex sm:hidden flex-col items-center text-center space-y-3.5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#72848B]">
              &copy; 2026 IndoBid
            </div>
            <div className="text-[11px] text-[#8E9FA5]/80">
              Back opinions with conviction.
            </div>
          </div>

          {/* Clean wrapped group of links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 text-xs text-[#72848B] max-w-sm px-2">
            <button
              type="button"
              onClick={() => setInfoModal('about')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer py-0.5"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('how-it-works')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer py-0.5"
            >
              How IndoBid Works
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('terms')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer py-0.5"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('privacy')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer py-0.5"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('guidelines')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer py-0.5"
            >
              Community Guidelines
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('contact')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer py-0.5"
            >
              Contact
            </button>
          </div>
        </div>

        {/* Desktop Footer (>= 640px): Single clean horizontal line */}
        <div className="hidden sm:flex items-center justify-between w-full max-w-5xl xl:max-w-6xl mx-auto h-full">
          <div className="text-xs text-[#72848B] flex items-center space-x-2.5">
            <span>&copy; 2026 IndoBid</span>
            <span className="opacity-40">·</span>
            <span className="text-[#8E9FA5]/80">Back opinions with conviction.</span>
          </div>

          <div className="flex items-center space-x-6 text-xs text-[#72848B]">
            <button
              type="button"
              onClick={() => setInfoModal('about')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('how-it-works')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
            >
              How IndoBid Works
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('terms')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('privacy')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('guidelines')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
            >
              Community Guidelines
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('contact')}
              className="hover:text-[#F6F2EB] transition-colors duration-200 cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* AUTHENTIC INDOBID LEGAL & PRODUCT INFORMATION MODAL          */}
      {/* ============================================================ */}
      {infoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setInfoModal(null)}
        >
          <div
            className="relative w-full max-w-lg bg-[#0F1A1E] border border-white/[0.10] rounded-2xl p-6 sm:p-7 shadow-2xl text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center space-x-2">
                {infoModal === 'about' && <Info className="w-4 h-4 text-[#D98A6C]" />}
                {infoModal === 'how-it-works' && <HelpCircle className="w-4 h-4 text-[#D8A653]" />}
                {infoModal === 'terms' && <FileText className="w-4 h-4 text-[#D98A6C]" />}
                {infoModal === 'privacy' && <Shield className="w-4 h-4 text-[#00C896]" />}
                {infoModal === 'guidelines' && <Users className="w-4 h-4 text-[#E2987D]" />}
                {infoModal === 'contact' && <Mail className="w-4 h-4 text-[#D98A6C]" />}

                <h3 className="text-base font-bold text-[#F4EFE8] capitalize">
                  {infoModal === 'about' && 'About IndoBid'}
                  {infoModal === 'how-it-works' && 'How IndoBid Works'}
                  {infoModal === 'terms' && 'Terms of Service'}
                  {infoModal === 'privacy' && 'Privacy & Identity Integrity'}
                  {infoModal === 'guidelines' && 'Community Guidelines'}
                  {infoModal === 'contact' && 'Contact & Communications'}
                </h3>
              </div>
              <button
                onClick={() => setInfoModal(null)}
                className="p-1 rounded-lg text-[#687D82] hover:text-[#F4EFE8] hover:bg-white/[0.04] transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-white/[0.04] scrollbar-none text-[11px] font-semibold text-[#687D82]">
              {(['about', 'how-it-works', 'terms', 'privacy', 'guidelines', 'contact'] as InfoTab[]).map((mTab) => (
                <button
                  key={mTab}
                  onClick={() => setInfoModal(mTab)}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 capitalize cursor-pointer ${
                    infoModal === mTab
                      ? 'bg-[#D98A6C]/15 text-[#D98A6C] font-bold'
                      : 'hover:text-[#9AAEB4] hover:bg-white/[0.04]'
                  }`}
                >
                  {mTab.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="text-xs text-[#9AAEB4] space-y-3 leading-relaxed max-h-[55vh] overflow-y-auto pr-1 scrollbar-none">
              {infoModal === 'about' && (
                <>
                  <p>
                    <strong className="text-[#F4EFE8]">The Conviction Network:</strong> IndoBid is the premier marketplace of human thought where perspectives carry genuine weight. Unlike traditional platforms where low-effort likes and bot engagement drown out substance, IndoBid introduces economic conviction behind ideas.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">Skin in the Game:</strong> When someone backs an opinion with real money, they separate true conviction from casual attention. That signal powers our ranking, trending, and discovery algorithms.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">Editorial & Democratic:</strong> Everyone can participate freely, read arguments, join conversations, and support the voices that matter to them.
                  </p>
                </>
              )}

              {infoModal === 'how-it-works' && (
                <>
                  <p>
                    <strong className="text-[#F4EFE8]">1. Share:</strong> Publish an original debate or opinion on any topic — technology, philosophy, markets, startups, or culture.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">2. Continue:</strong> Others engage directly through substantive continuations and rebuttals, building branched, threaded dialogues.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">3. Back:</strong> Readers and debaters put monetary backing behind viewpoints. Backed content gains organic ranking momentum across our For You, Trending, and Reach surfaces.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">4. 50/50 Creator Split:</strong> Creators receive 50% of verified contributions made to their opinions, fostering a sustainable ecosystem for deep thought.
                  </p>
                </>
              )}

              {infoModal === 'terms' && (
                <>
                  <p>
                    <strong className="text-[#F4EFE8]">1. Acceptance of Terms:</strong> By creating an account or accessing IndoBid, you agree to these Terms of Service and all incorporated guidelines.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">2. Authentic Conviction:</strong> Users represent that their postings reflect honest human perspectives. Fraudulent manipulation, sybil attacks, or coordinated bot networks are grounds for permanent expulsion.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">3. Financial Transactions:</strong> Verified backings and platform contributions are processed through licensed payment gateways. Creator earnings are credited in accordance with verified ledger transactions.
                  </p>
                </>
              )}

              {infoModal === 'privacy' && (
                <>
                  <p>
                    <strong className="text-[#F4EFE8]">1. Ghost Mode:</strong> Users can enable Ghost Mode at any time. When Ghost Mode is active, your public username and display identity are masked across public feeds, discovery algorithms, and search.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">2. Private Accounts:</strong> Private accounts withhold posts and interactions from non-followers, providing complete boundary control.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">3. Data Stewardship:</strong> We do not sell your personal information. Authentication sessions are secured via cryptographic tokens and HttpOnly cookies.
                  </p>
                </>
              )}

              {infoModal === 'guidelines' && (
                <>
                  <p>
                    <strong className="text-[#F4EFE8]">1. Respectful Debate:</strong> Challenge ideas vigorously, but treat individuals with respect. Harassment, threats, hate speech, and doxxing are strictly prohibited.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">2. Original Arguments:</strong> Add value to the dialogue with substantive evidence, reasoning, and authentic perspectives.
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">3. Financial Fair Play:</strong> Self-support generates zero creator earnings. Coordinated payment fraud will trigger immediate forfeiture and reporting.
                  </p>
                </>
              )}

              {infoModal === 'contact' && (
                <>
                  <p>
                    <strong className="text-[#F4EFE8]">Founder:</strong> Vishal Kumar (Founder of IndoBid)
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">Inquiries:</strong> reach out to <span className="text-[#D98A6C] font-mono">founder@indobid.lol</span> or <span className="text-[#D98A6C] font-mono">support@indobid.lol</span>
                  </p>
                  <p>
                    <strong className="text-[#F4EFE8]">Headquarters:</strong> IndoBid Social Network · Back opinions with conviction.
                  </p>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end border-t border-white/[0.04]">
              <button
                onClick={() => setInfoModal(null)}
                className="py-1.5 px-4 rounded-xl bg-white/[0.06] text-[#9AAEB4] hover:text-[#F4EFE8] font-semibold text-xs border border-white/5 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
