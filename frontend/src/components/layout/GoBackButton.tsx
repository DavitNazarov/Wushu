'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/primitives/button';

type GoBackButtonProps = {
  label: string;
  /** Where to go when there is no in-app history to return to. */
  fallbackHref?: string;
};

/**
 * Secondary "go back" action for the not-found page. Returns to the previous
 * in-app page when there is history, otherwise falls back to home so a direct
 * visit (e.g. a shared dead link) never leaves the user stranded.
 */
export function GoBackButton({ label, fallbackHref = '/' }: GoBackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <Button variant="secondary" className="gap-2" onClick={handleClick}>
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
