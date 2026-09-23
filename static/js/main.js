/**
 * indobid.lol - Core client-side logic
 * Extremely lightweight vanilla JavaScript for countdown, modal, and live updates.
 */

(function () {
  'use strict';

  // State
  let targetEndTime = null;
  let countdownInterval = null;
  let pollInterval = null;
  let isResolvingRound = false;

  // DOM Elements
  const countdownEl = document.getElementById('countdown-display');
  const countdownBox = document.getElementById('countdown-container');
  const enterModal = document.getElementById('enter-modal');
  const entryForm = document.getElementById('entry-form');
  const entrySubmitBtn = document.getElementById('entry-submit-btn');
  const entryFormFeedback = document.getElementById('entry-form-feedback');
  const glassEntriesContainer = document.getElementById('glass-entries-list');
  const roundBadge = document.getElementById('live-round-badge');
  const entriesCountBadge = document.getElementById('entries-count-badge');

  // Initialize
  function init() {
    setupCountdown();
    setupModalHandlers();
    setupEntryForm();
    setupAutoSync();
  }

  // Countdown Logic
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
        countdownEl.textContent = '00:00';
        if (!isResolvingRound) {
          handleRoundEnded();
        }
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n) => String(n).padStart(2, '0');

      if (hours > 0) {
        countdownEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      } else {
        countdownEl.textContent = `${pad(minutes)}:${pad(seconds)}`;
      }
    }

    update();
    countdownInterval = setInterval(update, 1000);
  }

  // Triggered when countdown hits 00:00
  async function handleRoundEnded() {
    isResolvingRound = true;
    if (countdownEl) {
      countdownEl.innerHTML = '<span class="text-amber-400 animate-pulse text-2xl">DRAWING...</span>';
    }

    // Wait 2 seconds for clean transition, then sync with backend
    setTimeout(async () => {
      await fetchRoundStatus();
      isResolvingRound = false;
    }, 2000);
  }

  // Fetch latest state from backend
  async function fetchRoundStatus() {
    try {
      const res = await fetch('/api/round-status');
      if (!res.ok) return;
      const data = await res.json();

      // Update target end time
      if (data.end_time) {
        targetEndTime = new Date(data.end_time).getTime();
        if (countdownBox) countdownBox.setAttribute('data-end-time', data.end_time);
        startCountdownTimer();
      }

      // Update round badge
      if (roundBadge && data.round_id) {
        roundBadge.textContent = `LIVE ROUND #${data.round_id}`;
      }

      // Update entries count
      if (entriesCountBadge && typeof data.entries_count !== 'undefined') {
        entriesCountBadge.textContent = `${data.entries_count} in the draw`;
      }

      // Update glass box entries
      if (data.glass_box_entries && glassEntriesContainer) {
        renderGlassEntries(data.glass_box_entries);
      }

      // If winners were crowned, reload or refresh podium
      if (data.latest_winners && data.latest_winners.length > 0) {
        updateWinnersPodium(data.latest_winners, data.latest_completed_round_id);
      }
    } catch (err) {
      console.warn('Sync failed:', err);
    }
  }

  // Update Glass Box list in DOM
  function renderGlassEntries(entries) {
    if (!glassEntriesContainer) return;

    if (entries.length === 0) {
      glassEntriesContainer.innerHTML = `
        <div class="py-8 text-center text-zinc-400 text-sm italic">
          No entries yet this round. Be the first to enter!
        </div>
      `;
      return;
    }

    const platformIcons = {
      twitter: '𝕏',
      youtube: '▶',
      instagram: '📷',
      tiktok: '🎵',
      github: '🐙',
      linkedin: 'in',
      website: '🌐',
      other: '🔗'
    };

    let html = '';
    entries.forEach((item) => {
      const icon = platformIcons[item.platform] || '•';
      const safeName = escapeHtml(item.display_name);
      html += `
        <div class="entry-item flex items-center justify-between px-4 py-2.5 rounded-xl glass-pill transition-all duration-300">
          <div class="flex items-center space-x-3 truncate">
            <span class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-zinc-300">
              ${icon}
            </span>
            <span class="text-sm font-medium text-zinc-200 truncate">${safeName}</span>
          </div>
          <span class="text-xs text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            Entered
          </span>
        </div>
      `;
    });

    glassEntriesContainer.innerHTML = html;
  }

  function updateWinnersPodium(winners, roundId) {
    const podiumContainer = document.getElementById('featured-winners-podium');
    if (!podiumContainer || !winners || winners.length === 0) return;
    podiumContainer.classList.remove('hidden');

    const roundTitle = document.getElementById('featured-podium-round-title');
    if (roundTitle && roundId) {
      roundTitle.textContent = `Round #${roundId} Featured Profiles`;
    }

    let cardsHtml = '';
    winners.forEach((winner) => {
      const entry = winner.entry || {};
      const pos = winner.position;
      const badgeClass = pos === 1 ? 'badge-gold shadow-lg shadow-amber-500/10 order-first md:order-2 md:-translate-y-2' : (pos === 2 ? 'badge-silver md:order-1' : 'badge-bronze md:order-3');
      const medal = winner.medal_emoji || (pos === 1 ? '🥇' : (pos === 2 ? '🥈' : '🥉'));
      const rank = winner.rank_label || (pos === 1 ? 'Gold' : (pos === 2 ? 'Silver' : 'Bronze'));
      const safeName = escapeHtml(entry.display_name || 'Anonymous');
      const safePlatform = escapeHtml(entry.platform || 'website');
      const safeUrl = escapeHtml(entry.profile_url || '#');

      cardsHtml += `
        <div class="relative glass-panel rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${badgeClass}">
          <div class="flex items-center justify-between mb-4">
            <span class="text-2xl">${medal}</span>
            <span class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/40">
              ${rank}
            </span>
          </div>
          <div class="mb-6">
            <h4 class="text-lg font-bold text-white truncate">${safeName}</h4>
            <p class="text-xs text-zinc-400 capitalize mt-0.5 flex items-center space-x-1">
              <span>Platform:</span>
              <span class="font-medium text-zinc-300">${safePlatform}</span>
            </p>
          </div>
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
            class="w-full text-center py-2.5 px-4 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center space-x-1.5">
            <span>Visit Profile</span>
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
            </svg>
          </a>
        </div>
      `;
    });
    podiumContainer.innerHTML = cardsHtml;
  }

  // Modal Controls
  function setupModalHandlers() {
    const openBtns = document.querySelectorAll('[data-open-enter-modal]');
    const closeBtns = document.querySelectorAll('[data-close-enter-modal]');

    openBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    closeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeModal();
      });
    });

    // Close on backdrop click
    if (enterModal) {
      enterModal.addEventListener('click', (e) => {
        if (e.target === enterModal) {
          closeModal();
        }
      });
    }

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && enterModal && !enterModal.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  function openModal() {
    if (!enterModal) return;
    enterModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const nameInput = document.getElementById('display_name');
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
  }

  function closeModal() {
    if (!enterModal) return;
    enterModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (entryFormFeedback) {
      entryFormFeedback.classList.add('hidden');
      entryFormFeedback.innerHTML = '';
    }
  }

  // Handle Form Submission (AJAX for seamless UX)
  function setupEntryForm() {
    if (!entryForm) return;

    entryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('display_name');
      const platformInput = document.getElementById('platform');
      const urlInput = document.getElementById('profile_url');

      const displayName = nameInput ? nameInput.value.trim() : '';
      const platform = platformInput ? platformInput.value.trim() : 'website';
      const profileUrl = urlInput ? urlInput.value.trim() : '';

      // Client-side quick checks
      if (!displayName || displayName.length < 2) {
        showFeedback('Please enter a display name (at least 2 characters).', 'error');
        return;
      }
      if (!profileUrl) {
        showFeedback('Please enter your public profile or website URL.', 'error');
        return;
      }

      // UI Loading state
      if (entrySubmitBtn) {
        entrySubmitBtn.disabled = true;
        entrySubmitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-black inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Submitting...
        `;
      }

      try {
        const response = await fetch('/entry/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            display_name: displayName,
            platform: platform,
            profile_url: profileUrl
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showFeedback(`🎉 ${result.message}`, 'success');
          entryForm.reset();

          // Refresh live entries
          setTimeout(() => {
            fetchRoundStatus();
          }, 800);

          // Close modal after brief confirmation
          setTimeout(() => {
            closeModal();
          }, 2200);
        } else {
          const errMessage = (result.errors && result.errors.join('<br>')) || result.message || 'Submission failed. Please check your details.';
          showFeedback(errMessage, 'error');
        }
      } catch (err) {
        showFeedback('Network error. Please check your connection and try again.', 'error');
      } finally {
        if (entrySubmitBtn) {
          entrySubmitBtn.disabled = false;
          entrySubmitBtn.textContent = 'Confirm Entry';
        }
      }
    });
  }

  function showFeedback(message, type) {
    if (!entryFormFeedback) return;
    entryFormFeedback.classList.remove('hidden', 'bg-red-500/10', 'border-red-500/30', 'text-red-300', 'bg-emerald-500/10', 'border-emerald-500/30', 'text-emerald-300');

    if (type === 'success') {
      entryFormFeedback.classList.add('bg-emerald-500/10', 'border-emerald-500/30', 'text-emerald-300');
    } else {
      entryFormFeedback.classList.add('bg-red-500/10', 'border-red-500/30', 'text-red-300');
    }

    entryFormFeedback.innerHTML = message;
  }

  // Background sync for entries every 30s
  function setupAutoSync() {
    pollInterval = setInterval(() => {
      if (!isResolvingRound) {
        fetchRoundStatus();
      }
    }, 30000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose global modal opener
  window.openEnterModal = openModal;
  window.closeEnterModal = closeModal;

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
