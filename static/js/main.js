/**
 * indobid.lol - Client-Side Logic
 * Lightweight vanilla JavaScript handling live countdown, progress bar,
 * Razorpay checkout integration, and dynamic round status updates.
 */

(function () {
  'use strict';

  // State
  let targetEndTime = null;
  let countdownInterval = null;
  let isResolvingRound = false;

  // DOM Elements
  const countdownEl = document.getElementById('countdown-display');
  const countdownBox = document.getElementById('countdown-container');
  const progressBar = document.getElementById('round-progress-bar');
  const liveRoundTitle = document.getElementById('live-round-title');
  const activePoolCount = document.getElementById('active-pool-count');
  const currentEntriesBadge = document.getElementById('current-entries-badge');
  const currentEntriesContainer = document.getElementById('current-entries-container');
  const entryPaymentForm = document.getElementById('entry-payment-form');
  const payButton = document.getElementById('pay-button');
  const payButtonText = document.getElementById('pay-button-text');
  const paymentFeedback = document.getElementById('payment-feedback');
  const statVisitors = document.getElementById('stat-visitors');
  const statEntries = document.getElementById('stat-entries');
  const statClicks = document.getElementById('stat-clicks');
  const featuredWinnersContainer = document.getElementById('featured-winners-container');

  // Initialize
  function init() {
    setupCountdown();
    setupEntryPaymentForm();
  }

  // --- Countdown and Progress Bar ---
  function setupCountdown() {
    if (!countdownBox) return;

    const rawEndTime = countdownBox.getAttribute('data-end-time');
    if (rawEndTime) {
      targetEndTime = new Date(rawEndTime).getTime();
      startCountdownTimer();
    }
  }

  function startCountdownTimer() {
    if (countdownInterval) clearInterval(countdownInterval);

    function update() {
      if (!targetEndTime || !countdownEl) return;

      const now = Date.now();
      const diff = targetEndTime - now;

      if (diff <= 0) {
        countdownEl.textContent = '00 : 00';
        if (progressBar) progressBar.style.width = '100%';
        if (!isResolvingRound) {
          handleRoundEnded();
        }
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      const pad = (n) => String(n).padStart(2, '0');
      countdownEl.textContent = `${pad(minutes)} : ${pad(seconds)}`;

      // Update progress bar for 60-minute (3600s) round
      if (progressBar) {
        const elapsed = Math.max(0, 3600 - totalSeconds);
        const percent = Math.min(100, Math.max(0, (elapsed / 3600) * 100));
        progressBar.style.width = `${percent.toFixed(1)}%`;
      }
    }

    update();
    countdownInterval = setInterval(update, 1000);
  }

  async function handleRoundEnded() {
    isResolvingRound = true;
    if (countdownEl) {
      countdownEl.innerHTML = '<span class="text-purple-600 animate-pulse text-2xl sm:text-3xl font-extrabold">DRAWING WINNERS...</span>';
    }

    // Wait 2.5 seconds, then sync with backend
    setTimeout(async () => {
      await fetchRoundStatus();
      isResolvingRound = false;
    }, 2500);
  }

  // --- Fetch Latest Round State ---
  async function fetchRoundStatus() {
    try {
      const res = await fetch('/api/round-status');
      if (!res.ok) return;
      const data = await res.json();

      // Update end time & restart timer
      if (data.end_time) {
        targetEndTime = new Date(data.end_time).getTime();
        if (countdownBox) countdownBox.setAttribute('data-end-time', data.end_time);
        startCountdownTimer();
      }

      // Update Round Title
      if (liveRoundTitle && data.round_id) {
        liveRoundTitle.textContent = `LIVE ROUND #${data.round_id}`;
      }

      // Update Active Counts
      const countText = typeof data.entries_count !== 'undefined' ? data.entries_count : 0;
      if (activePoolCount) activePoolCount.textContent = `${countText} active entries`;
      if (currentEntriesBadge) currentEntriesBadge.textContent = countText;

      // Update Real Stats
      if (data.stats) {
        if (statVisitors && typeof data.stats.total_visitors !== 'undefined') {
          statVisitors.textContent = data.stats.total_visitors;
        }
        if (statEntries && typeof data.stats.total_entries !== 'undefined') {
          statEntries.textContent = data.stats.total_entries;
        }
        if (statClicks && typeof data.stats.profile_clicks !== 'undefined') {
          statClicks.textContent = data.stats.profile_clicks;
        }
      }

      // Update Current Entries List
      if (data.glass_box_entries && currentEntriesContainer) {
        renderCurrentEntries(data.glass_box_entries, data.round_id);
      }

      // If winners crowned and container exists, refresh page or update podium
      if (data.latest_winners && data.latest_winners.length > 0) {
        renderWinnersPodium(data.latest_winners);
      }
    } catch (err) {
      console.warn('Status sync error:', err);
    }
  }

  function renderCurrentEntries(entries, roundId) {
    if (!currentEntriesContainer) return;

    if (!entries || entries.length === 0) {
      currentEntriesContainer.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          <p class="text-xs font-medium text-slate-500">No entries yet in Round #${roundId || ''}</p>
          <p class="text-[11px] text-slate-400 mt-1">Be the first to enter this round!</p>
        </div>
      `;
      return;
    }

    currentEntriesContainer.innerHTML = entries.map(item => `
      <div class="participant-pill flex items-center justify-between p-2.5 rounded-xl">
        <div class="flex items-center space-x-2.5 truncate">
          <div class="avatar-circle">
            ${escapeHtml(item.initial || (item.display_name ? item.display_name[0].toUpperCase() : '?'))}
          </div>
          <div class="truncate">
            <div class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.display_name)}</div>
            <div class="text-[10px] text-slate-400 capitalize">${escapeHtml(item.platform)}</div>
          </div>
        </div>
        <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          Eligible
        </span>
      </div>
    `).join('');
  }

  function renderWinnersPodium(winners) {
    if (!featuredWinnersContainer) return;

    featuredWinnersContainer.innerHTML = winners.map(w => {
      let cardClass = 'card-winner-bronze';
      let badgeClass = 'badge-bronze';
      if (w.position === 1) {
        cardClass = 'card-winner-gold';
        badgeClass = 'badge-gold';
      } else if (w.position === 2) {
        cardClass = 'card-winner-silver';
        badgeClass = 'badge-silver';
      }

      const displayName = w.entry ? w.entry.display_name : 'Featured Creator';
      const platform = w.entry ? w.entry.platform : 'Profile';
      const clicks = typeof w.clicks !== 'undefined' ? w.clicks : 0;

      return `
        <div class="saas-card p-5 flex flex-col justify-between ${cardClass}">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-2xl">${escapeHtml(w.medal_emoji || '🏆')}</span>
              <span class="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${badgeClass}">
                ${escapeHtml(w.rank_label || 'Winner')}
              </span>
            </div>
            <h3 class="text-base font-bold text-slate-900 truncate">${escapeHtml(displayName)}</h3>
            <p class="text-xs text-slate-500 capitalize mt-0.5">${escapeHtml(platform)}</p>
            <div class="mt-3 flex items-center space-x-2 text-xs font-semibold text-slate-600 bg-slate-50/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
              <svg class="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
              </svg>
              <span>${clicks} Profile Clicks</span>
            </div>
          </div>
          <div class="mt-5 pt-3 border-t border-slate-100">
            <a href="/profile/${w.id}/visit" target="_blank" rel="noopener noreferrer"
               class="w-full btn-secondary py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 hover:border-purple-300 hover:text-purple-600">
              <span>Visit Profile</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Razorpay Payment & Entry Submission Flow ---
  function setupEntryPaymentForm() {
    if (!entryPaymentForm) return;

    entryPaymentForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const displayName = (document.getElementById('display_name')?.value || '').trim();
      const platform = (document.getElementById('platform')?.value || 'website').trim();
      let profileUrl = (document.getElementById('profile_url')?.value || '').trim();

      if (!displayName || displayName.length < 2) {
        showFeedback('error', 'Display name must be at least 2 characters.');
        return;
      }

      if (!profileUrl) {
        showFeedback('error', 'Please enter your profile URL.');
        return;
      }

      // Format URL if missing protocol
      if (!profileUrl.startsWith('http://') && !profileUrl.startsWith('https://')) {
        profileUrl = 'https://' + profileUrl;
      }

      setButtonState(true, 'Initializing Order...');
      hideFeedback();

      try {
        // Step 1: Request backend order creation
        const orderRes = await fetch('/entry/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName,
            platform: platform,
            profile_url: profileUrl
          })
        });

        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
          showFeedback('error', orderData.error || 'Failed to initialize entry order.');
          setButtonState(false);
          return;
        }

        // Step 2: Open Razorpay Checkout modal
        if (typeof Razorpay === 'undefined') {
          showFeedback('error', 'Payment gateway failed to load. Please check your internet connection or ad-blocker.');
          setButtonState(false);
          return;
        }

        const options = {
          key: orderData.key_id,
          amount: orderData.amount, // in paise
          currency: orderData.currency || 'INR',
          name: 'indobid.lol',
          description: `Hourly Round #${orderData.round_id} Entry`,
          order_id: orderData.order_id,
          handler: async function (response) {
            // Step 3: Server-side Razorpay signature verification
            setButtonState(true, 'Verifying Payment...');
            try {
              const verifyRes = await fetch('/entry/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  display_name: orderData.display_name,
                  platform: orderData.platform,
                  profile_url: orderData.profile_url
                })
              });

              const verifyData = await verifyRes.json();

              if (verifyRes.ok && verifyData.success) {
                showFeedback('success', verifyData.message || 'Payment verified! You are entered in the active draw.');
                entryPaymentForm.reset();
                await fetchRoundStatus();
              } else {
                showFeedback('error', verifyData.error || 'Payment signature verification failed.');
              }
            } catch (err) {
              showFeedback('error', 'Network error verifying payment with server.');
            } finally {
              setButtonState(false);
            }
          },
          modal: {
            ondismiss: function () {
              setButtonState(false);
              showFeedback('info', 'Payment was cancelled. Your profile was not entered into the draw.');
              fetch('/entry/payment-failed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderData.order_id })
              }).catch(() => {});
            }
          },
          prefill: {
            name: orderData.display_name
          },
          theme: {
            color: '#7c3aed'
          }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          setButtonState(false);
          showFeedback('error', resp.error?.description || 'Payment failed. Please try again.');
          fetch('/entry/payment-failed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderData.order_id })
          }).catch(() => {});
        });

        rzp.open();
      } catch (err) {
        showFeedback('error', 'Connection error. Please try again.');
        setButtonState(false);
      }
    });
  }

  function setButtonState(loading, text) {
    if (!payButton) return;
    payButton.disabled = loading;
    if (loading) {
      payButton.classList.add('opacity-75', 'cursor-not-allowed');
      if (payButtonText) payButtonText.textContent = text || 'Processing...';
    } else {
      payButton.classList.remove('opacity-75', 'cursor-not-allowed');
      const fee = payButton.getAttribute('data-amount-inr') || '49';
      if (payButtonText) payButtonText.textContent = `Pay ₹${fee} & Enter Round`;
    }
  }

  function showFeedback(type, message) {
    if (!paymentFeedback) return;
    paymentFeedback.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border', 'border-red-200', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'bg-purple-50', 'text-purple-700', 'border-purple-200');

    if (type === 'error') {
      paymentFeedback.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
    } else if (type === 'success') {
      paymentFeedback.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
    } else {
      paymentFeedback.classList.add('bg-purple-50', 'text-purple-700', 'border', 'border-purple-200');
    }

    paymentFeedback.textContent = message;
    paymentFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideFeedback() {
    if (paymentFeedback) paymentFeedback.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
