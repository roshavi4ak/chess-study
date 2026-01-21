"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession, signIn, signOut } from "next-auth/react";
import { Menu, X, User, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
    const t = useTranslations("Navigation");
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const params = useParams();
    const locale = params?.locale as string || "bg";

    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <nav className="bg-white shadow-md dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/" locale={locale} className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                ChessStudy
                            </Link>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link href="/dashboard" locale={locale} className="text-gray-900 dark:text-white inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-blue-500">
                                {t("home")}
                            </Link>
                            {session && (
                                <Link href="/puzzles" locale={locale} className="text-gray-500 dark:text-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-blue-500">
                                    {t("puzzles")}
                                </Link>
                            )}
                            {session && (
                                <Link href="/openings" locale={locale} className="text-gray-500 dark:text-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-blue-500">
                                    {t("openings")}
                                </Link>
                            )}
                            {session && (
                                <Link href="/play" locale={locale} className="text-gray-500 dark:text-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-blue-500">
                                    {t("play")}
                                </Link>
                            )}
                            {session && (
                                <Link href="/leaderboard" locale={locale} className="text-gray-500 dark:text-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-blue-500">
                                    {t("leaderboard")}
                                </Link>
                            )}
                            {session?.user?.role === "COACH" && (
                                <Link href="/coach/dashboard" locale={locale} className="text-gray-500 dark:text-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-blue-500">
                                    {t("coachDashboard")}
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
                        <LanguageSwitcher />
                        {session ? (
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                    {session.user?.name}
                                </span>
                                <button
                                    onClick={() => signOut()}
                                    className="p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none"
                                >
                                    <LogOut className="h-6 w-6" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => signIn("lichess", { callbackUrl: `/${locale}/dashboard` })}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                            >
                                {t("login")}
                            </button>
                        )}
                    </div>
                    <div className="-mr-2 flex items-center sm:hidden">
                        <button
                            onClick={toggleMenu}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                        >
                            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="sm:hidden">
                    <div className="pt-2 pb-3 space-y-1">
                        <Link href="/dashboard" locale={locale} className="block pl-3 pr-4 py-2 border-l-4 border-blue-500 text-base font-medium text-blue-700 bg-blue-50">
                            {t("home")}
                        </Link>
                        {session && (
                            <Link href="/puzzles" locale={locale} className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                                {t("puzzles")}
                            </Link>
                        )}
                        {session && (
                            <Link href="/openings" locale={locale} className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                                {t("openings")}
                            </Link>
                        )}
                        {session && (
                            <Link href="/play" locale={locale} className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                                {t("play")}
                            </Link>
                        )}
                        {session && (
                            <Link href="/leaderboard" locale={locale} className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                                {t("leaderboard")}
                            </Link>
                        )}
                        {session?.user?.role === "COACH" && (
                            <Link href="/coach/dashboard" locale={locale} className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800">
                                {t("coachDashboard")}
                            </Link>
                        )}
                    </div>
                    <div className="pt-4 pb-4 border-t border-gray-200">
                        <div className="flex items-center px-4">
                            <LanguageSwitcher />
                            {session ? (
                                <div className="ml-3">
                                    <div className="text-base font-medium text-gray-800">{session.user?.name}</div>
                                    <button onClick={() => signOut()} className="mt-2 text-sm text-red-600">
                                        {t("logout")}
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => signIn("lichess", { callbackUrl: `/${locale}/dashboard` })} className="ml-3 text-blue-600 font-medium">
                                    {t("login")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
