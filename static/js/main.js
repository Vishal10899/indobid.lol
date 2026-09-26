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
  const featuredWinnersContainer = document.getElementById('featured-winners-container');
  const navLiveVisitors = document.getElementById('nav-live-visitors');
  const paymentErrorCard = document.getElementById('payment-error-card');
  const btnErrorRetry = document.getElementById('btn-error-retry');
  const paymentSuccessCard = document.getElementById('payment-success-card');
  const successRoundTitle = document.getElementById('success-round-title');
  const successCountdown = document.getElementById('success-countdown');

  // Initialize
  function init() {
    setupCountdown();
    setupEntryPaymentForm();
    // Poll every 30s to keep live visitor & listings count synced
    setInterval(fetchRoundStatus, 30000);
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
        if (successCountdown) successCountdown.textContent = '00:00';
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
      if (successCountdown) {
        successCountdown.textContent = `${pad(minutes)}:${pad(seconds)}`;
      }

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
      countdownEl.innerHTML = '<span class="text-purple-600 animate-pulse text-xl sm:text-2xl font-extrabold">DRAWING WINNERS...</span>';
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
        liveRoundTitle.textContent = `Round #${data.round_id}`;
      }

      // Update Active Counts
      const count = typeof data.entries_count !== 'undefined' ? data.entries_count : 0;
      if (activePoolCount) activePoolCount.textContent = `${count} paid listings`;
      if (currentEntriesBadge) currentEntriesBadge.textContent = `${count} listings`;

      // Update Live Online Visitors
      if (navLiveVisitors && data.stats && typeof data.stats.online_visitors !== 'undefined') {
        navLiveVisitors.textContent = `● ${data.stats.online_visitors} online`;
      }

      // Update Current Listings
      if (data.current_listings && currentEntriesContainer) {
        renderCurrentListings(data.current_listings, data.round_id);
      }

      // Update Top 3 Winners
      if (data.latest_winners && data.latest_winners.length > 0) {
        renderWinnersPodium(data.latest_winners);
      }
    } catch (err) {
      console.warn('Status sync error:', err);
    }
  }

  function renderCurrentListings(listings, roundId) {
    if (!currentEntriesContainer) return;

    if (!listings || listings.length === 0) {
      currentEntriesContainer.innerHTML = `
        <div class="col-span-full saas-card p-6 text-center text-slate-400">
          <p class="text-xs font-medium text-slate-600">No listings yet in Round #${roundId || ''}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Be the first to enter this round!</p>
          <button type="button" onclick="openEnterModal()" class="mt-3 btn-primary px-4 py-1.5 rounded-xl text-xs font-bold inline-flex items-center space-x-1">
            <span>Enter Round</span>
          </button>
        </div>
      `;
      return;
    }

    currentEntriesContainer.innerHTML = listings.map(item => `
      <div class="listing-card flex items-center justify-between">
        <div class="truncate mr-2">
          <div class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.username)}</div>
          <div class="text-[10px] text-slate-400 capitalize">${escapeHtml(item.platform)}</div>
        </div>
        <a href="/visit/${item.id}" target="_blank" rel="noopener noreferrer"
           class="btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 hover:border-purple-300 hover:text-purple-600 flex items-center space-x-1">
          <span>Visit Link</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
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

      const listing = w.listing || w.entry;
      const username = listing ? listing.username || listing.display_name : 'Winner';
      const platform = listing ? listing.platform : 'Platform';
      const clicks = typeof w.clicks !== 'undefined' ? w.clicks : 0;
      const listingId = w.listing_id || w.entry_id || (listing ? listing.id : 0);

      return `
        <div class="saas-card p-4 flex flex-col justify-between ${cardClass}">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-2xl">${escapeHtml(w.medal_emoji || '🏆')}</span>
              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${badgeClass}">
                ${escapeHtml(w.rank_label || 'Winner')}
              </span>
            </div>
            <h3 class="text-sm font-bold text-slate-900 truncate">${escapeHtml(username)}</h3>
            <p class="text-xs text-slate-500 capitalize mt-0.5">${escapeHtml(platform)}</p>
            <div class="mt-2.5 flex items-center space-x-1.5 text-[11px] font-semibold text-slate-600 bg-white/80 px-2 py-1 rounded-md border border-slate-200/60">
              <svg class="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path>
              </svg>
              <span>${clicks} Clicks</span>
            </div>
          </div>
          <div class="mt-4 pt-2.5 border-t border-slate-100">
            <a href="/visit/${listingId}" target="_blank" rel="noopener noreferrer"
               class="w-full btn-secondary py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 hover:border-purple-300 hover:text-purple-600">
              <span>Visit Link</span>
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
  let isPaymentRunning = false;

  function getNormalButtonText() {
    if (!payButton) return 'Continue to Pay $2';
    const symbol = payButton.getAttribute('data-symbol') || '$';
    const price = payButton.getAttribute('data-price') || '2';
    const numPrice = Number(price);
    const formattedPrice = !isNaN(numPrice) && numPrice % 1 === 0 ? parseInt(numPrice, 10) : price;
    return `Continue to Pay ${symbol}${formattedPrice}`;
  }

  function setPayButtonState(state) {
    if (!payButton || !payButtonText) return;
    const spinnerSvg = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

    switch (state) {
      case 'creating_order':
        payButton.disabled = true;
        payButton.classList.add('opacity-75', 'cursor-not-allowed');
        payButtonText.innerHTML = `${spinnerSvg}Creating secure payment...`;
        break;
      case 'opened':
        payButton.disabled = true;
        payButton.classList.add('opacity-75', 'cursor-not-allowed');
        payButtonText.innerHTML = `${spinnerSvg}Processing payment...`;
        break;
      case 'verifying':
        payButton.disabled = true;
        payButton.classList.add('opacity-75', 'cursor-not-allowed');
        payButtonText.innerHTML = `${spinnerSvg}Verifying Payment...`;
        break;
      case 'success':
        payButton.disabled = true;
        payButton.classList.add('opacity-75', 'cursor-not-allowed');
        payButtonText.textContent = '✓ Payment Successful';
        break;
      case 'cancelled':
        payButton.disabled = false;
        payButton.classList.remove('opacity-75', 'cursor-not-allowed');
        payButtonText.textContent = 'Payment Cancelled';
        break;
      case 'not_configured':
        payButton.disabled = false;
        payButton.classList.remove('opacity-75', 'cursor-not-allowed');
        payButtonText.textContent = 'Payment Not Configured';
        break;
      case 'failure':
        payButton.disabled = false;
        payButton.classList.remove('opacity-75', 'cursor-not-allowed');
        payButtonText.textContent = 'Payment Failed';
        break;
      case 'retry':
        payButton.disabled = false;
        payButton.classList.remove('opacity-75', 'cursor-not-allowed');
        payButtonText.textContent = 'Try Again';
        break;
      case 'normal':
      default:
        payButton.disabled = false;
        payButton.classList.remove('opacity-75', 'cursor-not-allowed');
        payButtonText.textContent = getNormalButtonText();
        break;
    }
  }

  function showPaymentErrorCard(title, desc, hint, type = 'error') {
    hideFeedback();
    const errTitle = document.getElementById('error-card-title');
    const errDesc = document.getElementById('error-card-desc');
    const errHint = document.getElementById('error-card-hint');
    const errIcon = document.getElementById('error-card-icon');

    if (errTitle) errTitle.textContent = title || "Payment couldn't be completed.";
    if (errDesc) errDesc.textContent = desc || "Your listing has NOT been added.";
    if (errHint) errHint.textContent = hint || "Please try again.";

    if (paymentErrorCard) {
      if (type === 'cancelled') {
        paymentErrorCard.className = 'mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-slate-800 animate-in fade-in duration-150';
        if (errIcon) {
          errIcon.className = 'w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0';
          errIcon.textContent = 'ℹ️';
        }
        if (errTitle) errTitle.className = 'text-xs font-bold text-amber-900';
        if (errDesc) errDesc.className = 'text-xs text-amber-700 mt-0.5 font-medium';
        setPayButtonState('cancelled');
      } else {
        paymentErrorCard.className = 'mb-4 p-4 rounded-2xl bg-red-50 border border-red-200 text-slate-800 animate-in fade-in duration-150';
        if (errIcon) {
          errIcon.className = 'w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0';
          errIcon.textContent = '⚠️';
        }
        if (errTitle) errTitle.className = 'text-xs font-bold text-red-900';
        if (errDesc) errDesc.className = 'text-xs text-red-700 mt-0.5 font-medium';
        if (title === "Payment service is not configured.") {
          setPayButtonState('not_configured');
        } else {
          setPayButtonState('failure');
        }
      }
      paymentErrorCard.classList.remove('hidden');
    }
    if (paymentSuccessCard) {
      paymentSuccessCard.classList.add('hidden');
    }
  }

  function hidePaymentErrorCard() {
    if (paymentErrorCard) {
      paymentErrorCard.classList.add('hidden');
    }
  }

  function showPaymentSuccessCard(roundId) {
    hideFeedback();
    hidePaymentErrorCard();
    if (entryPaymentForm) {
      entryPaymentForm.classList.add('hidden');
    }
    if (paymentSuccessCard) {
      paymentSuccessCard.classList.remove('hidden');
    }
    if (successRoundTitle) {
      successRoundTitle.textContent = `Round #${roundId || ''}`;
    }
    if (successCountdown && countdownEl) {
      const text = countdownEl.textContent.trim().replace(/\s*:\s*/g, ':');
      successCountdown.textContent = text || '59:42';
    }
    setPayButtonState('success');
  }

  window.resetPayButtonState = function () {
    isPaymentRunning = false;
    setPayButtonState('normal');
    hideFeedback();
    hidePaymentErrorCard();
    if (paymentSuccessCard) {
      paymentSuccessCard.classList.add('hidden');
    }
    if (entryPaymentForm) {
      entryPaymentForm.classList.remove('hidden');
      entryPaymentForm.reset();
    }
  };

  function setupEntryPaymentForm() {
    if (!entryPaymentForm) return;

    if (btnErrorRetry) {
      btnErrorRetry.addEventListener('click', function () {
        hidePaymentErrorCard();
        setPayButtonState('retry');
        document.getElementById('display_name')?.focus();
      });
    }

    entryPaymentForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (isPaymentRunning) return; // Prevent double clicking

      const username = (document.getElementById('display_name')?.value || '').trim();
      const platform = (document.getElementById('platform')?.value || 'website').trim();
      let profileUrl = (document.getElementById('profile_url')?.value || '').trim();

      if (!username || username.length < 2) {
        showFeedback('error', 'Username must be at least 2 characters.');
        return;
      }

      if (!profileUrl) {
        showFeedback('error', 'Please enter your link URL.');
        return;
      }

      if (!profileUrl.startsWith('http://') && !profileUrl.startsWith('https://')) {
        profileUrl = 'https://' + profileUrl;
      }

      hideFeedback();
      hidePaymentErrorCard();
      isPaymentRunning = true;
      setPayButtonState('creating_order');

      try {
        console.log("Razorpay loaded:", typeof Razorpay);

        // Step 1: Create Order on backend
        const orderRes = await fetch('/entry/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            display_name: username,
            platform: platform,
            profile_url: profileUrl
          })
        });

        const data = await orderRes.json();
        console.log("Create order response:", data);

        if (!orderRes.ok || !data.success) {
          isPaymentRunning = false;
          if (data.error_type === "CONFIGURATION_ERROR" || data.error === "Payment service is not configured.") {
            showPaymentErrorCard(
              "Payment service is not configured.",
              "Your listing has NOT been added.",
              "Payment service is not configured.",
              'error'
            );
            return;
          }
          const safeError = data.error || data.message || "Unable to start payment.";
          showPaymentErrorCard("Unable to start payment.", "Your listing has NOT been added.", safeError, 'error');
          return;
        }

        // Verify Razorpay Checkout script is loaded
        if (typeof Razorpay !== 'function') {
          console.error("Razorpay script not loaded: typeof Razorpay =", typeof Razorpay);
          isPaymentRunning = false;
          showPaymentErrorCard(
            "Payment Gateway Unavailable",
            "Your listing has NOT been added.",
            "Payment gateway script failed to load. Please check your connection or ad-blocker.",
            'error'
          );
          return;
        }

        // Verify required fields exist in order response
        if (!data.order_id || !data.key_id || !data.amount || !data.currency) {
          console.error("Missing required order fields in response:", data);
          isPaymentRunning = false;
          showPaymentErrorCard(
            "Unable to start payment.",
            "Your listing has NOT been added.",
            "Incomplete payment order details received from server.",
            'error'
          );
          return;
        }

        console.log("Opening Razorpay with order:", data.order_id);
        setPayButtonState('opened');

        const options = {
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          order_id: data.order_id,
          name: "indobid.lol",
          description: "60-minute profile listing",
          prefill: {
            name: data.username || username
          },
          theme: {
            color: '#7c3aed'
          },
          handler: async function (paymentResponse) {
            await verifyPayment(paymentResponse, data);
          },
          modal: {
            ondismiss: function () {
              handlePaymentCancelled(data);
            }
          }
        };

        const razorpay = new Razorpay(options);
        razorpay.on('payment.failed', function (resp) {
          handlePaymentFailed(resp, data);
        });

        razorpay.open();
      } catch (err) {
        isPaymentRunning = false;
        showPaymentErrorCard(
          "Unable to start payment.",
          "Your listing has NOT been added.",
          "Connection error. Please try again.",
          'error'
        );
      }
    });

    async function verifyPayment(paymentResponse, orderData) {
      // Server-side Razorpay signature verification
      setPayButtonState('verifying');
      try {
        const verifyRes = await fetch('/entry/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: paymentResponse.razorpay_order_id || (orderData ? orderData.order_id : ''),
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
            username: (orderData && orderData.username) || '',
            display_name: (orderData && orderData.username) || '',
            platform: (orderData && orderData.platform) || 'website',
            profile_url: (orderData && orderData.profile_url) || ''
          })
        });

        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.success) {
          showPaymentSuccessCard(verifyData.round_id || (orderData && orderData.round_id));
          setTimeout(async () => {
            if (typeof closeEnterModal === 'function') closeEnterModal();
            await fetchRoundStatus();
          }, 2500);
        } else {
          showPaymentErrorCard(
            "Payment could not be verified.",
            "Your listing has NOT been added.",
            verifyData.message || verifyData.error || "Please try again.",
            'error'
          );
        }
      } catch (err) {
        showPaymentErrorCard(
          "Payment could not be verified.",
          "Your listing has NOT been added.",
          "Network error during verification. Please try again.",
          'error'
        );
      } finally {
        isPaymentRunning = false;
      }
    }

    function handlePaymentCancelled(orderData) {
      isPaymentRunning = false;
      showPaymentErrorCard(
        "Payment cancelled",
        "Your listing has not been added.",
        "You have not been charged.",
        'cancelled'
      );
      if (orderData && orderData.order_id) {
        fetch('/entry/payment-failed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderData.order_id })
        }).catch(() => {});
      }
    }

    function handlePaymentFailed(resp, orderData) {
      isPaymentRunning = false;
      showPaymentErrorCard(
        "Payment couldn't be completed.",
        "Your listing has NOT been added.",
        "Please try again.",
        'error'
      );
      if (orderData && orderData.order_id) {
        fetch('/entry/payment-failed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderData.order_id })
        }).catch(() => {});
      }
    }
  }

  function showFeedback(type, message) {
    if (!paymentFeedback) return;
    paymentFeedback.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border', 'border-red-200', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200');

    if (type === 'error') {
      paymentFeedback.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
    } else if (type === 'success') {
      paymentFeedback.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
    } else {
      paymentFeedback.classList.add('bg-purple-50', 'text-purple-700', 'border', 'border-purple-200');
    }

    paymentFeedback.textContent = message;
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
