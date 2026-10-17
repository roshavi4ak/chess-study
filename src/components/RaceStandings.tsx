"use client";

import { useTranslations } from "next-intl";
import type { RaceView } from "@/lib/raceState";

// Live list of racers with score bars; used beside the racer's board and, enlarged, on the projector.
export default function RaceStandings({ view, highlight, large = false }: { view: RaceView; highlight?: string; large?: boolean }) {
    const t = useTranslations("Race");
    const top = Math.max(1, ...view.racers.map(racer => racer.score));
    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${large ? "p-6" : "p-4"} space-y-3`}>
            <h2 className={`${large ? "text-2xl" : "text-lg"} font-bold text-gray-900 dark:text-white`}>{t("racers", { count: view.racers.length })}</h2>
            {view.racers.length === 0 && <p className="text-gray-500">{t("noRacersYet")}</p>}
            <ol className={large ? "space-y-3" : "space-y-2"}>
                {view.racers.map((racer, index) => (
                    <li key={racer.userId} className={`${racer.userId === highlight ? "bg-blue-50 dark:bg-blue-900/30 rounded" : ""}`}>
                        <div className={`flex justify-between ${large ? "text-xl" : "text-sm"} font-medium`}>
                            <span>{view.phase === "finished" && index < 3 ? ["🥇", "🥈", "🥉"][index] : `${index + 1}.`} {racer.name ?? "?"}</span>
                            <span className="font-black tabular-nums">{racer.score}</span>
                        </div>
                        {view.phase !== "waiting" && (
                            <div className={`${large ? "h-4" : "h-2"} mt-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden`}>
                                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-500" style={{ width: `${(racer.score / top) * 100}%` }} />
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
