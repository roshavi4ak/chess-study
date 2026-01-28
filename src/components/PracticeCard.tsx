"use client";

import Link from "next/link";
import { useState } from "react";
import { deletePractice } from "@/app/actions/practice";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { useTranslations } from "next-intl";

// Type definitions for practice data
type LineStatus = 'PERFECT' | 'COMPLETED' | 'PARTIAL' | 'NEVER_SEEN';

interface PracticeLineProgress {
    id: string;
    userId: string;
    practiceId: string;
    nodeId: string;
    status: LineStatus;
    attempts: number;
    perfectCount: number;
    lastAttemptAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

interface PracticeNode {
    id: string;
    practiceId: string;
    parentId: string | null;
    fen: string;
    move: string | null;
    notes: string | null;
    order: number;
    lineNumber: number | null;
}

interface PracticeCardProps {
    practice: {
        id: string;
        name: string;
        description: string | null;
        playerColor: "WHITE" | "BLACK";
        creator: {
            name: string | null;
        } | null;
        progress?: PracticeLineProgress[];
        nodes?: PracticeNode[];
    };
    isCreator: boolean;
}

export default function PracticeCard({ practice, isCreator }: PracticeCardProps) {
    const t = useTranslations("Common");
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    const { data: session } = useSession();

    // Get current user ID from session
    const currentUserId = session?.user?.id;

    // Find progress for the current user
    const progressForUser = currentUserId
        ? (practice.progress || []).find((p) => p.userId === currentUserId)
        : undefined;

    // Compute status: perfected if all leaf lines for this practice have status PERFECT for this user
    let status: 'none' | 'in-progress' | 'perfected' = 'none';
    if (currentUserId) {
        const totalLines = practice.nodes
            ? practice.nodes.filter((n) => n.lineNumber !== null).length
            : 0;
        const perfectedCount = (practice.progress || []).filter(
            (pp) => pp.userId === currentUserId && pp.status === "PERFECT"
        ).length;
        const seenCount = (practice.progress || []).filter(
            (pp) => pp.userId === currentUserId && pp.status !== "NEVER_SEEN"
        ).length;

        // Debug logging
        console.log(`[PracticeCard] ${practice.name}:`, {
            currentUserId,
            totalLines,
            perfectedCount,
            seenCount,
            progressEntries: practice.progress?.length || 0,
            nodeCount: practice.nodes?.length || 0,
            progress: practice.progress
        });

        if (totalLines > 0 && perfectedCount === totalLines) {
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
