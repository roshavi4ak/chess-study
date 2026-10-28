import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Activity, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Users, AlertCircle, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoachOverview } from "@/app/actions/assignments";
import CoachDashboardFilters from "@/components/CoachDashboardFilters";
import CoachDashboardStudents, { type DashboardStudent } from "@/components/CoachDashboardStudents";
import { dashboardHref, dashboardPagination, DASHBOARD_PAGE_SIZE, filterDashboardStudents, needsAttention, parseDashboardFilters, type DashboardParams } from "@/lib/coachDashboard";
import { loadDashboardActivity, loadDashboardTeams, type DashboardActivity } from "@/lib/coachDashboardData";

export default async function CoachDashboard({ searchParams }: { searchParams: Promise<DashboardParams> }) {
    const session = await auth();
    if (session?.user?.role !== "COACH") redirect("/dashboard");

    const filters = parseDashboardFilters(await searchParams);
    const [t, h, locale, overview, roster, teams] = await Promise.all([
        getTranslations("CoachDashboard"), getTranslations("CoachHomework"), getLocale(), getCoachOverview(),
        prisma.user.findMany({
            where: { role: "STUDENT" },
            select: {
                id: true, ratingPuzzle: true,
                _count: { select: {
                    puzzleAttempts: { where: { success: true } },
                    practiceAttempts: { where: { status: { in: ["PERFECT", "COMPLETED"] } } },
                    openingProgress: true,
                } },
            },
        }),
        loadDashboardTeams(),
    ]);
    const progress = new Map(roster.map(student => [student.id, student]));
    const students: DashboardStudent[] = overview.students.map(student => ({
        ...student, ratingPuzzle: progress.get(student.id)?.ratingPuzzle ?? null,
        _count: progress.get(student.id)?._count ?? { puzzleAttempts: 0, practiceAttempts: 0, openingProgress: 0 },
    }));
    const scoped = filterDashboardStudents(students, teams, { ...filters, q: "" });
    const matching = filterDashboardStudents(students, teams, filters);
    const attentionCount = scoped.filter(needsAttention).length;
    const visible = filters.view === "attention" ? matching.filter(needsAttention).sort((a, b) =>
        b.homework.filter(item => item.overdue).length - a.homework.filter(item => item.overdue).length
        || b.summary.backlog - a.summary.backlog) : matching;
    const history = filters.view === "activity" ? await loadDashboardActivity(filters, scoped.map(student => student.id)) : null;
    const total = history?.total ?? visible.length;
    const pagination = history?.pagination ?? dashboardPagination(total, filters.page);
    const pageStudents = visible.slice(pagination.skip, pagination.skip + DASHBOARD_PAGE_SIZE);
    const viewTitle = filters.view === "attention" ? h("needsHelpTitle") : filters.view === "activity" ? t("recentActivity") : t("studentProgress");
    const tabs = [
        { view: "students" as const, label: t("students"), count: scoped.length, icon: Users },
        { view: "attention" as const, label: t("attentionTab"), count: attentionCount, icon: AlertCircle },
        { view: "activity" as const, label: t("activity"), count: null, icon: Activity },
    ];

    return (
        <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">{t("clubOverview")}</p><h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">{t("title")}</h1><p className="mt-1 hidden text-sm text-gray-500 sm:block dark:text-gray-400">{t("intro")}</p></div>
                <div className="flex flex-wrap gap-2">
                    <Link href="/coach/teams" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"><Users className="h-4 w-4" aria-hidden="true" />{h("manageTeams")}</Link>
                    <Link href="/coach/assignments" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"><GraduationCap className="h-4 w-4" aria-hidden="true" />{h("manageHomework")}</Link>
                </div>
            </header>

            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                    { label: t("students"), value: scoped.length, icon: Users, color: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400", view: "students" as const },
                    { label: t("needsAttention"), value: attentionCount, icon: AlertCircle, color: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400", view: "attention" as const },
                    { label: t("activeThisWeek"), value: scoped.filter(student => student.summary.activeDaysThisWeek > 0).length, icon: Activity, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400", view: null },
                ].map(({ label, value, icon: Icon, color, view }) => {
                    const content = <><span className={cn("hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex", color)}><Icon className="h-4 w-4" aria-hidden="true" /></span><span><span className="block text-xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{label}</span></span></>;
                    const style = "flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 sm:px-4 dark:border-gray-700 dark:bg-gray-800/60";
                    return view ? <Link key={label} href={dashboardHref(filters, { view, page: 1 })} scroll={false} className={`${style} hover:border-blue-400 dark:hover:border-blue-500`}>{content}</Link> : <div key={label} className={style}>{content}</div>;
                })}
            </div>

            <nav aria-label={t("dashboardViews")} className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
                {tabs.map(({ view, label, count, icon: Icon }) => <Link key={view} href={dashboardHref(filters, { view, page: 1 })} scroll={false} aria-current={filters.view === view ? "page" : undefined}
                    className={cn("flex flex-1 items-center justify-center gap-2 border-b-2 px-1 py-3 text-xs font-semibold sm:flex-none sm:px-4 sm:text-sm", filters.view === view ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white")}>
                    <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />{label}{count !== null && <span className="hidden rounded-md bg-gray-100 px-1.5 py-0.5 text-xs tabular-nums text-gray-600 sm:inline dark:bg-gray-800 dark:text-gray-300">{count}</span>}
                </Link>)}
            </nav>

            <CoachDashboardFilters filters={filters} students={students} teams={teams} />

            <section aria-label={viewTitle} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-4 dark:border-gray-700"><div><h2 className="text-base font-bold text-gray-900 dark:text-white">{viewTitle}</h2><p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{filters.view === "activity" ? t("activityHint") : filters.view === "attention" ? t("attentionHint") : t("progressHint")}</p></div><span role="status" className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{t("resultCount", { count: total })}</span></div>
                {total === 0 ? <div className="flex flex-col items-center gap-2 px-4 py-12 text-center"><SearchX className="mb-1 h-8 w-8 text-gray-400" aria-hidden="true" /><h3 className="font-semibold text-gray-900 dark:text-white">{t("noResults")}</h3><p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{t("noResultsHint")}</p><Link href={dashboardHref(parseDashboardFilters({ view: filters.view }))} scroll={false} className="mt-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">{t("clearFilters")}</Link></div>
                    : history ? <DashboardHistory rows={history.rows} locale={locale} /> : <CoachDashboardStudents students={pageStudents} filters={filters} locale={locale} />}
                {total > 0 && <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"><span>{t("showing", { from: pagination.from, to: pagination.to, total })}</span><div className="flex items-center gap-3"><PageLink disabled={pagination.page <= 1} href={dashboardHref(filters, { page: pagination.page - 1 })} label={t("previous")}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></PageLink><span className="tabular-nums">{t("pageOf", { page: pagination.page, pages: pagination.pages })}</span><PageLink disabled={pagination.page >= pagination.pages} href={dashboardHref(filters, { page: pagination.page + 1 })} label={t("next")}><ChevronRight className="h-4 w-4" aria-hidden="true" /></PageLink></div></nav>}
                {filters.view === "attention" && <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">{h("legend")}</p>}
            </section>
            {filters.student && <Link href={dashboardHref(filters, { student: "", page: 1 })} scroll={false} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-400"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("backToStudents")}</Link>}
        </main>
    );
}

async function DashboardHistory({ rows, locale }: { rows: DashboardActivity[]; locale: string }) {
    const t = await getTranslations("CoachDashboard");
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Sofia" });
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });
    const student = (item: DashboardActivity) => <Link href={`/coach/students/${item.userId}`} prefetch={false} className="text-sm font-semibold text-gray-900 hover:underline dark:text-white">{item.studentName ?? t("unnamedStudent")}</Link>;
    const name = (item: DashboardActivity) => <Link href={item.kind === "puzzle" ? `/puzzles/${encodeURIComponent(item.activityId)}` : `/practices/${item.activityId}`} prefetch={false} className="break-words text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">{item.activityName}</Link>;
    const kind = (item: DashboardActivity) => <span className="text-xs text-gray-500 dark:text-gray-400">{item.kind === "puzzle" ? t("puzzle") : t("practice")}{item.rating !== null && ` · ${t("rating")}: ${item.rating}`}</span>;
    const timestamp = (item: DashboardActivity) => <time dateTime={item.createdAt.toISOString()} className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{date.format(item.createdAt)}<span className="ml-2 text-gray-400">{time.format(item.createdAt)}</span></time>;
    return <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400"><tr>{[t("student"), t("activity"), t("status"), t("date")].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">{rows.map(item => <tr key={`${item.kind}:${item.id}`} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20"><td className="px-4 py-3">{student(item)}</td><td className="max-w-sm px-4 py-3">{name(item)}<div className="mt-0.5">{kind(item)}</div></td><td className="px-4 py-3"><StatusBadge status={item.status} label={t(statusKey(item.status))} /></td><td className="px-4 py-3">{timestamp(item)}</td></tr>)}</tbody></table></div>
        <div className="divide-y divide-gray-100 md:hidden dark:divide-gray-700">{rows.map(item => <article key={`${item.kind}:${item.id}`} className="space-y-2 p-4"><div className="flex items-center justify-between gap-2">{student(item)}<StatusBadge status={item.status} label={t(statusKey(item.status))} /></div><div>{name(item)}</div><div className="flex flex-wrap justify-between gap-2">{kind(item)}{timestamp(item)}</div></article>)}</div>
    </>;
}

function statusKey(status: string) {
    if (status === "solved" || status === "failed") return status;
    if (status === "PERFECT") return "statusPERFECT";
    if (status === "COMPLETED") return "statusCOMPLETED";
    return "statusPARTIAL";
}

function StatusBadge({ status, label }: { status: string; label: string }) {
    const positive = status === "solved" || status === "PERFECT" || status === "COMPLETED";
    return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium", positive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300")}>
        {positive ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <AlertCircle className="h-3 w-3" aria-hidden="true" />}{label}
    </span>;
}

function PageLink({ disabled, href, label, children }: { disabled: boolean; href: string; label: string; children: React.ReactNode }) {
    const style = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700";
    return disabled ? <span aria-disabled="true" aria-label={label} className={`${style} opacity-30`}>{children}</span> : <Link href={href} scroll={false} aria-label={label} className={`${style} text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700`}>{children}</Link>;
}
