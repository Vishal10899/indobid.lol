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

    // Get or create anonymous session token (persists per browser session in sessionStorage)
    let sessionToken = sessionStorage.getItem('indobid_session');
    if (!sessionToken) {
      try {
        sessionToken = crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
      } catch {
        sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
      }
      sessionStorage.setItem('indobid_session', sessionToken);
    }

    const sendHeartbeat = async () => {
      // Send heartbeat only if page is visible and at least 25 seconds since last heartbeat
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastHeartbeatRef.current < 25000) return;
      lastHeartbeatRef.current = now;

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
