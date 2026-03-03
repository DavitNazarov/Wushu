'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { AppLocale } from '@/i18n/config';

const STORAGE_KEY = 'gw_locale';

export function LocaleRestoration() {
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
    if (!saved || saved === locale) return;
    if (saved !== 'en' && saved !== 'ka') return;
    const pathWithoutLocale = pathname.replace(/^\/(en|ka)/, '') || '/';
    const newPath = `/${saved}${pathWithoutLocale}`;
    router.replace(newPath);
  }, [locale, pathname, router]);

  return null;
}
