"use client";

import { NextIntlClientProvider } from 'next-intl';
import { SessionProvider } from "next-auth/react";

export default function Providers({
  children,
  messages,
  locale
}: {
  children: React.ReactNode;
  messages: any;
  locale: string;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SessionProvider>
        {children}
      </SessionProvider>
    </NextIntlClientProvider>
  );
}