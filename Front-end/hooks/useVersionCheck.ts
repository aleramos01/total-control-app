import { useEffect } from 'react';

declare const __BUILD_TIME__: string;

const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

/**
 * Polls /version.json every 60s.
 * When the server's buildTime differs from this bundle's buildTime, reloads the page.
 * Works automatically after every Vercel deploy.
 */
export function useVersionCheck() {
  useEffect(() => {
    // Only run in production (not dev server)
    if (import.meta.env.DEV) return;

    const currentBuild = __BUILD_TIME__;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { buildTime?: string };
        if (data.buildTime && data.buildTime !== currentBuild) {
          window.location.reload();
        }
      } catch {
        // Network error — silently ignore, try again next interval
      }
    };

    const id = setInterval(() => { void check(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
