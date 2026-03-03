import { defineRouting } from 'next-intl/routing';
import { i18nConfig } from './config';

export const routing = defineRouting({
  locales: [...i18nConfig.locales],
  defaultLocale: i18nConfig.defaultLocale,
  localeCookie: {
    name: 'gw_locale',
    maxAge: 31536000,
  },
});
