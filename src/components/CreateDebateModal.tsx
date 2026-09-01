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
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CreateDebateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: Category[];
}

export function CreateDebateModal({ isOpen, onClose }: CreateDebateModalProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [postText, setPostText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [showHashtagsInput, setShowHashtagsInput] = useState(false);
  const [categorySlug, setCategorySlug] = useState('ai');
  const [username, setUsername] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [amountRupees, setAmountRupees] = useState(10);
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
    } else if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('indobid_username');
      if (savedUser) setUsername(savedUser);
      const savedEmail = localStorage.getItem('indobid_email');
      if (savedEmail) setEmail(savedEmail);
    }
  }, [user]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setLoading(false);
      setVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const presetAmounts = [10, 15, 25, 50, 100];

  const handleAmountChange = (newVal: number) => {
    setAmountRupees(Math.max(10, newVal));
  };

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
      setErrorMsg('Please write at least 5 characters for your post.');
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

      // Natural mapping: Derive title and content seamlessly from single text area
      const lines = trimmedText.split('\n').filter((l) => l.trim().length > 0);
      let title = lines[0] || trimmedText;
      if (title.length > 180) {
        title = title.substring(0, 180).trim();
      }
      if (title.length < 5) {
        title = trimmedText.substring(0, 180).trim();
      }

      const content = trimmedText.length >= 10 ? trimmedText : `${trimmedText} (opinion)`;
      const amountPaise = amountRupees * 100;

      // Combine manually added hashtags with any in-text #tags
      let combinedHashtags = hashtags.trim();
      const inTextTags = (trimmedText.match(/#[a-zA-Z0-9_]+/g) || []).join(' ');
      if (inTextTags) {
        combinedHashtags = combinedHashtags ? `${combinedHashtags} ${inTextTags}` : inTextTags;
      }

      // 1. Call Backend Order Creation API
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
          amountPaise,
          email: email || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize post');
      }

      const { orderId, keyId, debateId, contributionId } = data;

      // 2. Open Razorpay Checkout if available
      if (typeof window !== 'undefined' && (window as any).Razorpay && keyId && keyId !== 'rzp_test_placeholder') {
        const options = {
          key: keyId,
          amount: amountPaise,
          currency: 'INR',
          name: 'IndoBid.lol',
          description: `Post: ${title.substring(0, 30)}`,
          order_id: orderId,
          prefill: {
            name: isAnonymous ? 'Anonymous' : (username || 'Debater'),
            email: email || undefined,
          },
          theme: {
            color: '#D98A6C',
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
                  amountPaise,
                }),
              });

              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
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
        // Dev / Test Fallback
        setVerifying(true);
        const mockPayId = `rzp_mock_${Date.now()}`;
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_payment_id: mockPayId,
            razorpay_order_id: orderId,
            razorpay_signature: 'dev_mock_signature',
            debateId,
            contributionId,
            amountPaise,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          onClose();
          router.push(`/debate/${debateId}`);
        } else {
          throw new Error(verifyData.error || 'Failed to verify simulated payment');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creating post');
      setLoading(false);
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto w-full">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] max-w-lg w-full rounded-t-3xl sm:rounded-3xl shadow-2xl relative overflow-hidden transition-all flex flex-col max-h-[92vh] my-0 sm:my-auto min-w-0">
        {/* Clean Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
            Create Post
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page-deep)] rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-none flex-1 min-w-0 w-full">
          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {verifying ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[var(--color-coral)] animate-spin mx-auto" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">Publishing...</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                Verifying payment. Your post will be live on the feed in a moment.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
              {/* User Row with Compact Anonymous Toggle */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center space-x-2.5 min-w-0 flex-1 overflow-hidden">
                  <Avatar
                    src={user?.avatarUrl}
                    name={user?.displayName || user?.username}
                    username={user?.username}
                    size="sm"
                    isAnonymous={isAnonymous}
                  />
                  <div className="min-w-0 flex-1 overflow-hidden leading-tight">
                    <div className="flex items-center space-x-1">
                      <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                        {isAnonymous ? 'Anonymous' : (user?.displayName || username || 'You')}
                      </span>
                      {!isAnonymous && user?.isVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-lime)] shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] block truncate">
                      {isAnonymous ? 'Posting as Anonymous' : (user ? `@${user.username}` : 'Public')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition flex items-center space-x-1.5 cursor-pointer shrink-0 border ${
                    isAnonymous
                      ? 'bg-[var(--color-coral)] text-[#071B21] border-[var(--color-coral)] font-bold shadow-xs'
                      : 'bg-[var(--bg-page-deep)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                  title="Toggle anonymous mode"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Anonymous</span>
                </button>
              </div>

              {/* Main Clean Text Area */}
              <div className="min-w-0">
                <textarea
                  required
                  rows={4}
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="What’s on your mind?"
                  maxLength={3000}
                  className="w-full bg-transparent border-0 focus:ring-0 p-0 text-sm sm:text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition resize-none leading-relaxed min-h-[90px]"
                  autoFocus
                />
              </div>

              {/* Image Preview if selected */}
              {imagePreview && (
                <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] max-h-48 group">
                  <img
                    src={imagePreview}
                    alt="Attachment preview"
                    className="w-full h-48 object-cover"
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

              {/* Optional Compact Hashtags Input */}
              {showHashtagsInput && (
                <div className="min-w-0 pt-1">
                  <input
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#AI #Tech (optional)"
                    className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none transition font-medium"
                  />
                </div>
              )}

              {/* Publishing Amount Section */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2.5 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)]">
                    Publishing amount
                  </span>
                  <span className="text-[11px] text-[var(--color-amber)] font-mono font-bold">
                    ₹10 minimum
                  </span>
                </div>

                {/* Preset Pills */}
                <div className="grid grid-cols-5 gap-1.5 w-full min-w-0">
                  {presetAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleAmountChange(amt)}
                      className={`py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer text-center ${
                        amountRupees === amt
                          ? 'bg-[var(--color-coral)] text-[#071B21] shadow-xs'
                          : 'bg-[var(--bg-page-deep)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                {/* Stepper for custom higher amount */}
                <div className="flex items-center space-x-2 pt-0.5 w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => handleAmountChange(amountRupees - 1)}
                    disabled={amountRupees <= 10}
                    className="w-8 h-8 rounded-xl bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-card-hover)] transition cursor-pointer flex items-center justify-center shrink-0"
                    aria-label="Decrease amount"
                  >
                    −
                  </button>
                  <div className="flex-1 relative min-w-0">
                    <span className="absolute left-3 top-1.5 text-xs font-bold text-[var(--color-coral)]">₹</span>
                    <input
                      type="number"
                      min={10}
                      value={amountRupees}
                      onChange={(e) => handleAmountChange(parseInt(e.target.value || '10', 10))}
                      className="w-full bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] focus:border-[var(--color-coral)] rounded-xl pl-7 pr-3 py-1 text-xs font-bold text-[var(--text-primary)] font-mono focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAmountChange(amountRupees + 1)}
                    className="w-8 h-8 rounded-xl bg-[var(--bg-page-deep)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-xs hover:bg-[var(--bg-card-hover)] transition cursor-pointer flex items-center justify-center shrink-0"
                    aria-label="Increase amount"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Primary Post CTA Button */}
              <button
                type="submit"
                disabled={loading || amountRupees < 10 || postText.trim().length < 5}
                className="w-full py-3 bg-[var(--color-coral)] hover:bg-[var(--color-coral-bright)] text-[#071B21] font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-[0.99] h-11 sm:h-12"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <span>Post · ₹{amountRupees}</span>
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
