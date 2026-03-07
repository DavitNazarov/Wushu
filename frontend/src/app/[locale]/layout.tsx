import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';
import { getMessages } from 'next-intl/server';
import { QueryProvider } from '@/lib/api/query-provider';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children }: Props) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>{children}</QueryProvider>
    </NextIntlClientProvider>
  );
}
