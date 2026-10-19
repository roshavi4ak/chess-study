"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, GraduationCap, Puzzle, Repeat, Sparkles, Star } from "lucide-react";
import { getDailyMission, type MissionView as Mission } from "@/app/actions/mission";
import { findCurriculumLevel } from "@/lib/curriculum";

function ProgressBar({ done, total }: { done: number; total: number }) {
    return (
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }} />
        </div>
    );
}

function Task({ icon, title, done, total, children }: { icon: React.ReactNode; title: string; done: number; total: number; children?: React.ReactNode }) {
    const finished = done >= total;
    return (
        <li className="flex gap-3 items-start">
            <div className={`shrink-0 rounded-full p-2 ${finished ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"}`}>
                {finished ? <CheckCircle2 className="h-6 w-6" /> : icon}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex justify-between gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{Math.min(done, total)} / {total}</span>
                </div>
                <ProgressBar done={done} total={total} />
                {children}
            </div>
        </li>
    );
}

export default function DailyMission() {
    const t = useTranslations("Mission");
    const tCategories = useTranslations("PuzzleCategories");
    const tLevels = useTranslations("Levels");
    const locale = useLocale();
    const [mission, setMission] = useState<Mission | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        getDailyMission().then(setMission).catch(error => {
            console.error("Failed to load mission:", error);
            setFailed(true);
        });
    }, []);

    if (failed) return null;
    if (!mission) {
        return <div className="h-48 rounded-lg bg-white dark:bg-gray-800 shadow animate-pulse" />;
    }

    const { review, newLine, puzzles, week } = mission;
    const tag = puzzles.tag;
    const themeName = (item: string) => tCategories.has(item) ? tCategories(item) : item;
    const tagName = tag ? themeName(tag) : null;
    const levelName = (id: string | null) => {
        const level = id ? findCurriculumLevel(id) : undefined;
        return level ? tLevels("levelName", { group: tLevels(`group_${level.group}`), number: level.number }) : "";
    };
    const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    const dueFormatter = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

    return (
        <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-6">
            {mission.homework.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("homeworkTitle")}</h2>
                    </div>
                    <ul className="space-y-5">
                        {mission.homework.map(item => (
                            <Task
                                key={item.id}
                                icon={item.kind === "PRACTICE" ? <Repeat className="h-6 w-6" /> : item.kind === "LEVEL" ? <GraduationCap className="h-6 w-6" /> : <Puzzle className="h-6 w-6" />}
                                title={item.kind === "PRACTICE"
                                    ? t("homeworkPractice", { count: item.target, practice: item.practiceName ?? "" })
                                    : item.kind === "LEVEL"
                                        ? t("homeworkLevel", { level: levelName(item.tag) })
                                        : t("homeworkPuzzles", { count: item.target, theme: item.tag ? themeName(item.tag) : "" })}
                                done={item.done}
                                total={item.target}
                            >
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t("homeworkDue", { date: dueFormatter.format(new Date(`${item.dueOn}T00:00:00Z`)) })}</p>
                                {item.note && <p className="text-sm italic text-gray-700 dark:text-gray-300">“{item.note}”</p>}
                                {!item.complete && (
                                    <Link
                                        href={item.kind === "PRACTICE" ? `/practices/${item.practiceId}` : item.kind === "LEVEL" ? "/levels" : `/puzzles/play?tag=${encodeURIComponent(item.tag ?? "")}`}
                                        className="inline-block px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                                    >
                                        {t("start")}
                                    </Link>
                                )}
                            </Task>
                        ))}
                    </ul>
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                </div>
            )}

            <div className="flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("title")}</h2>
            </div>

            {mission.complete && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/40 text-green-900 dark:text-green-100 p-4 text-center">
                    <p className="text-lg font-bold">🎉 {t("complete")}</p>
                    <p className="text-sm mt-1">{t("completeDescription")}</p>
                </div>
            )}

            <ul className="space-y-5">
                {mission.puzzleReview?.target > 0 && <Task icon={<Repeat className="h-6 w-6" />} title={t("puzzleReviewTask")} done={mission.puzzleReview.done} total={mission.puzzleReview.target}>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t("puzzleReviewReason")}</p>
                    {mission.puzzleReview.done < mission.puzzleReview.target && <Link href="/puzzles/review" className="inline-block px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">{t("start")}</Link>}
                </Task>}
                {mission.reviewTotal > 0 && (
                    <Task icon={<Repeat className="h-6 w-6" />} title={t("reviewTask", { count: mission.reviewTotal })} done={mission.reviewDone} total={mission.reviewTotal}>
                        <div className="flex flex-wrap gap-2">
                            {review.map(group => {
                                const left = group.lineIds.length - group.doneIds.length;
                                return left > 0 ? (
                                    <Link key={group.practiceId} href={`/practices/${group.practiceId}?review=1`} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                                        {group.practiceName} ({left})
                                    </Link>
                                ) : (
                                    <span key={group.practiceId} className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm">
                                        ✓ {group.practiceName}
                                    </span>
                                );
                            })}
                        </div>
                    </Task>
                )}

                {newLine && (
                    <Task icon={<Sparkles className="h-6 w-6" />} title={t("newLineTask", { practice: newLine.practiceName })} done={newLine.done ? 1 : 0} total={1}>
                        {!newLine.done && (
                            <Link href={`/practices/${newLine.practiceId}`} className="inline-block px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                                {t("start")}
                            </Link>
                        )}
                    </Task>
                )}

                <Task icon={<Puzzle className="h-6 w-6" />} title={tagName ? t("themePuzzleTask", { count: puzzles.target, theme: tagName }) : t("puzzleTask", { count: puzzles.target })} done={puzzles.done} total={puzzles.target}>
                    {puzzles.done < puzzles.target && (
                        <Link href={tag ? `/puzzles/play?tag=${encodeURIComponent(tag)}` : "/puzzles/play"} className="inline-block px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                            {t("start")}
                        </Link>
                    )}
                    {tagName && <p className="text-sm text-gray-500 dark:text-gray-400">{t("themeReason")}</p>}
                </Task>
            </ul>

            {mission.reviewTotal === 0 && !newLine && !mission.hasPracticed && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("noPracticeYet")}{" "}
                    <Link href="/practices" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">{t("chooseOpening")} &rarr;</Link>
                </p>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between items-baseline gap-2 mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">{t("weekTitle")}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {week.activeCount >= week.goal ? `⭐ ${t("weekGoalReached")}` : t("weekProgress", { done: week.activeCount, goal: week.goal })}
                    </span>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {week.days.map(({ day, active }) => (
                        <div key={day} className="flex flex-col items-center gap-1">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ${active ? "bg-green-500 text-white" : day === mission.today ? "border-2 border-blue-500 text-blue-600 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>
                                {active ? "✓" : ""}
                            </div>
                            <span className={`text-xs capitalize ${day === mission.today ? "font-bold text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                                {weekdayFormatter.format(new Date(`${day}T00:00:00Z`))}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
