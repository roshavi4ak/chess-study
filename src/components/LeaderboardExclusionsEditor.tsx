"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { addExclusion, removeExclusion, type ExclusionSettings } from "@/app/actions/leaderboardExclusions";

const fieldClass = "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm";

export default function LeaderboardExclusionsEditor({ settings }: { settings: ExclusionSettings }) {
    const t = useTranslations("LeaderboardSettings");
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [picked, setPicked] = useState("");
    const [typed, setTyped] = useState("");

    function run(action: () => Promise<void>, after?: () => void) {
        setError(null);
        startTransition(async () => {
            try {
                await action();
                after?.();
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        });
    }

    return (
        <div className="space-y-6">
            <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("hiddenTitle", { count: settings.excluded.length })}</h2>
                {settings.excluded.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("noneHidden")}</p>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {settings.excluded.map(row => (
                            <li key={row.lichessId} className="flex items-center justify-between gap-3 py-2">
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{row.name ?? row.lichessId}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        lichess.org/@/{row.lichessId}
                                        {!row.name && <> · {t("noAccountYet")}</>}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => run(() => removeExclusion(row.lichessId))}
                                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                                >
                                    <X className="h-4 w-4" /> {t("show")}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("hideTitle")}</h2>
                <form
                    className="flex flex-wrap gap-2"
                    onSubmit={event => { event.preventDefault(); if (picked) run(() => addExclusion(picked), () => setPicked("")); }}
                >
                    <select value={picked} onChange={e => setPicked(e.target.value)} className={`${fieldClass} flex-1 min-w-48`}>
                        <option value="">{t("pickAccount")}</option>
                        {settings.candidates.map(user => (
                            <option key={user.lichessId} value={user.lichessId}>{user.name ? `${user.name} (${user.lichessId})` : user.lichessId}</option>
                        ))}
                    </select>
                    <button type="submit" disabled={pending || !picked} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{t("hide")}</button>
                </form>
                <form
                    className="flex flex-wrap gap-2"
                    onSubmit={event => { event.preventDefault(); if (typed.trim()) run(() => addExclusion(typed), () => setTyped("")); }}
                >
                    <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={t("typeLichessId")} className={`${fieldClass} flex-1 min-w-48`} />
                    <button type="submit" disabled={pending || !typed.trim()} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm font-medium disabled:opacity-50">{t("hide")}</button>
                </form>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </section>
        </div>
    );
}
