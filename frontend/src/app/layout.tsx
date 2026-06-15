import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QueryProvider } from '@/lib/api/query-provider';
import { SITE_NAME, SITE_SHORT_NAME, resolveSiteUrl } from '@/lib/seo/site';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Root metadata sets the site-wide defaults every page inherits:
//   - metadataBase: makes the file-convention OpenGraph images (and any
//     relative URLs) absolute. Resolved per-request from env/Host so it's
//     correct on any domain without a rebuild.
//   - title.template: deeper pages set a bare title; this appends the brand.
//   - default OG/Twitter so even un-annotated pages share a branded card.
export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await resolveSiteUrl();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description:
      'Official competition platform of the Georgian Wushu Federation — live results, brackets, schedules, and rankings.',
    applicationName: SITE_SHORT_NAME,
    formatDetection: { telephone: false },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: SITE_NAME,
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  };
}

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  // Correct <html lang> per locale (Georgian pages previously reported lang=en).
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('gw_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
