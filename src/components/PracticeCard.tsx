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

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg hover:shadow-md transition relative">
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
