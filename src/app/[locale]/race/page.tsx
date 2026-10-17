"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createRace, joinRace } from "@/app/actions/race";

export default function RaceHomePage() {
    const t = useTranslations("Race");
    const router = useRouter();
    const { data: session } = useSession();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function join(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const result = await joinRace(code);
            if (result.ok) router.push(`/race/${code.trim()}`);
            else setError(t(`join_${result.reason}`));
        } finally {
            setBusy(false);
        }
    }

    async function duel() {
        setError(null);
        setBusy(true);
        try {
            const { code: newCode } = await createRace({ mode: "DUEL" });
            router.push(`/race/${newCode}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
        }
    }

    return (
        <main className="max-w-xl mx-auto py-8 px-4 space-y-6">
            <div className="flex justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🏁 {t("raceTitle")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>

            <form onSubmit={join} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
                <label className="block text-lg font-bold" htmlFor="race-code">{t("enterCode")}</label>
                <input id="race-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234"
                    className="w-full text-center text-4xl font-black tracking-[0.5em] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 py-3" />
                <button type="submit" disabled={busy || code.length !== 4} className="w-full py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 disabled:opacity-50">{t("join")}</button>
            </form>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-3">
                <h2 className="text-lg font-bold">⚔️ {t("duelTitle")}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t("duelIntro")}</p>
                <button type="button" onClick={duel} disabled={busy} className="px-5 py-2.5 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50">{t("startDuelButton")}</button>
            </div>

            {session?.user?.role === "COACH" && (
                <Link href="/race/new" className="block bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 font-medium text-indigo-700 dark:text-indigo-300 hover:underline">
                    📽️ {t("hostRace")} →
                </Link>
            )}
            {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        </main>
    );
}
