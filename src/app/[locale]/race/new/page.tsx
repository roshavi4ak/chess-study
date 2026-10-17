"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createRace } from "@/app/actions/race";

const LEVELS = ["easy", "medium", "hard"] as const;
// A few themes that suit a class race; "any" mixes everything.
const THEMES = ["", "mateIn1", "fork", "pin", "hangingPiece", "mateIn2", "skewer", "discoveredAttack"];

export default function NewRacePage() {
    const t = useTranslations("Race");
    const tCategories = useTranslations("PuzzleCategories");
    const router = useRouter();
    const { data: session } = useSession();
    const [level, setLevel] = useState<(typeof LEVELS)[number]>("easy");
    const [tag, setTag] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    if (session && session.user?.role !== "COACH") {
        return <main className="max-w-xl mx-auto p-6"><p>{t("coachOnly")}</p></main>;
    }

    async function create() {
        setError(null);
        setBusy(true);
        try {
            const { code } = await createRace({ mode: "RACE", level, tag: tag || undefined });
            router.push(`/race/${code}/screen`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
        }
    }

    return (
        <main className="max-w-xl mx-auto py-8 px-4 space-y-6">
            <div className="flex justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📽️ {t("hostRace")}</h1>
                <Link href="/race" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("back")}</Link>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
                <fieldset className="space-y-2">
                    <legend className="font-bold">{t("difficulty")}</legend>
                    <div className="flex gap-2">
                        {LEVELS.map(option => (
                            <button key={option} type="button" onClick={() => setLevel(option)}
                                className={`px-4 py-2 rounded-lg font-medium ${level === option ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>
                                {t(`level_${option}`)}
                            </button>
                        ))}
                    </div>
                </fieldset>
                <label className="block space-y-2">
                    <span className="font-bold">{t("theme")}</span>
                    <select value={tag} onChange={e => setTag(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2">
                        {THEMES.map(option => <option key={option} value={option}>{option ? (tCategories.has(option) ? tCategories(option) : option) : t("anyTheme")}</option>)}
                    </select>
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("hostHelp")}</p>
                <button type="button" onClick={create} disabled={busy} className="w-full py-3 rounded-lg bg-green-600 text-white text-lg font-bold hover:bg-green-700 disabled:opacity-50">
                    {busy ? t("creating") : t("createRace")}
                </button>
                {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
            </div>
        </main>
    );
}
