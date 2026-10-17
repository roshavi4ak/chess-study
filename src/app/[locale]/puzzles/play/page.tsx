"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function PuzzlePlayPage() {
    const t = useTranslations("Puzzles");
    const [error, setError] = useState<string | null>(null);
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const tag = searchParams.get('tag');

    const fetchNextPuzzle = useCallback(async () => {
        try {
            let url = `/api/puzzles/next?rating=${session?.user?.ratingPuzzle || 1500}`;
            if (tag) {
                url += `&tag=${encodeURIComponent(tag)}`;
            }
            if (session?.user?.id) {
                url += `&userId=${session.user.id}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch next puzzle");
            }

            const data = await response.json();
            if (data.puzzleName) {
                router.push({ pathname: `/puzzles/${data.puzzleName}`, query: tag ? { tag } : undefined });
            } else {
                setError(t("noneFound"));
            }
        } catch {
            setError(t("loadFailed"));
        }
    }, [session, tag, router, t]);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/sign-in');
            return;
        }

        fetchNextPuzzle();
    }, [status, fetchNextPuzzle, router]);

    if (error) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600">{t("errorTitle")}</h1>
                <p className="mt-2 text-gray-600">{error}</p>
            </div>
        );
    }

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
