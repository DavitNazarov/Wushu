'use client';

import { useEffect } from 'react';

// REL-4: the mat/scoreboard is an UNATTENDED venue display (TV on a wall). On an
// uncaught render error it must recover ITSELF — auto-retry after a short delay
// rather than freeze on a dev error screen that nobody at the venue can dismiss.
export default function MatScoreboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    const timer = setTimeout(() => reset(), 5000);
    return () => clearTimeout(timer);
  }, [error, reset]);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0b0c',
        color: '#fafafa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18 }}>Reconnecting to the scoreboard…</p>
        <p style={{ opacity: 0.6, fontSize: 14, marginTop: 8 }}>
          The display will refresh automatically.
        </p>
      </div>
    </div>
  );
}
