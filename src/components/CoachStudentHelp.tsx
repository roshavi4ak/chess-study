import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCoachOverview, type CoachOverview } from "@/app/actions/assignments";
import { WEEKLY_GOAL_DAYS } from "@/lib/dailyMission";
import StartLevelSelect from "@/components/StartLevelSelect";

export default async function CoachStudentHelp() {
    const [t, tCategories, locale] = await Promise.all([
        getTranslations("CoachHomework"),
        getTranslations("PuzzleCategories"),
        getLocale(),
    ]);

    let overview: CoachOverview;
    try {
        overview = await getCoachOverview();
    } catch (error) {
        console.error("[CoachStudentHelp] Failed to load overview:", error);
        return <p className="p-4 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200">{t("loadError")}</p>;
    }

    const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    // Children who need attention first, then by name.
    const students = [...overview.students].sort((a, b) =>
        Number(b.summary.flags.length > 0 || b.homework.some(item => item.overdue)) - Number(a.summary.flags.length > 0 || a.homework.some(item => item.overdue)));

    return (
        <div className="bg-white dark:bg-gray-800 shadow-xl overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-5 bg-gradient-to-r from-amber-500 to-orange-600 flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-xl font-bold text-white">{t("needsHelpTitle")}</h3>
                <Link href="/coach/assignments" className="px-3 py-1.5 rounded-lg bg-white/20 text-white font-medium hover:bg-white/30">{t("manageHomework")} →</Link>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-4 py-3 text-left">{t("student")}</th>
                            <th className="px-4 py-3 text-left">{t("lastActive")}</th>
                            <th className="px-4 py-3 text-center">{t("activeDays")}</th>
                            <th className="px-4 py-3 text-center">{t("backlog")}</th>
                            <th className="px-4 py-3 text-center">{t("mastered")}</th>
                            <th className="px-4 py-3 text-left">{t("weakTheme")}</th>
                            <th className="px-4 py-3 text-left">{t("homework")}</th>
                            <th className="px-4 py-3 text-left">{t("startLevel")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {students.map(({ id, name, summary, homework, startLevel }) => {
                            const overdue = homework.filter(item => item.overdue).length;
                            const finished = homework.filter(item => item.complete).length;
                            return (
                                <tr key={id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <Link href={`/coach/students/${id}`} prefetch={false} className="font-semibold text-blue-700 dark:text-blue-300 hover:underline">{name ?? "?"}</Link>
                                        <div className="flex gap-1 mt-1">
                                            {summary.flags.includes("inactive") && <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs">{t("flagInactive")}</span>}
                                            {summary.flags.includes("backlog") && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">{t("flagBacklog")}</span>}
                                            {overdue > 0 && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">{t("flagOverdue", { count: overdue })}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                        {summary.lastActiveDay ? dateFormatter.format(new Date(`${summary.lastActiveDay}T00:00:00Z`)) : t("never")}
                                    </td>
                                    <td className="px-4 py-3 text-center">{summary.activeDaysThisWeek} / {WEEKLY_GOAL_DAYS}</td>
                                    <td className="px-4 py-3 text-center">{summary.backlog}</td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        {summary.mastered}
                                        {summary.masteredThisWeek > 0 && <span className="text-green-600 dark:text-green-400"> (+{summary.masteredThisWeek})</span>}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {summary.weakTheme ? (tCategories.has(summary.weakTheme) ? tCategories(summary.weakTheme) : summary.weakTheme) : "—"}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{homework.length ? `${finished} / ${homework.length}` : "—"}</td>
                                    <td className="px-4 py-3 whitespace-nowrap"><StartLevelSelect studentId={id} value={startLevel} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">{t("legend")}</p>
        </div>
    );
}
