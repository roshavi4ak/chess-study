import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DASHBOARD_PAGE_SIZE, dashboardPagination, type DashboardFilters, type DashboardTeam } from "./coachDashboard";

export interface DashboardActivity {
    id: string;
    kind: "puzzle" | "practice";
    userId: string;
    studentName: string | null;
    studentImage: string | null;
    activityId: string;
    activityName: string;
    rating: number | null;
    status: string;
    createdAt: Date;
}

export async function loadDashboardTeams(): Promise<DashboardTeam[]> {
    const [saved, challenges] = await Promise.all([
        prisma.clubTeam.findMany({ select: { id: true, name: true, members: { select: { userId: true } } }, orderBy: { name: "asc" } }).catch((error: unknown) => {
            // Older installations may have challenge teams before reusable rosters are installed.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return [];
            throw error;
        }),
        prisma.challengeTeam.findMany({
            select: { id: true, name: true, members: { select: { userId: true } }, challenge: { select: { name: true } } },
            orderBy: [{ challenge: { createdAt: "desc" } }, { order: "asc" }],
        }),
    ]);
    return [
        ...saved.map(team => ({ id: `club:${team.id}`, name: team.name, memberIds: team.members.map(member => member.userId) })),
        ...challenges.map(team => ({ id: `challenge:${team.id}`, name: `${team.name} · ${team.challenge.name}`, memberIds: team.members.map(member => member.userId) })),
    ];
}

// Both histories are filtered in the database before counting and paging. UNION ALL
// gives one stable chronology without a latest-100 cap or loading earlier pages.
export function dashboardActivityQuery(filters: DashboardFilters, studentIds: string[], now = new Date()) {
    const since = filters.period === "all" ? null : new Date(now.getTime() - Number(filters.period) * 86_400_000);
    const scope = studentIds.length ? Prisma.sql`a."userId" IN (${Prisma.join(studentIds)})` : Prisma.sql`FALSE`;
    const date = since ? Prisma.sql`AND a."createdAt" >= ${since}` : Prisma.empty;
    const search = filters.q ? Prisma.sql`AND (strpos(lower(c.name), lower(${filters.q})) > 0 OR strpos(lower(u.name), lower(${filters.q})) > 0)` : Prisma.empty;
    const puzzleStatus = filters.result === "all" ? Prisma.empty
        : filters.result === "solved" ? Prisma.sql`AND a.success = TRUE`
        : filters.result === "failed" ? Prisma.sql`AND a.success = FALSE` : Prisma.sql`AND FALSE`;
    const practiceStatus = filters.result === "all" ? Prisma.empty
        : ["PERFECT", "COMPLETED", "PARTIAL"].includes(filters.result) ? Prisma.sql`AND a.status::text = ${filters.result}` : Prisma.sql`AND FALSE`;
    return Prisma.sql`
        SELECT a.id, 'puzzle' AS kind, a."userId", u.name AS "studentName", u.image AS "studentImage",
            c.name AS "activityId", c.name AS "activityName", c.rating,
            CASE WHEN a.success THEN 'solved' ELSE 'failed' END AS status, a."createdAt"
        FROM "PuzzleAttempt" a JOIN "User" u ON u.id = a."userId" JOIN "Puzzle" c ON c.id = a."puzzleId"
        WHERE ${scope} ${date} ${search} ${puzzleStatus} ${filters.activity === "practice" ? Prisma.sql`AND FALSE` : Prisma.empty}
        UNION ALL
        SELECT a.id, 'practice' AS kind, a."userId", u.name AS "studentName", u.image AS "studentImage",
            c.id AS "activityId", c.name AS "activityName", NULL::integer AS rating, a.status::text AS status, a."createdAt"
        FROM "PracticeAttempt" a JOIN "User" u ON u.id = a."userId" JOIN "Practice" c ON c.id = a."practiceId"
        WHERE ${scope} ${date} ${search} ${practiceStatus} ${filters.activity === "puzzle" ? Prisma.sql`AND FALSE` : Prisma.empty}
    `;
}

export async function loadDashboardActivity(filters: DashboardFilters, studentIds: string[]) {
    const query = dashboardActivityQuery(filters, studentIds);
    const [count] = await prisma.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total FROM (${query}) activity`);
    const total = count.total;
    const pagination = dashboardPagination(total, filters.page);
    const rows = total ? await prisma.$queryRaw<DashboardActivity[]>(Prisma.sql`
        SELECT * FROM (${query}) activity ORDER BY "createdAt" DESC, kind ASC, id DESC
        LIMIT ${DASHBOARD_PAGE_SIZE} OFFSET ${pagination.skip}
    `) : [];
    return { rows, total, pagination };
}
