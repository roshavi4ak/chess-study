"use client";

import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';

export default function Home() {
  const t = useTranslations('HomePage');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
      <p className="text-xl mb-8">{t('subtitle')}</p>
      <button
        onClick={() => signIn('lichess')}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        {t('login')}
      </button>
    </main>
  );
}
