"use client";

import { useTranslations } from 'next-intl';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const t = useTranslations('HomePage');
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(`/${locale}/dashboard`);
    }
  }, [status, locale, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const titleWords = t('title').split(' ');
  const firstPart = titleWords.length <= 2 ? titleWords.join(' ') : titleWords.slice(0, 2).join(' ');
  const secondPart = titleWords.length <= 2 ? '' : titleWords.slice(2).join(' ');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden bg-white dark:bg-gray-900">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-50 animate-pulse"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-100 dark:bg-indigo-900/20 rounded-full blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold tracking-wide uppercase">
          New: Master Openings with AI
        </div> */}

        <h1 className="text-6xl md:text-7xl font-black mb-8 tracking-tight leading-tight">
          <span className="block text-gray-900 dark:text-white">
            {firstPart}
          </span>
          {secondPart && (
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              {secondPart}
            </span>
          )}
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-12 leading-relaxed max-w-2xl mx-auto">
          {t('subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => signIn('lichess', { callbackUrl: `/${locale}/dashboard` })}
            className="group relative px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 transition-all duration-300 shadow-xl hover:shadow-blue-500/25 flex items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 w-3 bg-white/20 -skew-x-12 translate-x-[-100%] group-hover:translate-x-[1000%] transition-transform duration-1000 ease-in-out"></div>
            <span className="relative z-10">{t('login')}</span>
            <svg
              className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>

          {/* <button
            className="px-8 py-4 bg-transparent text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700"
          >
            Explore Features
          </button> */}
        </div>

        {/* <div className="mt-20 flex justify-center items-center space-x-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-gray-400"></div>
            <span className="font-bold text-gray-500">Trusted by Coaches</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-gray-400"></div>
            <span className="font-bold text-gray-500">10k+ Puzzles</span>
          </div>
        </div> */}
      </div>
    </main>
  );
}
