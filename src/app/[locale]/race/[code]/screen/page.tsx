"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createRematch, startRace } from "@/app/actions/race";
import { useRace, secondsUntil } from "@/hooks/useRace";
import RaceStandings from "@/components/RaceStandings";

// Big-screen view for the club projector: join code, racers, countdown, live bars and podium.
export default function RaceScreenPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const t = useTranslations("Race");
    const router = useRouter();
    const { view, missing, refresh, now } = useRace(code);
    const [error, setError] = useState<string | null>(null);
    const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.host));

    if (missing) return <main className="p-10 text-center text-2xl">{t("notFound")}</main>;
    if (!view) return <main className="p-10"><div className="h-96 rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" /></main>;

    async function run(action: () => Promise<unknown>) {
        setError(null);
        try {
            await action();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <main className="max-w-7xl mx-auto py-8 px-6 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <p className="text-2xl text-gray-600 dark:text-gray-300">{t("screenJoinAt", { site: `${origin}/race` })}</p>
                    <p className="text-8xl font-black tracking-widest text-gray-900 dark:text-white">{view.code}</p>
                </div>
                <div className="text-right">
                    {view.phase === "countdown" && <p className="text-9xl font-black text-orange-500">{secondsUntil(view.startsAt, now()) || "!"}</p>}
                    {view.phase === "running" && <p className="text-8xl font-black tabular-nums text-gray-900 dark:text-white">{secondsUntil(view.endsAt, now())}s</p>}
                    {view.phase === "finished" && <p className="text-6xl font-black text-green-600">{t("finished")}</p>}
                </div>
            </div>

            {error && <p className="text-red-600 text-xl">{error}</p>}

            {view.isHost && view.phase === "waiting" && (
                <button type="button" disabled={view.racers.length === 0} onClick={() => run(() => startRace(code))}
                    className="px-10 py-5 rounded-2xl bg-green-600 text-white text-3xl font-black hover:bg-green-700 disabled:opacity-50">
                    {t("startRace")}
                </button>
            )}
            {view.isHost && view.phase === "finished" && (
                <button type="button" onClick={() => run(async () => { const next = await createRematch(code); router.push(`/race/${next.code}/screen`); })}
                    className="px-10 py-5 rounded-2xl bg-orange-500 text-white text-3xl font-black hover:bg-orange-600">
                    {t("rematch")}
                </button>
            )}

            <RaceStandings view={view} large />
        </main>
    );
}
