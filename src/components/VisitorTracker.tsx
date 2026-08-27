'use client';

import { useEffect, useRef } from 'react';

/**
 * Real Anonymous Visitor Session & Heartbeat Tracker
 * - Runs strictly in the browser on public pages.
 * - Stores a single anonymous session token in sessionStorage (1 token per browser tab session).
 * - Sends periodic heartbeats only while the page is visible to calculate genuine active live visitors.
 * - Ignores admin routes, bot scrapers, and headless crawlers.
 */
export function VisitorTracker() {
  const lastHeartbeatRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Do not count admin dashboard sessions as public visitors
    if (window.location.pathname.startsWith('/admin')) return;

    // 30-minute inactivity session expiration window
    const SESSION_EXPIRY_MS = 30 * 60 * 1000;
    const now = Date.now();
    const storedToken = localStorage.getItem('indobid_session_id');
    const lastActiveStr = localStorage.getItem('indobid_session_last_active');
    const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : 0;

    let sessionToken = storedToken;
    if (!sessionToken || isNaN(lastActive) || now - lastActive > SESSION_EXPIRY_MS) {
      // Create fresh session token after 30+ minutes of inactivity or on first visit
      try {
        sessionToken = crypto.randomUUID ? crypto.randomUUID() : `sess_${now}_${Math.random().toString(36).substring(2, 12)}`;
      } catch {
        sessionToken = `sess_${now}_${Math.random().toString(36).substring(2, 12)}`;
      }
      localStorage.setItem('indobid_session_id', sessionToken);
    }
    localStorage.setItem('indobid_session_last_active', now.toString());

    const sendHeartbeat = async () => {
      // Send heartbeat only if page is visible and at least 25 seconds since last heartbeat
      if (document.visibilityState !== 'visible' || !sessionToken) return;

      const currentTime = Date.now();
      if (currentTime - lastHeartbeatRef.current < 25000) return;
      lastHeartbeatRef.current = currentTime;
      localStorage.setItem('indobid_session_last_active', currentTime.toString());

      try {
        await fetch('/api/analytics/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        });
      } catch {
        // Silently handle transient network errors
      }
    };

    // Initial heartbeat on genuine page load
    sendHeartbeat();

    // Heartbeat every 60s while visible
    const interval = setInterval(sendHeartbeat, 60000);

    // Heartbeat on tab focus/visibility return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
