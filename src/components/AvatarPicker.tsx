"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AVATARS, getAvatarPath } from "@/lib/avatars";
import { updateAvatar } from "@/app/actions/user";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { X, Check } from "lucide-react";

interface AvatarPickerProps {
    currentImage: string | null;
}

export default function AvatarPicker({ currentImage }: AvatarPickerProps) {
    const t = useTranslations("AvatarPicker");
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { update } = useSession();

    const handleAvatarSelect = async (filename: string) => {
        setIsLoading(true);
        try {
            await updateAvatar(filename);
            await update();
            setIsOpen(false);
        } catch (error) {
            console.error("Failed to update avatar:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <div className="relative group">
                {currentImage ? (
                    <div className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center relative">
                        <img
                            src={currentImage}
                            alt="Current Avatar"
                            width={64}
                            height={64}
                            className="w-full h-full object-contain p-1"
                        />
                    </div>
                ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center">
                        <span className="text-2xl">?</span>
                    </div>
                )}
            </div>

            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
                {t("pickAvatar")}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("chooseYourAvatar")}</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                {AVATARS.map((filename) => {
                                    const path = getAvatarPath(filename);
                                    const isSelected = currentImage === path;

                                    return (
                                        <button
                                            key={filename}
                                            disabled={isLoading}
                                            onClick={() => handleAvatarSelect(filename)}
                                            className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${isSelected
                                                ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900 scale-95 opacity-100"
                                                : "border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:scale-105 opacity-90 hover:opacity-100"
                                                }`}
                                        >
                                            <div className="w-full h-full p-2 flex items-center justify-center">
                                                <img
                                                    src={path}
                                                    alt={filename.replace(".png", "")}
                                                    width={100}
                                                    height={100}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center z-10">
                                                    <div className="bg-blue-500 text-white rounded-full p-1 shadow-sm">
                                                        <Check className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                {t("cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
