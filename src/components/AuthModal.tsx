'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  X,
  Lock,
  Mail,
  User,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalMode, setAuthModalMode, refreshUser } = useAuth();

  // Verification Step: false = Form, true = OTP Verification
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  // 6-digit OTP code stored as array of 6 strings
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend Countdown Timer (minimum 60s cooldown)
  const [cooldown, setCooldown] = useState(0);

  // Form State
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isAuthModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAuthModalOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen && !loading) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, loading, closeAuthModal]);

  // Resend Countdown Timer Effect
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

  // Reset errors and verification state when modal opens or mode changes
  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowPassword(false);
    if (!isAuthModalOpen) {
      setIsVerifying(false);
      setOtpDigits(['', '', '', '', '', '']);
    }
  }, [authModalMode, isAuthModalOpen]);

  // Auto-focus first empty OTP input when entering verification step
  useEffect(() => {
    if (isVerifying && isAuthModalOpen) {
      const firstEmptyIndex = otpDigits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      setTimeout(() => {
        otpInputRefs.current[targetIndex]?.focus();
      }, 100);
    }
  }, [isVerifying, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP, GIF)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size must be 2MB or less');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle individual OTP input changes
  const handleDigitChange = (index: number, value: string) => {
    // Clean numeric value
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setErrorMsg(null);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // If all 6 digits filled, trigger auto-verification
    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      executeOtpVerification(fullCode);
    }
  };

  // Handle Backspace and Arrow navigation across OTP boxes
  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Move back and clear previous
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Paste of 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);
    setErrorMsg(null);

    // Focus appropriate box
    const focusIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[focusIndex]?.focus();

    if (pastedData.length === 6) {
      executeOtpVerification(pastedData);
    }
  };

  // Submit OTP Verification
  const executeOtpVerification = async (codeOverride?: string) => {
    const code = codeOverride || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
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
          code: code.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please try again.');
      }

      await refreshUser();
      closeAuthModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP code with 60s cooldown
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        throw new Error(data.error || 'Failed to resend verification code.');
      }

      setCooldown(60);
      setSuccessMsg('A new 6-digit verification code has been sent to your email.');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code');
    } finally {
      setLoading(false);
    }
  };

  // Handle Form Submit (Registration or Login)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (authModalMode === 'signup') {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        setErrorMsg('Email address is required.');
        return;
      }
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }

      setLoading(true);

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            displayName: displayName.trim() || username.trim(),
            email: cleanEmail,
            password,
            avatarUrl: avatarPreview || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to create account');
        }

        if (data.requiresVerification) {
          setVerificationEmail(cleanEmail);
          setIsVerifying(true);
          setCooldown(60);
          setOtpDigits(['', '', '', '', '', '']);
        } else {
          await refreshUser();
          closeAuthModal();
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to create account');
      } finally {
        setLoading(false);
      }
    } else {
      // Login flow
      setLoading(true);

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login: loginInput.trim(),
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.requiresVerification && data.email) {
            setVerificationEmail(data.email);
            setIsVerifying(true);
            setCooldown(60);
            setOtpDigits(['', '', '', '', '', '']);
            setErrorMsg(data.error || 'Please verify your email to continue.');
            return;
          }
          throw new Error(data.error || 'Invalid username/email or password');
        }

        await refreshUser();
        closeAuthModal();
      } catch (err: any) {
        setErrorMsg(err.message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Email address is required.');
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
      setSuccessMsg(data.message || "If an account exists for this email, we've sent password reset instructions.");
    } catch {
      setSuccessMsg("If an account exists for this email, we've sent password reset instructions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-md w-full h-[100dvh] overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          closeAuthModal();
        }
      }}
    >
      <div
        className="glass-modal max-w-md w-full rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),0_0_40px_rgba(217,138,108,0.04)] relative my-0 sm:my-auto max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto overscroll-contain min-w-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeAuthModal}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page-deep)] rounded-xl transition cursor-pointer disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 1. OTP EMAIL VERIFICATION STEP */}
        {isVerifying ? (
          <div className="space-y-5">
            <div className="space-y-1.5 text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-coral)]/15 border border-[var(--color-coral)]/30 flex items-center justify-center text-[var(--color-coral)]">
                  <Mail className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Verify your email
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                We sent a 6-digit code to your email.
              </p>
              <div className="pt-1 flex items-center justify-center space-x-2 text-xs font-semibold text-[var(--text-primary)]">
                <span className="truncate max-w-[240px] text-[var(--color-coral)]">{verificationEmail}</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifying(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
                >
                  Change email
                </button>
              </div>
            </div>

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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeOtpVerification();
              }}
              className="space-y-5"
            >
              {/* 6-Box Segmented OTP Input: [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ] */}
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 py-1">
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
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-10 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] focus:ring-2 focus:ring-[var(--color-coral)]/20 rounded-xl text-[var(--text-primary)] focus:outline-none transition"
                  />
                ))}
              </div>

              {/* Primary Action: Verify Email */}
              <button
                type="submit"
                disabled={loading || otpDigits.join('').length !== 6}
                className="w-full h-12 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#07171C] font-semibold text-sm rounded-xl shadow-md shadow-[var(--color-coral)]/15 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Secondary Action: Resend code with cooldown */}
              <div className="text-center pt-1 text-xs">
                {cooldown > 0 ? (
                  <span className="text-[var(--text-muted)]">
                    Resend code in <strong className="text-[var(--text-secondary)]">{cooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="font-bold text-[var(--color-coral)] hover:underline inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend code</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : authModalMode === 'forgot-password' ? (
          /* 2. FORGOT PASSWORD STEP */
          <div className="space-y-4">
            <div className="mb-5 space-y-2">
              <Logo size="sm" />
              <h2 className="text-xl font-bold font-bodoni text-[var(--text-primary)] tracking-tight">
                Reset your password
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Enter your email address and we&apos;ll send you a secure link to reset your password.
              </p>
            </div>

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

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Email address <span className="text-[var(--color-coral)]">*</span>
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl pl-10 pr-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !forgotEmail}
                className="w-full h-12 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#07171C] font-semibold text-sm rounded-xl shadow-md shadow-[var(--color-coral)]/15 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-4 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
              <button
                onClick={() => {
                  setAuthModalMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="font-bold text-[var(--color-coral)] hover:underline cursor-pointer inline-flex items-center space-x-1"
              >
                <span>&larr; Back to Sign In</span>
              </button>
            </div>
          </div>
        ) : (
          /* 3. REGISTRATION / SIGN IN FORM */
          <>
            <div className="mb-6 space-y-2 text-center">
              <div className="flex justify-center mb-1">
                <Logo size="md" />
              </div>
              <h2 className="text-xl font-bold font-bodoni text-[var(--text-primary)] tracking-tight">
                {authModalMode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                {authModalMode === 'signup'
                  ? 'Join the high-conviction social community. Back opinions with skin in the game.'
                  : 'Sign in to post opinions, back debates, and track creator earnings.'}
              </p>
            </div>

            {/* Equal-Width Tabs: Log in vs Create account */}
            <div className="flex border-b border-[var(--border-subtle)] mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-semibold text-center transition-colors duration-200 relative cursor-pointer ${
                  authModalMode === 'login'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Log in
                {authModalMode === 'login' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-coral)] rounded-full shadow-[0_0_10px_rgba(217,138,108,0.4)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-semibold text-center transition-colors duration-200 relative cursor-pointer ${
                  authModalMode === 'signup'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Create account
                {authModalMode === 'signup' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-coral)] rounded-full shadow-[0_0_10px_rgba(217,138,108,0.4)]" />
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span className="line-clamp-2">{errorMsg}</span>
              </div>
            )}

            {/* 1. Continue with Google (Primary Social Authentication) */}
            <button
              type="button"
              onClick={() => {
                window.location.href = '/api/auth/google';
              }}
              className="w-full h-12 px-4 rounded-xl bg-[var(--bg-page-deep)]/90 hover:bg-[var(--bg-card-hover)] border border-white/[0.09] hover:border-white/[0.18] text-sm font-medium text-[var(--text-primary)] transition-all duration-200 flex items-center justify-center space-x-3 cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* 2. Divider: OR */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border-subtle)]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-[0.2em] text-[var(--text-muted)]">
                <span className="bg-[var(--bg-surface)] px-2">OR</span>
              </div>
            </div>

            {/* 3. Credential Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {authModalMode === 'signup' ? (
                <>
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      Username <span className="text-[var(--color-coral)]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs text-[var(--text-muted)] font-mono pointer-events-none">@</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="username"
                        maxLength={25}
                        className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl pl-9 pr-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                      />
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your Name"
                      maxLength={40}
                      className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl px-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      Email address <span className="text-[var(--color-coral)]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl pl-10 pr-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      Password <span className="text-[var(--color-coral)]">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="•••••••• (min 6 characters)"
                        className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl pl-10 pr-11 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Optional Profile Photo in Signup */}
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-[var(--bg-page-deep)]/60 border border-[var(--border-subtle)]">
                    <Avatar
                      src={avatarPreview}
                      name={displayName || username || 'Debater'}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-[var(--text-primary)]">Profile Photo</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Optional · Max 2MB</div>
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
                        className="px-2 py-1 text-[11px] font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg transition inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3 text-[var(--color-coral)]" />
                        <span>{avatarPreview ? 'Change' : 'Upload'}</span>
                      </button>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={() => setAvatarPreview(null)}
                          className="p-1 text-[var(--text-muted)] hover:text-red-400 rounded-lg transition cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Email / Username */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      Email / username
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={loginInput}
                        onChange={(e) => setLoginInput(e.target.value)}
                        placeholder="e.g. rohan or you@domain.com"
                        className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl pl-10 pr-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthModalMode('forgot-password');
                          setForgotEmail(loginInput.includes('@') ? loginInput : '');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] font-semibold text-[var(--color-coral)] hover:underline cursor-pointer transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 bg-[var(--bg-page-deep)]/90 border border-white/[0.09] focus:border-[var(--color-coral)] focus:ring-1 focus:ring-[var(--color-coral)]/25 rounded-xl pl-10 pr-11 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Keep me signed in */}
                  <div className="flex items-center text-xs pt-1">
                    <label className="flex items-center space-x-2 text-[var(--text-secondary)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={keepSignedIn}
                        onChange={(e) => setKeepSignedIn(e.target.checked)}
                        className="rounded bg-[var(--bg-page-deep)] border-white/20 text-[var(--color-coral)] focus:ring-[var(--color-coral)]/30 w-3.5 h-3.5 cursor-pointer accent-[var(--color-coral)]"
                      />
                      <span>Keep me signed in</span>
                    </label>
                  </div>
                </>
              )}

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#07171C] font-semibold text-sm rounded-xl shadow-md shadow-[var(--color-coral)]/15 transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-4 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{authModalMode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <span>{authModalMode === 'signup' ? 'Create account' : 'Log in'}</span>
                )}
              </button>
            </form>

            {/* Legal Notice */}
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
              By continuing, you agree to IndoBid&apos;s{' '}
              <a href="/?info=terms" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] underline">Terms</a>
              ,{' '}
              <a href="/?info=privacy" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] underline">Privacy</a>
              {' '}and{' '}
              <a href="/?info=guidelines" className="text-[var(--text-secondary)] hover:text-[var(--color-coral)] underline">Community Guidelines</a>.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
