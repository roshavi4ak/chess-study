"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteOpening } from "@/app/actions/opening";
import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";

interface OpeningCardProps {
    opening: {
        id: string;
        name: string;
        description: string | null;
        creator: {
            name: string | null;
        };
    };
    isCreator: boolean;
}

export default function OpeningCard({ opening, isCreator }: OpeningCardProps) {
    const t = useTranslations("Common");
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(t("confirmDelete", { name: opening.name }))) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteOpening(opening.id);
            router.refresh();
        } catch (error) {
            console.error("Failed to delete opening:", error);
            alert("Failed to delete opening");
            setIsDeleting(false);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/openings/${opening.id}/edit`);
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg hover:shadow-md transition relative">
            <Link href={`/openings/${opening.id}`} className="block p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                    {opening.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    {opening.description || t("noDescription")}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                    {t("createdBy", { name: opening.creator.name || t("unknown") })}
                </p>
            </Link>

            {isCreator && (
                <div className="border-t dark:border-gray-700 p-3 flex gap-2">
                    <button
                        onClick={handleEdit}
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
