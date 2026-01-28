"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePractice } from "@/app/actions/practice";
import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";

interface PracticeCardProps {
    practice: {
        id: string;
        name: string;
        description: string | null;
        playerColor: "WHITE" | "BLACK";
        creator: {
            name: string | null;
        } | null;
    };
    isCreator: boolean;
}

export default function PracticeCard({ practice, isCreator }: PracticeCardProps) {
    const t = useTranslations("Common");
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    // Determine current user's progress for this practice (if any)
    // practice.progress is included by the API and contains PracticeLineProgress entries
    const userProgress = (practice.progress || []).find((p: any) => p.userId === (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.props?.pageProps?.session?.user?.id));

    // Fallback check: sometimes the session user id is not available on the client via __NEXT_DATA__.
    // In that case, we'll also look for a 'currentUserId' prop on the practice (if server provided it).
    const currentUserId = (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.props?.pageProps?.session?.user?.id) || (practice.currentUserId);
    const progressForUser = (practice.progress || []).find((p: any) => p.userId === currentUserId);

    // Compute status: perfected if all leaf lines for this practice have status PERFECT for this user
    // For a lightweight client-side heuristic, consider perfected if any progress entry has perfectCount > 0 for all nodes.
    let status: 'none' | 'in-progress' | 'perfected' = 'none';
    if (progressForUser) {
        // If any perfected entries exist, treat as perfected if every leaf node has perfectCount > 0
        const totalLines = practice.nodes ? practice.nodes.filter((n: any) => n.lineNumber !== null).length : null;
        const perfectedCount = (practice.progress || []).filter((pp: any) => pp.userId === currentUserId && pp.status === "PERFECT").length;
        const seenCount = (practice.progress || []).filter((pp: any) => pp.userId === currentUserId && pp.status !== "NEVER_SEEN").length;

        if (totalLines !== null && totalLines > 0 && perfectedCount === totalLines) {
            status = 'perfected';
        } else if (seenCount > 0) {
            status = 'in-progress';
        }
    }

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(t("confirmDelete", { name: practice.name }))) {
            return;
        }

        setIsDeleting(true);
        try {
            await deletePractice(practice.id);
            router.refresh();
        } catch (error) {
            console.error("Failed to delete practice:", error);
            alert("Failed to delete practice");
            setIsDeleting(false);
        }
    };

    // Border and label classes
    const borderClass = status === 'perfected' ? 'border-2 border-green-500' : status === 'in-progress' ? 'border-2 border-blue-500' : '';
    const label = status === 'perfected' ? t('perfected') : status === 'in-progress' ? t('inProgress') : null;

    return (
        <div className={`${borderClass} bg-white dark:bg-gray-800 shadow rounded-lg hover:shadow-md transition relative`}>
            {label && (
                <div className={`absolute right-3 top-3 px-2 py-1 text-xs font-semibold rounded ${status === 'perfected' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {label}
                </div>
            )}

            <Link href={`/practices/${practice.id}`} className="block p-4">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                        {practice.name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${practice.playerColor === "WHITE"
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                        : "bg-gray-800 text-white dark:bg-gray-900"
                        }`}>
                        {practice.playerColor === "WHITE" ? `♔ ${t("white")}` : `♚ ${t("black")}`}
                    </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                    {practice.description || t("noDescription")}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                    {t("createdBy", { name: practice.creator?.name || t("unknown") })}
                </p>
            </Link>

            {isCreator && (
                <div className="border-t dark:border-gray-700 p-3 flex gap-2">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/practices/${practice.id}/edit`);
                        }}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition"
                    >
                        {t("edit")}
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? t("deleting") : t("delete")}
                    </button>
                </div>
            )}
        </div>
    );
}
