"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { addTournament, getTournaments, removeTournament, type TournamentView } from "@/app/actions/tournaments";

export default function TournamentsPage() {
    const t = useTranslations("Tournaments");
    const locale = useLocale();
    const [data, setData] = useState<{ list: TournamentView[]; canEdit: boolean } | null | undefined>(undefined);
    const [link, setLink] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const load = () => getTournaments().then(setData).catch(() => setData(null));
    useEffect(() => {
        void load();
    }, []);

    const when = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

    function add(event: React.FormEvent) {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
            const result = await addTournament(link);
            if (result.ok) {
                setLink("");
                await load();
            } else {
                setMessage(t(`add_${result.reason}`));
            }
        });
    }

    if (data === undefined) return <main className="max-w-4xl mx-auto p-6"><div className="h-48 rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" /></main>;

    const upcoming = data?.list.filter(item => item.status !== "finished") ?? [];
    const finished = (data?.list.filter(item => item.status === "finished") ?? []).reverse();

    return (
        <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🏆 {t("title")}</h1>
                <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
            {data === null && <p className="p-4 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{t("notReady")}</p>}

            {data?.canEdit && (
                <form onSubmit={add} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
                    <label htmlFor="tournament-link" className="font-bold">{t("addTitle")}</label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("addHelp")}</p>
                    <div className="flex flex-wrap gap-2">
                        <input id="tournament-link" value={link} onChange={e => setLink(e.target.value)} placeholder="https://lichess.org/tournament/…"
                            className="flex-1 min-w-60 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
                        <button type="submit" disabled={pending || !link.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">{t("add")}</button>
                    </div>
                    {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}
                </form>
            )}

            <section className="space-y-3">
                <h2 className="text-xl font-bold">{t("upcoming")}</h2>
                {upcoming.length === 0 && <p className="text-gray-500 dark:text-gray-400">{t("noneUpcoming")}</p>}
                {upcoming.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-bold">{item.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.status === "playing" ? `🔴 ${t("playingNow")}` : when.format(new Date(item.startsAt))}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">
                                {t("joinOnLichess")} <ExternalLink className="h-4 w-4" />
                            </a>
                            {data?.canEdit && (
                                <button type="button" aria-label={t("remove")} onClick={() => startTransition(async () => { await removeTournament(item.id); await load(); })}
                                    className="p-2 rounded-lg text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                            )}
                        </div>
                    </div>
                ))}
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-bold">{t("finished")}</h2>
                {finished.length === 0 && <p className="text-gray-500 dark:text-gray-400">{t("noneFinished")}</p>}
                {finished.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline inline-flex items-center gap-1">{item.name} <ExternalLink className="h-3 w-3" /></a>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{when.format(new Date(item.startsAt))}</span>
                        </div>
                        {item.results && item.results.length ? (
                            <ol className="text-sm space-y-1">
                                {item.results.map((result, index) => (
                                    <li key={result.lichessId} className="flex justify-between">
                                        <span>{index < 3 ? ["🥇", "🥈", "🥉"][index] : `${index + 1}.`} {result.name ?? result.lichessId} <span className="text-gray-400">({t("lichessPlace", { rank: result.rank })})</span></span>
                                        <span className="font-bold">{result.score}</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{item.results ? t("noClubPlayers") : t("resultsSoon")}</p>
                        )}
                    </div>
                ))}
            </section>
        </main>
    );
}
