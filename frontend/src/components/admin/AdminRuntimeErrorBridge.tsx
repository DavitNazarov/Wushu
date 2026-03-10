'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { getCompactErrorMessage } from '@/lib/api/error';

const SUPPRESSED_PATTERNS = ['ResizeObserver loop limit exceeded'];

export function AdminRuntimeErrorBridge() {
  const { toast } = useToast();
  const lastMessageRef = useRef<string>('');
  const lastAtRef = useRef<number>(0);

  useEffect(() => {
    const showError = (error: unknown) => {
      const message = getCompactErrorMessage(
        error,
        'Unexpected application error. Please retry or refresh.',
      );

      if (SUPPRESSED_PATTERNS.some((pattern) => message.includes(pattern))) {
        return;
      }

      const now = Date.now();
      if (lastMessageRef.current === message && now - lastAtRef.current < 2000) {
        return;
      }

      lastMessageRef.current = message;
      lastAtRef.current = now;
      toast(message, 'error');
    };

    const onError = (event: ErrorEvent) => {
      showError(event.error ?? event.message);
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      showError(event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [toast]);

  return null;
}
