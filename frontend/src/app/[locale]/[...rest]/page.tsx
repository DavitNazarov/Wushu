import { notFound } from 'next/navigation';

// Next.js routes genuinely *unmatched* URLs to the root not-found boundary,
// which lives outside the [locale] layout — i.e. outside next-intl's provider
// and the public header — so a nested [locale]/not-found.tsx never gets to
// render for them (it only catches explicit notFound() calls). This catch-all
// matches any otherwise-unmatched path under a locale and re-throws it as a
// notFound(), so it surfaces the branded, localized [locale]/not-found.tsx
// instead of Next's bare default 404.
export default function LocaleCatchAll() {
  notFound();
}
