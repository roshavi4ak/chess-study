"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { dashboardHref, parseDashboardFilters, type DashboardFilters, type DashboardTeam } from "@/lib/coachDashboard";

const control = "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export default function CoachDashboardFilters({ filters, students, teams }: {
    filters: DashboardFilters;
    students: { id: string; name: string | null }[];
    teams: DashboardTeam[];
}) {
    const t = useTranslations("CoachDashboard");
    const locale = useLocale();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [expanded, setExpanded] = useState(false);
    const activityView = filters.view === "activity";
    const activeCount = [filters.student, filters.team, ...(activityView ? [filters.activity !== "all", filters.result !== "all", filters.period !== "all"] : [])].filter(Boolean).length;
    const selectedNames = [teams.find(team => team.id === filters.team)?.name, students.find(student => student.id === filters.student)?.name].filter(Boolean).join(" · ");
    const hasFilters = filters.student || filters.team || filters.q || (activityView && (filters.activity !== "all" || filters.result !== "all" || filters.period !== "all"));

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
        startTransition(() => router.push(dashboardHref(parseDashboardFilters(values)), { scroll: false }));
    }

    return (
        <form action={`/${locale}/coach/dashboard`} onSubmit={submit} aria-label={t("filters")} aria-busy={pending}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
            <input type="hidden" name="view" value={filters.view} />
            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />{t("filters")}</span>
                {hasFilters && <Link href={dashboardHref(parseDashboardFilters({ view: filters.view }))} scroll={false} className="flex items-center gap-1 rounded text-blue-600 hover:underline dark:text-blue-400"><X className="h-3.5 w-3.5" aria-hidden="true" />{t("clearFilters")}</Link>}
            </div>
            {selectedNames && <p className="mb-3 break-words text-xs text-gray-600 sm:hidden dark:text-gray-300">{selectedNames}</p>}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 gap-2"><label className="block min-w-0 flex-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {activityView ? t("searchActivity") : t("searchStudents")}
                    <span className="relative mt-1.5 block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                        <input key={`${filters.view}:${filters.q}`} name="q" type="search" defaultValue={filters.q} placeholder={activityView ? t("activityPlaceholder") : t("studentPlaceholder")} className={`${control} pl-9`} />
                    </span>
                </label><button type="submit" disabled={pending} className="h-10 self-end rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60">{pending ? t("loading") : t("applyFilters")}</button></div>
                <label className={`${expanded ? "block" : "hidden"} min-w-0 text-xs font-medium text-gray-600 sm:block dark:text-gray-300`}>{t("team")}
                    <select name="team" value={filters.team} onChange={event => event.currentTarget.form?.requestSubmit()} className={`${control} mt-1.5`}>
                        <option value="">{t("allTeams")}</option>
                        {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                </label>
                <label className={`${expanded ? "block" : "hidden"} min-w-0 text-xs font-medium text-gray-600 sm:block dark:text-gray-300`}>{t("student")}
                    <select name="student" value={filters.student} onChange={event => event.currentTarget.form?.requestSubmit()} className={`${control} mt-1.5`}>
                        <option value="">{t("allStudents")}</option>
                        {students.map(student => <option key={student.id} value={student.id}>{student.name ?? t("unnamedStudent")}</option>)}
                    </select>
                </label>
            </div>
            <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="mt-3 flex w-full items-center justify-between rounded py-1 text-xs font-semibold text-blue-600 sm:hidden dark:text-blue-400"><span>{expanded ? t("fewerFilters") : t("moreFilters")}{activeCount > 0 && ` (${activeCount})`}</span><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></button>
            {activityView && <div className={`${expanded ? "grid" : "hidden"} mt-3 gap-3 border-t border-gray-100 pt-3 sm:grid sm:grid-cols-3 dark:border-gray-700`}>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t("activityType")}
                    <select name="activity" value={filters.activity} onChange={event => {
                        const result = event.currentTarget.form?.elements.namedItem("result");
                        if (result instanceof HTMLSelectElement) result.value = "all";
                        event.currentTarget.form?.requestSubmit();
                    }} className={`${control} mt-1.5`}>
                        <option value="all">{t("allActivities")}</option><option value="puzzle">{t("puzzles")}</option><option value="practice">{t("practices")}</option>
                    </select>
                </label>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t("status")}
                    <select name="result" value={filters.result} onChange={event => event.currentTarget.form?.requestSubmit()} className={`${control} mt-1.5`}>
                        <option value="all">{t("allResults")}</option>
                        {filters.activity !== "practice" && <><option value="solved">{t("solved")}</option><option value="failed">{t("failed")}</option></>}
                        {filters.activity !== "puzzle" && <><option value="PERFECT">{t("statusPERFECT")}</option><option value="COMPLETED">{t("statusCOMPLETED")}</option><option value="PARTIAL">{t("statusPARTIAL")}</option></>}
                    </select>
                </label>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{t("period")}
                    <select name="period" value={filters.period} onChange={event => event.currentTarget.form?.requestSubmit()} className={`${control} mt-1.5`}>
                        <option value="all">{t("allTime")}</option><option value="7">{t("last7Days")}</option><option value="30">{t("last30Days")}</option>
                    </select>
                </label>
            </div>}
            <span className="sr-only" role="status">{pending ? t("loading") : ""}</span>
        </form>
    );
}
