'use client';

import { useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { AppLocale } from '@/i18n/config';

const STORAGE_KEY = 'gw_locale';
const COOKIE_NAME = 'gw_locale';

function setLocaleCookie(locale: string) {
  document.cookie = `${COOKIE_NAME}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

export function useLocalePersistence() {
  const locale = useLocale();
  const pathname = usePathname() ?? '';

  const switchLocale = useCallback(
    (newLocale: AppLocale) => {
      if (newLocale === locale) return;
      localStorage.setItem(STORAGE_KEY, newLocale);
      setLocaleCookie(newLocale);
      const pathWithoutLocale = pathname.replace(/^\/(en|ka)/, '') || '/';
      const newPath = `/${newLocale}${pathWithoutLocale}`;
      window.location.href = newPath;
    },
    [locale, pathname],
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    setLocaleCookie(locale);
  }, [locale]);

  return { locale, switchLocale };
}
