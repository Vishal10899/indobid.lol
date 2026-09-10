'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Hash,
  EyeOff,
  Coins,
  Sparkles,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import {
  formatINR,
  getMinimumSupport,
  getCurrencyConfig,
  exchangeRateService,
  formatCurrencyAmount,
  BASE_INR_PRESETS,
} from '@/lib/money';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CreateDebateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: Category[];
  onCreated?: () => void;
}

export function CreateDebateModal({ isOpen, onClose, onCreated }: CreateDebateModalProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [postText, setPostText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [showHashtagsInput, setShowHashtagsInput] = useState(false);
  const [categorySlug, setCategorySlug] = useState('ai');
  const [username, setUsername] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Publishing Mode: 'free' (Default) or 'backed' (Optional Conviction)
  const [publishMode, setPublishMode] = useState<'free' | 'backed'>('free');
  const [currency, setCurrency] = useState<string>('INR');
  const currencyConfig = getCurrencyConfig(currency);
  const minSupport = getMinimumSupport(currency);
  const minMajor = minSupport.minimumMinorUnits / Math.pow(10, currencyConfig.decimals);

  const [amount, setAmount] = useState<number>(minMajor);
  const [amountRupees, setAmountRupees] = useState<number>(10);
  const [email, setEmail] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      if (user.email) setEmail(user.email);
      if (user.currencyCode) {
        handleCurrencyChange(user.currencyCode);
      }
    } else if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('indobid_username');
      if (savedUser) setUsername(savedUser);
      const savedEmail = localStorage.getItem('indobid_email');
      if (savedEmail) setEmail(savedEmail);
      const savedCurrency = localStorage.getItem('indobid_currency');
      if (savedCurrency) {
        handleCurrencyChange(savedCurrency);
      }
    }
  }, [user]);

  // Lock body scroll and handle Escape key while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !loading && !verifying) {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, loading, verifying, onClose]);

  // Restore draft when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setLoading(false);
      setVerifying(false);
      
      try {
        if (typeof window !== 'undefined') {
          const draftStr = localStorage.getItem('indobid_composer_draft');
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            if (draft.postText && !postText) {
              setPostText(draft.postText || '');
              setHashtags(draft.hashtags || '');
              if (draft.categorySlug) setCategorySlug(draft.categorySlug);
              if (typeof draft.isAnonymous === 'boolean') setIsAnonymous(draft.isAnonymous);
              if (draft.publishMode) setPublishMode(draft.publishMode);
              if (draft.currency) handleCurrencyChange(draft.currency);
              if (typeof draft.amount === 'number') setAmount(draft.amount);
              else if (draft.amountRupees) {
                setAmountRupees(draft.amountRupees);
                setAmount(draft.amountRupees);
              }
              if (draft.imagePreview) setImagePreview(draft.imagePreview);
            }
          }
        }
      } catch {}
    }
  }, [isOpen]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (postText.trim() || hashtags.trim() || imagePreview)) {
      try {
        localStorage.setItem(
          'indobid_composer_draft',
          JSON.stringify({
            postText,
            hashtags,
            categorySlug,
            isAnonymous,
            publishMode,
            currency,
            amount,
            amountRupees,
            imagePreview,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }
  }, [postText, hashtags, categorySlug, isAnonymous, publishMode, currency, amount, amountRupees, imagePreview]);

  const handleCurrencyChange = (newCurrency: string) => {
    const cleanCurr = newCurrency.toUpperCase().trim();
    setCurrency(cleanCurr);
    if (typeof window !== 'undefined') {
      localStorage.setItem('indobid_currency', cleanCurr);
    }
    const newConfig = getCurrencyConfig(cleanCurr);
    const newMinSupport = getMinimumSupport(cleanCurr);
    const newMinMajor = newMinSupport.minimumMinorUnits / Math.pow(10, newConfig.decimals);
    setAmount(newMinMajor);
    setAmountRupees(cleanCurr === 'INR' ? newMinMajor : 10);
  };

  const handleAmountChange = (newVal: number) => {
    if (isNaN(newVal)) return;
    const clamped = Math.max(minMajor, newVal);
    const precision = Math.pow(10, currencyConfig.decimals);
    const rounded = Math.round(clamped * precision) / precision;
    setAmount(rounded);
    if (currency === 'INR') {
      setAmountRupees(rounded);
    }
  };

  const handleDecrement = () => {
    const step = currencyConfig.decimals === 0 ? 1 : amount > 2 ? 1 : 0.10;
    const nextVal = Math.max(minMajor, Math.round((amount - step) * 100) / 100);
    setAmount(nextVal);
    if (currency === 'INR') {
      setAmountRupees(nextVal);
    }
  };

  const handleIncrement = () => {
    const step = currencyConfig.decimals === 0 ? 1 : amount < 1 ? 0.10 : 1;
    const nextVal = Math.round((amount + step) * 100) / 100;
    setAmount(nextVal);
    if (currency === 'INR') {
      setAmountRupees(nextVal);
    }
  };

  const presetAmounts = React.useMemo(() => {
    if (currency === 'INR') return [10, 20, 50, 100, 250, 500];
    if (currency === 'USD') return [0.12, 0.50, 1, 2, 5, 10];
    return BASE_INR_PRESETS.map((baseInr) => {
      const minor = exchangeRateService.convertFromBase(baseInr * 100, currency);
      return Number((minor / Math.pow(10, currencyConfig.decimals)).toFixed(currencyConfig.decimals));
    });
  }, [currency, currencyConfig.decimals]);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedText = postText.trim();
    if (trimmedText.length < 5) {
      setErrorMsg('Please write at least 5 characters for your opinion.');
      return;
    }

    setLoading(true);

    try {
      if (username.trim() && typeof window !== 'undefined') {
        localStorage.setItem('indobid_username', username.trim());
      }
      if (email.trim() && typeof window !== 'undefined') {
        localStorage.setItem('indobid_email', email.trim());
      }

      // Natural mapping: Derive title and content seamlessly from text area
      const lines = trimmedText.split('\n').filter((l) => l.trim().length > 0);
      let title = lines[0] || trimmedText;
      if (title.length > 180) {
        title = title.substring(0, 180).trim();
      }
      if (title.length < 5) {
        title = trimmedText.substring(0, 180).trim();
      }

      const content = trimmedText.length >= 10 ? trimmedText : `${trimmedText} (opinion)`;
      const isFree = publishMode === 'free';
      const targetMinorUnits = Math.round(amount * Math.pow(10, currencyConfig.decimals));
      const amountPaise = isFree ? 0 : exchangeRateService.convertToBase(targetMinorUnits, currency);

      // Combine hashtags
      let combinedHashtags = hashtags.trim();
      const inTextTags = (trimmedText.match(/#[a-zA-Z0-9_]+/g) || []).join(' ');
      if (inTextTags) {
        combinedHashtags = combinedHashtags ? `${combinedHashtags} ${inTextTags}` : inTextTags;
      }

      // 1. Call Backend Creation API
      const res = await fetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          categorySlug,
          hashtags: combinedHashtags || undefined,
          authorUsername: isAnonymous ? undefined : username || undefined,
          isAnonymous,
          isFree,
          amount: isFree ? 0 : amount,
          currency,
          currencyCode: currency,
          amountPaise: isFree ? 0 : amountPaise,
          email: email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize opinion');
      }

      // Free opinion or Founder post -> Immediately published!
      if (data.published || isFree || data.isFree) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('indobid_composer_draft');
        }
        onCreated?.();
        onClose();
        router.push(`/debate/${data.debateId}`);
        return;
      }

      const { orderId, keyId, debateId, contributionId } = data;
      const checkoutPaise = data.amount || amountPaise;

      // 2. Open Razorpay Checkout for Optional Backed Post
      if (typeof window !== 'undefined' && (window as any).Razorpay && keyId && keyId !== 'rzp_test_placeholder') {
        const options = {
          key: keyId,
          amount: checkoutPaise,
          currency: 'INR',
          name: 'IndoBid',
          description: `Support Opinion: ${title.substring(0, 30)}`,
          order_id: orderId,
          prefill: {
            name: isAnonymous ? 'Anonymous' : (username || 'Debater'),
            email: email || undefined,
          },
          theme: {
            color: '#BA5133',
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
                  debateId,
                  contributionId,
                  amountPaise: checkoutPaise,
                }),
              });

              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('indobid_composer_draft');
                }
                onCreated?.();
                onClose();
                router.push(`/debate/${debateId}`);
              } else {
                throw new Error(verifyData.error || 'Payment verification failed');
              }
            } catch (verErr) {
              setErrorMsg(verErr instanceof Error ? verErr.message : 'Payment verification failed');
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
        throw new Error('Payment gateway is currently initializing or unavailable. Please refresh or try again.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creating opinion');
      setLoading(false);
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-md w-full h-[100dvh] overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !verifying) {
          onClose();
        }
      }}
    >
      <div
        className="glass-modal max-w-lg w-full rounded-t-3xl sm:rounded-3xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),0_0_40px_rgba(217,138,108,0.04)] relative overflow-hidden transition-all flex flex-col max-h-[90dvh] sm:max-h-[85vh] h-auto my-0 sm:my-auto min-w-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
            Share Opinion
          </h2>
          <button
            onClick={onClose}
            disabled={loading || verifying}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-page-deep)] transition cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain min-w-0 flex-1 min-h-0 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 text-xs rounded-2xl flex items-center space-x-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {verifying ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[var(--color-coral)] animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Publishing Opinion</h3>
                <p className="text-xs text-[var(--text-secondary)]">Activating your post on the platform...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Author & Controls Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <Avatar
                    src={user?.avatarUrl}
                    name={user?.displayName || user?.username || username}
                    username={user?.username || username}
                    size="sm"
                    isAnonymous={isAnonymous}
                  />
                  <div className="leading-tight">
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      {isAnonymous ? 'Anonymous' : (user?.displayName || user?.username || username || 'You')}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {isAnonymous ? 'Identity masked' : `@${user?.username || username || 'debater'}`}
                    </span>
                  </div>
                </div>

                {/* Anonymous Toggle */}
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer flex items-center space-x-1 ${
                    isAnonymous
                      ? 'bg-[var(--color-coral)]/15 text-[var(--color-coral)] border-[var(--color-coral)]/30 font-bold'
                      : 'bg-[var(--bg-page-deep)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                  title="Toggle anonymous mode"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Anonymous</span>
                </button>
              </div>

              {/* Main Opinion Text Area */}
              <div className="min-w-0">
                <textarea
                  required
                  rows={3}
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="What’s your perspective? State your opinion..."
                  maxLength={3000}
                  className="w-full bg-transparent border-0 focus:ring-0 p-0 text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition resize-none leading-relaxed min-h-[75px] max-h-[140px] overflow-y-auto"
                  autoFocus
                />
              </div>

              {/* Image Preview if selected */}
              {imagePreview && (
                <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] max-h-40 group">
                  <img
                    src={imagePreview}
                    alt="Attachment preview"
                    className="w-full h-40 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition cursor-pointer"
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Media Attachment & Hashtag Action Icons */}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--color-coral)] hover:bg-[var(--bg-page-deep)] transition cursor-pointer flex items-center space-x-1"
                    title="Add image"
                    aria-label="Add image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowHashtagsInput(!showHashtagsInput)}
                    className={`p-2 rounded-xl transition cursor-pointer flex items-center space-x-1 ${
                      showHashtagsInput || hashtags
                        ? 'text-[var(--color-coral)] bg-[var(--bg-page-deep)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--color-coral)] hover:bg-[var(--bg-page-deep)]'
                    }`}
                    title="Add hashtags"
                    aria-label="Add hashtags"
                  >
                    <Hash className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[11px] text-[var(--text-muted)] font-mono">
                  {3000 - postText.length}
                </div>
              </div>

              {/* Optional Hashtags Input */}
              {showHashtagsInput && (
                <div className="min-w-0 pt-1">
                  <input
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#AI #Markets (optional)"
                    className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-medium"
                  />
                </div>
              )}

              {/* STEP 2: PUBLISHING MODE SELECTION (Free vs Optional Conviction Backing) */}
              {/* STEP 2: PUBLISHING MODE SELECTION (Free vs Add Conviction) */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2.5 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                    Conviction
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Posting is free
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Option A: Free */}
                  <button
                    type="button"
                    onClick={() => setPublishMode('free')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                      publishMode === 'free'
                        ? 'bg-[var(--bg-surface)] border-[var(--color-coral)] text-[var(--text-primary)] shadow-xs ring-1 ring-[var(--color-coral)]/30'
                        : 'bg-[var(--bg-page-deep)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${publishMode === 'free' ? 'bg-[var(--color-coral)]' : 'border border-[var(--text-muted)]'}`} />
                    <span>Free</span>
                  </button>

                  {/* Option B: Add conviction */}
                  <button
                    type="button"
                    onClick={() => setPublishMode('backed')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                      publishMode === 'backed'
                        ? 'bg-[var(--bg-surface)] border-[var(--color-amber)] text-[var(--text-primary)] shadow-xs ring-1 ring-[var(--color-amber)]/30'
                        : 'bg-[var(--bg-page-deep)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${publishMode === 'backed' ? 'bg-[var(--color-amber)]' : 'border border-[var(--text-muted)]'}`} />
                    <span>Add conviction</span>
                  </button>
                </div>

                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Posting is free. Add conviction if you want to put money behind your opinion.
                </p>

                {/* Backed Options Expanded Drawer */}
                {publishMode === 'backed' && (
                  <div className="p-3.5 rounded-2xl bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[var(--text-primary)]">
                          Select Amount ({currency})
                        </span>
                        <select
                          value={currency}
                          onChange={(e) => handleCurrencyChange(e.target.value)}
                          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer"
                          aria-label="Select currency"
                        >
                          <option value="INR">₹ INR</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                          <option value="GBP">£ GBP</option>
                          <option value="CAD">CA$ CAD</option>
                          <option value="AUD">A$ AUD</option>
                          <option value="JPY">¥ JPY</option>
                          <option value="SGD">S$ SGD</option>
                          <option value="AED">AED</option>
                        </select>
                      </div>
                      <span className="text-[11px] text-[var(--color-amber)] font-mono font-bold">
                        {minSupport.formatted} minimum
                      </span>
                    </div>

                    {/* Preset Amount Chips */}
                    <div className="grid grid-cols-6 gap-1.5 w-full min-w-0">
                      {presetAmounts.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleAmountChange(amt)}
                          className={`py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer text-center ${
                            amount === amt
                              ? 'bg-[var(--color-coral)] text-[#071B21] shadow-xs'
                              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          {currencyConfig.symbol}{amt}
                        </button>
                      ))}
                    </div>

                    {/* Amount Stepper Input */}
                    <div className="flex items-center space-x-2 w-full min-w-0">
                      <button
                        type="button"
                        onClick={handleDecrement}
                        disabled={amount <= minMajor}
                        className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)] transition cursor-pointer flex items-center justify-center shrink-0"
                        aria-label="Decrease amount"
                      >
                        −
                      </button>
                      <div className="flex-1 relative min-w-0">
                        <span className="absolute left-3 top-1.5 text-xs font-bold text-[var(--color-coral)]">
                          {currencyConfig.symbol}
                        </span>
                        <input
                          type="number"
                          min={minMajor}
                          step={currencyConfig.decimals > 0 ? '0.01' : '1'}
                          value={amount}
                          onChange={(e) => handleAmountChange(parseFloat(e.target.value || String(minMajor)))}
                          onBlur={() => { if (!amount || amount < minMajor) setAmount(minMajor); }}
                          className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-7 pr-3 py-1 text-xs font-bold text-[var(--text-primary)] font-mono focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleIncrement}
                        className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs hover:bg-[var(--bg-card-hover)] transition cursor-pointer flex items-center justify-center shrink-0"
                        aria-label="Increase amount"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      50% of external support contributions are allocated to the creator. Backing represents financial conviction.
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (publishMode === 'backed' && amount < minMajor) || postText.trim().length < 5}
                className="w-full py-3 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] h-11 sm:h-12"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : publishMode === 'free' ? (
                  <span>Post</span>
                ) : (
                  <span>Continue to payment · {currencyConfig.symbol}{amount}</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateDebateModal;
