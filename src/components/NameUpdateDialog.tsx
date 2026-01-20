"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { updateUserName } from "@/app/actions/users";
import { useRouter } from "next/navigation";

interface NameUpdateDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NameUpdateDialog({ isOpen, onClose }: NameUpdateDialogProps) {
    const t = useTranslations("NameDialog");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        setName("");
        setError(null);
        setIsSubmitting(false);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            await updateUserName(name);
            onClose();
            router.refresh();
        } catch (err) {
            console.error(err);
            setError(t("error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-gray-100 dark:border-gray-800 transform animate-in zoom-in-95 duration-300">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t("title")}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        {t("description")}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("placeholder")}
                            disabled={isSubmitting}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            autoFocus
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !name.trim()}
                        className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${isSubmitting || !name.trim()
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
                            }`}
                    >
                        {isSubmitting ? "..." : t("save")}
                    </button>
                </form>
            </div>
        </div>
    );
}
