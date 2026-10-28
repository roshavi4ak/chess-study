import type { StudentOverview } from "@/app/actions/assignments";

export type DashboardParams = Record<string, string | string[] | undefined>;
export type DashboardFilters = ReturnType<typeof parseDashboardFilters>;
export const DASHBOARD_PAGE_SIZE = 10;

export interface DashboardTeam {
    id: string;
    name: string;
    memberIds: string[];
}

export function parseDashboardFilters(params: DashboardParams) {
    const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
    const view = value("view");
    const activity = value("activity");
    const result = value("result");
    const period = value("period");
    const page = Number(value("page"));
    return {
        view: view === "attention" || view === "activity" ? view : "students" as "students" | "attention" | "activity",
        student: value("student"),
        team: value("team"),
        q: value("q").trim().slice(0, 100),
        activity: activity === "puzzle" || activity === "practice" ? activity : "all" as "all" | "puzzle" | "practice",
        result: ["solved", "failed", "PERFECT", "COMPLETED", "PARTIAL"].includes(result) ? result : "all",
        period: period === "7" || period === "30" ? period : "all",
        page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    };
}

export function dashboardHref(filters: DashboardFilters, patch: Partial<DashboardFilters> = {}) {
    const next = { ...filters, ...patch };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
        if (!value || value === "all" || (key === "page" && value === 1) || (key === "view" && value === "students")) continue;
        params.set(key, String(value));
    }
    return `/coach/dashboard${params.size ? `?${params}` : ""}`;
}

export function needsAttention(student: StudentOverview) {
    return student.summary.flags.length > 0 || student.homework.some(item => item.overdue);
}

export function filterDashboardStudents<T extends { id: string; name: string | null }>(students: T[], teams: DashboardTeam[], filters: DashboardFilters) {
    const members = filters.team ? new Set(teams.find(team => team.id === filters.team)?.memberIds ?? []) : null;
    const query = filters.q.toLocaleLowerCase();
    return students.filter(student => (!filters.student || student.id === filters.student)
        && (!members || members.has(student.id))
        && (filters.view === "activity" || !query || student.name?.toLocaleLowerCase().includes(query)));
}

export function dashboardPagination(total: number, requestedPage: number) {
    const pages = Math.max(1, Math.ceil(total / DASHBOARD_PAGE_SIZE));
    const page = Math.min(requestedPage, pages);
    const skip = (page - 1) * DASHBOARD_PAGE_SIZE;
    return { page, pages, skip, from: total ? skip + 1 : 0, to: Math.min(skip + DASHBOARD_PAGE_SIZE, total) };
}
