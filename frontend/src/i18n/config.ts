const locales = ['en', 'ka'] as const;

export type AppLocale = (typeof locales)[number];

export const i18nConfig = {
  locales,
  defaultLocale: 'en' as AppLocale,
};
