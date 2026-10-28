import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { History } from "lucide-react";
import { Link } from "@/i18n/navigation";
import StartLevelSelect from "@/components/StartLevelSelect";
import { dashboardHref, type DashboardFilters } from "@/lib/coachDashboard";
import type { StudentOverview } from "@/app/actions/assignments";
import { WEEKLY_GOAL_DAYS } from "@/lib/dailyMission";

export type DashboardStudent = StudentOverview & {
    ratingPuzzle: number | null;
    _count: { puzzleAttempts: number; practiceAttempts: number; openingProgress: number };
};

const cell = "px-4 py-3 text-sm text-gray-600 dark:text-gray-300";

export default async function CoachDashboardStudents({ students, filters, locale }: { students: DashboardStudent[]; filters: DashboardFilters; locale: string }) {
    const [t, h, categories] = await Promise.all([getTranslations("CoachDashboard"), getTranslations("CoachHomework"), getTranslations("PuzzleCategories")]);
    const attention = filters.view === "attention";
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    const lastActive = (student: DashboardStudent) => student.summary.lastActiveDay ? date.format(new Date(`${student.summary.lastActiveDay}T00:00:00Z`)) : h("never");
    const flags = (student: DashboardStudent) => <span className="mt-1 flex flex-wrap gap-1 text-[11px] font-medium">
        {student.summary.flags.includes("inactive") && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{h("flagInactive")}</span>}
        {student.summary.flags.includes("backlog") && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{h("flagBacklog")}</span>}
        {student.homework.some(item => item.overdue) && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-900/40 dark:text-red-200">{h("flagOverdue", { count: student.homework.filter(item => item.overdue).length })}</span>}
    </span>;
    const identity = (student: DashboardStudent) => <div className="flex min-w-0 items-center gap-3">
        {student.image ? <Image src={student.image} width={32} height={32} alt="" className="h-8 w-8 shrink-0 rounded-full" />
            : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{student.name?.[0] ?? "?"}</span>}
        <div className="min-w-0"><Link href={`/coach/students/${student.id}`} prefetch={false} className="break-words font-semibold text-gray-900 hover:text-blue-600 hover:underline dark:text-white dark:hover:text-blue-400">{student.name ?? t("unnamedStudent")}</Link>{flags(student)}</div>
    </div>;
    const activity = (student: DashboardStudent) => <Link href={dashboardHref(filters, { view: "activity", student: student.id, q: "", page: 1 })} scroll={false} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950" aria-label={t("studentActivity", { name: student.name ?? t("unnamedStudent") })}><History className="h-3.5 w-3.5" aria-hidden="true" />{t("activity")}</Link>;

    return <>
        <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left tabular-nums">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr><th scope="col" className="px-4 py-3">{t("student")}</th>
                        {attention ? <><th scope="col" className="px-4 py-3">{h("lastActive")}</th><th scope="col" className="px-4 py-3 text-center">{h("activeDays")}</th><th scope="col" className="px-4 py-3 text-center">{h("backlog")}</th><th scope="col" className="px-4 py-3 text-center">{h("mastered")}</th><th scope="col" className="px-4 py-3">{h("weakTheme")}</th><th scope="col" className="px-4 py-3 text-center">{h("homework")}</th><th scope="col" className="px-4 py-3">{h("startLevel")}</th></>
                            : <><th scope="col" className="px-4 py-3 text-center">{t("puzzlesSolved")}</th><th scope="col" className="px-4 py-3 text-center">{t("linesPlayed")}</th><th scope="col" className="px-4 py-3 text-center">{t("openingsStudied")}</th><th scope="col" className="px-4 py-3 text-right">{t("rating")}</th><th scope="col" className="px-4 py-3 text-right">{t("activity")}</th></>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
                    {students.map(student => <tr key={student.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
                        <td className={cell}>{identity(student)}</td>
                        {attention ? <>
                            <td className={`${cell} whitespace-nowrap`}>{lastActive(student)}</td>
                            <td className={`${cell} text-center`}>{student.summary.activeDaysThisWeek} / {WEEKLY_GOAL_DAYS}</td>
                            <td className={`${cell} text-center font-semibold`}>{student.summary.backlog}</td>
                            <td className={`${cell} text-center`}>{student.summary.mastered}{student.summary.masteredThisWeek > 0 && <span className="ml-1 text-xs text-green-600 dark:text-green-400">+{student.summary.masteredThisWeek}</span>}</td>
                            <td className={cell}>{student.summary.weakTheme ? (categories.has(student.summary.weakTheme) ? categories(student.summary.weakTheme) : student.summary.weakTheme) : "—"}</td>
                            <td className={`${cell} text-center`}>{student.homework.length ? `${student.homework.filter(item => item.complete).length} / ${student.homework.length}` : "—"}</td>
                            <td className={cell}><StartLevelSelect studentId={student.id} value={student.startLevel} /></td>
                        </> : <>
                            <td className={`${cell} text-center font-semibold`}>{student._count.puzzleAttempts}</td><td className={`${cell} text-center`}>{student._count.practiceAttempts}</td><td className={`${cell} text-center`}>{student._count.openingProgress}</td><td className={`${cell} text-right font-semibold`}>{student.ratingPuzzle ?? 1200}</td><td className={`${cell} text-right`}>{activity(student)}</td>
                        </>}
                    </tr>)}
                </tbody>
            </table>
        </div>
        <div className="divide-y divide-gray-100 md:hidden dark:divide-gray-700">
            {students.map(student => <article key={student.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">{identity(student)}{activity(student)}</div>
                <dl className="grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {(attention ? [[h("lastActive"), lastActive(student)], [h("backlog"), student.summary.backlog], [h("activeDays"), `${student.summary.activeDaysThisWeek} / ${WEEKLY_GOAL_DAYS}`]]
                        : [[t("puzzlesSolved"), student._count.puzzleAttempts], [t("linesPlayed"), student._count.practiceAttempts], [t("rating"), student.ratingPuzzle ?? 1200]]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{value}</dd></div>)}
                </dl>
                {attention && <details className="text-xs text-gray-600 dark:text-gray-300"><summary className="cursor-pointer py-1 text-blue-600 dark:text-blue-400">{t("learningDetails")}</summary><div className="mt-2 space-y-2"><p>{h("mastered")}: {student.summary.mastered}</p><p>{h("weakTheme")}: {student.summary.weakTheme ? (categories.has(student.summary.weakTheme) ? categories(student.summary.weakTheme) : student.summary.weakTheme) : "—"}</p><p>{h("homework")}: {student.homework.filter(item => item.complete).length} / {student.homework.length}</p><label className="flex flex-wrap items-center gap-2">{h("startLevel")}<StartLevelSelect studentId={student.id} value={student.startLevel} /></label></div></details>}
            </article>)}
        </div>
    </>;
}
