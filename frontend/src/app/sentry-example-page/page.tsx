'use client';

import * as Sentry from '@sentry/nextjs';
import { useState } from 'react';

export default function SentryExamplePage() {
  const [message, setMessage] = useState<string | null>(null);

  async function triggerServerError() {
    setMessage(null);
    const response = await fetch('/api/sentry-example-api');
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      throw new Error(body?.message ?? 'Sentry example API route failed');
    }
  }

  function triggerClientError() {
    setMessage(null);
    Sentry.startSpan({ name: 'Example Frontend Span', op: 'test' }, () => {
      throw new Error('This is a test error');
    });
  }

  return (
    <main
      style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: 'var(--color-surface, #0b0b0c)',
        color: 'var(--color-text, #fafafa)',
      }}
    >
      <div style={{ maxWidth: 480, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Sentry Example Page</h1>
        <p style={{ opacity: 0.75, marginBottom: 24 }}>
          Trigger a sample error to verify your Sentry setup.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            onClick={triggerClientError}
            style={{
              height: 40,
              borderRadius: 8,
              border: '1px solid #444',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Throw Sample Error
          </button>
          <button
            type="button"
            onClick={() => {
              void triggerServerError().catch((error: unknown) => {
                setMessage(
                  error instanceof Error ? error.message : 'Unknown server error',
                );
              });
            }}
            style={{
              height: 40,
              borderRadius: 8,
              border: '1px solid #444',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Trigger Server Error
          </button>
        </div>
        {message ? (
          <p style={{ marginTop: 16, color: '#f87171' }}>{message}</p>
        ) : null}
      </div>
    </main>
  );
}
