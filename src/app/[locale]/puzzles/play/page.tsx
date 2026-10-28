"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import PuzzleDifficultySettings from "@/components/PuzzleDifficultySettings";

export default function PuzzlePlayPage() {
    const t = useTranslations("Puzzles");
    const tDifficulty = useTranslations("PuzzleDifficulty");
    const [error, setError] = useState<string | null>(null);
    const [emptyRange, setEmptyRange] = useState<{ min: number; max: number } | null>(null);
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const tag = searchParams.get('tag');

    const fetchNextPuzzle = useCallback(async () => {
        try {
            setError(null); setEmptyRange(null);
            let url = "/api/puzzles/next";
            if (tag) {
                url += `?tag=${encodeURIComponent(tag)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch next puzzle");
            }

            const data = await response.json();
            if (data.puzzleName) {
                router.push({ pathname: `/puzzles/${data.puzzleName}`, query: tag ? { tag } : undefined });
            } else {
                if (data.range) setEmptyRange(data.range);
                else setError(t("noneFound"));
            }
        } catch {
            setError(t("loadFailed"));
        }
    }, [tag, router, t]);

    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/sign-in');
            return;
        }

        fetchNextPuzzle();
    }, [status, fetchNextPuzzle, router]);

    if (error || emptyRange) {
        return (
            <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
                <p role="status" className="text-gray-700 dark:text-gray-200">{emptyRange ? tDifficulty("noneInRange", emptyRange) : error}</p>
                <button type="button" onClick={fetchNextPuzzle} className="rounded-lg bg-blue-600 text-white px-4 py-2">{tDifficulty("tryAgain")}</button>
                <Link href="/puzzles" className="block text-blue-600 underline">{tDifficulty("chooseTopic")}</Link>
                <PuzzleDifficultySettings defaultOpen onSaved={fetchNextPuzzle} />
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
