"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { addDays, sofiaDay } from "@/lib/reviewSchedule";
import { isSkillTag } from "@/lib/dailyMission";
import { dateOf, dayOf, goalValues, loadClubStudents } from "@/lib/clubGoalService";
import {
    MAX_TEAMS, MIN_TEAMS, OPENING_METRICS, THEME_METRICS, daysLeft, goalPhase, goalProgress, isGoalMetric, isTeamColor, teamStandings, validPeriod,
    type ChallengeScoring, type GoalDefinition, type GoalMetric, type GoalPhase, type TeamStanding,
} from "@/lib/clubGoals";

// Finished challenges and goals stay visible for a while so the club can see who won.
const STUDENT_HISTORY_DAYS = 14;
const COACH_HISTORY_DAYS = 60;
const MAX_BONUS_STEP = 1000;

async function requireCoach() {
    const session = await auth();
    if (session?.user?.role !== "COACH" || !session.user.id) throw new Error("Unauthorized");
    return session.user.id;
}

function revalidate() {
    revalidatePath("/[locale]/coach/teams", "page");
    revalidatePath("/[locale]/challenges", "page");
}

const cleanText = (text: string, max: number) => text.trim().replace(/\s+/g, " ").slice(0, max);

export interface GoalInput {
    metric: string;
    tag?: string | null;
    practiceId?: string | null;
    startsOn: string;
    endsOn: string;
}

// Shared checks for challenges and goals; a theme only applies to puzzle measures and an opening only to line measures.
async function checkGoal(input: GoalInput): Promise<Omit<GoalDefinition, "metric"> & { metric: GoalMetric }> {
    if (!isGoalMetric(input.metric)) throw new Error("Unknown measure");
    if (!validPeriod(input.startsOn, input.endsOn)) throw new Error("Invalid dates");
    const tag = THEME_METRICS.includes(input.metric) && input.tag ? cleanText(input.tag, 60) : null;
    const practiceId = OPENING_METRICS.includes(input.metric) && input.practiceId ? input.practiceId : null;
    if (practiceId && !(await prisma.practice.findUnique({ where: { id: practiceId }, select: { id: true } }))) throw new Error("Unknown opening");
    return { metric: input.metric, tag, practiceId, startsOn: input.startsOn, endsOn: input.endsOn };
}

export interface ChallengeInput extends GoalInput {
    name: string;
    scoring: ChallengeScoring;
    teams: { id?: string; name: string; color: string; memberIds: string[] }[];
}

async function checkChallenge(input: ChallengeInput) {
    const goal = await checkGoal(input);
    const name = cleanText(input.name, 80);
    if (!name) throw new Error("Name required");
    if (input.scoring !== "TOTAL" && input.scoring !== "AVERAGE") throw new Error("Invalid scoring");
    if (input.teams.length < MIN_TEAMS || input.teams.length > MAX_TEAMS) throw new Error("Invalid number of teams");
    const students = new Set((await loadClubStudents()).map(student => student.id));
    const seen = new Set<string>();
    for (const team of input.teams) {
        if (!cleanText(team.name, 40) || !isTeamColor(team.color)) throw new Error("Invalid team");
        for (const id of team.memberIds) {
            if (!students.has(id) || seen.has(id)) throw new Error("Each child can be in one team only");
            seen.add(id);
        }
    }
    return { name, scoring: input.scoring, metric: goal.metric, tag: goal.tag, practiceId: goal.practiceId, startsOn: dateOf(goal.startsOn), endsOn: dateOf(goal.endsOn) };
}

export async function createChallenge(input: ChallengeInput) {
    const coachId = await requireCoach();
    const data = await checkChallenge(input);
    await prisma.$transaction(async tx => {
        const challenge = await tx.teamChallenge.create({
            data: { ...data, createdBy: coachId },
        });
        for (const [order, team] of input.teams.entries()) {
            const created = await tx.challengeTeam.create({ data: { challengeId: challenge.id, name: cleanText(team.name, 40), color: team.color, order } });
            if (team.memberIds.length) {
                await tx.challengeTeamMember.createMany({ data: team.memberIds.map(userId => ({ challengeId: challenge.id, teamId: created.id, userId })) });
            }
        }
    });
    revalidate();
}

export async function updateChallenge(id: string, input: ChallengeInput) {
    await requireCoach();
    const data = await checkChallenge(input);
    await prisma.$transaction(async tx => {
        const existing = await tx.teamChallenge.findUnique({ where: { id }, include: { teams: { select: { id: true } } } });
        if (!existing) throw new Error("Unknown challenge");
        const retained = input.teams.flatMap(team => team.id ? [team.id] : []);
        if (new Set(retained).size !== retained.length || retained.some(teamId => !existing.teams.some(team => team.id === teamId))) throw new Error("Unknown team");
        await tx.teamChallenge.update({ where: { id }, data });
        // Keep retained team IDs and bonuses. Activity is still calculated from the original student records.
        await tx.challengeTeamMember.deleteMany({ where: { challengeId: id } });
        await tx.challengeTeam.deleteMany({ where: { challengeId: id, id: { notIn: retained } } });
        for (const [order, team] of input.teams.entries()) {
            const teamData = { name: cleanText(team.name, 40), color: team.color, order };
            const saved = team.id
                ? await tx.challengeTeam.update({ where: { id: team.id }, data: teamData })
                : await tx.challengeTeam.create({ data: { ...teamData, challengeId: id } });
            if (team.memberIds.length) await tx.challengeTeamMember.createMany({ data: team.memberIds.map(userId => ({ challengeId: id, teamId: saved.id, userId })) });
        }
    });
    revalidate();
}

export interface ChallengeEdit extends GoalDefinition {
    id: string;
    name: string;
    scoring: ChallengeScoring;
    teams: { id: string; name: string; color: string; memberIds: string[] }[];
}

export async function getChallengeForEdit(id: string): Promise<ChallengeEdit | null> {
    await requireCoach();
    const challenge = await prisma.teamChallenge.findUnique({ where: { id }, include: { teams: { orderBy: { order: "asc" }, include: { members: true } } } });
    if (!challenge) return null;
    return {
        id: challenge.id, name: challenge.name,
        metric: isGoalMetric(challenge.metric) ? challenge.metric : "MANUAL",
        tag: challenge.tag, practiceId: challenge.practiceId,
        startsOn: dayOf(challenge.startsOn), endsOn: dayOf(challenge.endsOn),
        scoring: challenge.scoring === "AVERAGE" ? "AVERAGE" : "TOTAL",
        teams: challenge.teams.map(team => ({ id: team.id, name: team.name, color: team.color, memberIds: team.members.map(member => member.userId) })),
    };
}

export interface ClubTeamInput {
    name: string;
    color: string;
    memberIds: string[];
}

export interface ClubTeamView extends ClubTeamInput { id: string }

export async function saveClubTeam(input: ClubTeamInput, id?: string) {
    const coachId = await requireCoach();
    const name = cleanText(input.name, 40);
    if (!name || !isTeamColor(input.color)) throw new Error("Invalid team");
    const students = new Set((await loadClubStudents()).map(student => student.id));
    if (new Set(input.memberIds).size !== input.memberIds.length || input.memberIds.some(member => !students.has(member))) throw new Error("Invalid team members");
    await prisma.$transaction(async tx => {
        const data = { name, color: input.color };
        const team = id
            ? await tx.clubTeam.update({ where: { id }, data })
            : await tx.clubTeam.create({ data: { ...data, createdBy: coachId } });
        await tx.clubTeamMember.deleteMany({ where: { teamId: team.id } });
        if (input.memberIds.length) await tx.clubTeamMember.createMany({ data: input.memberIds.map(userId => ({ teamId: team.id, userId })) });
    });
    revalidate();
}

export async function deleteClubTeam(id: string) {
    await requireCoach();
    await prisma.clubTeam.delete({ where: { id } });
    revalidate();
}

// Moves a child to another team of the same challenge, or out of the challenge when teamId is null.
export async function moveChallengeMember(challengeId: string, userId: string, teamId: string | null) {
    await requireCoach();
    if (!teamId) {
        await prisma.challengeTeamMember.deleteMany({ where: { challengeId, userId } });
    } else {
        const team = await prisma.challengeTeam.findFirst({ where: { id: teamId, challengeId }, select: { id: true } });
        if (!team) throw new Error("Unknown team");
        if (!(await loadClubStudents()).some(student => student.id === userId)) throw new Error("Unknown student");
        await prisma.challengeTeamMember.upsert({
            where: { challengeId_userId: { challengeId, userId } },
            create: { challengeId, userId, teamId },
            update: { teamId },
        });
    }
    revalidate();
}

const checkStep = (delta: number) => {
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_BONUS_STEP) throw new Error("Invalid points");
};

export async function addTeamBonus(teamId: string, delta: number) {
    await requireCoach();
    checkStep(delta);
    await prisma.challengeTeam.update({ where: { id: teamId }, data: { bonus: { increment: delta } } });
    revalidate();
}

export async function deleteChallenge(id: string) {
    await requireCoach();
    await prisma.teamChallenge.delete({ where: { id } });
    revalidate();
}

export interface ClubGoalInput extends GoalInput {
    title: string;
    target: number;
}

export async function createClubGoal(input: ClubGoalInput) {
    const coachId = await requireCoach();
    const data = await checkClubGoal(input);
    await prisma.clubGoal.create({ data: { ...data, createdBy: coachId } });
    revalidate();
}

async function checkClubGoal(input: ClubGoalInput) {
    const goal = await checkGoal(input);
    const title = cleanText(input.title, 80);
    if (!title) throw new Error("Title required");
    if (!Number.isInteger(input.target) || input.target < 1 || input.target > 1_000_000) throw new Error("Invalid target");
    return { title, target: input.target, metric: goal.metric, tag: goal.tag, practiceId: goal.practiceId, startsOn: dateOf(goal.startsOn), endsOn: dateOf(goal.endsOn) };
}

export async function updateClubGoal(id: string, input: ClubGoalInput) {
    await requireCoach();
    const data = await checkClubGoal(input);
    await prisma.clubGoal.update({ where: { id }, data });
    revalidate();
}

export interface ClubGoalEdit extends GoalDefinition { id: string; title: string; target: number }

export async function getClubGoalForEdit(id: string): Promise<ClubGoalEdit | null> {
    await requireCoach();
    const goal = await prisma.clubGoal.findUnique({ where: { id } });
    if (!goal) return null;
    return { id: goal.id, title: goal.title, target: goal.target, metric: isGoalMetric(goal.metric) ? goal.metric : "MANUAL", tag: goal.tag, practiceId: goal.practiceId, startsOn: dayOf(goal.startsOn), endsOn: dayOf(goal.endsOn) };
}

export async function addClubGoalBonus(id: string, delta: number) {
    await requireCoach();
    checkStep(delta);
    await prisma.clubGoal.update({ where: { id }, data: { bonus: { increment: delta } } });
    revalidate();
}

export async function deleteClubGoal(id: string) {
    await requireCoach();
    await prisma.clubGoal.delete({ where: { id } });
    revalidate();
}

// ----- What the club sees -----

interface PeriodView {
    id: string;
    metric: GoalMetric;
    tag: string | null;
    practiceId: string | null;
    practiceName: string | null;
    startsOn: string;
    endsOn: string;
    phase: GoalPhase;
    daysLeft: number;
}

export interface TeamView extends TeamStanding {
    // Values per child only for coaches; children see their own contribution as myValue.
    members: { id: string; name: string | null; value: number | null }[];
}

export interface ChallengeView extends PeriodView {
    name: string;
    scoring: ChallengeScoring;
    teams: TeamView[];
    myTeamId: string | null;
    myValue: number | null;
}

export interface ClubGoalView extends PeriodView {
    title: string;
    target: number;
    bonus: number;
    total: number;
    percent: number;
    reached: boolean;
    myValue: number | null;
}

export interface ClubChallenges {
    today: string;
    isCoach: boolean;
    challenges: ChallengeView[];
    goals: ClubGoalView[];
}

// Null when the tables do not exist yet (before the database update).
export async function getClubChallenges(): Promise<ClubChallenges | null> {
    const session = await auth();
    if (!session?.user?.id) return null;
    const isCoach = session.user.role === "COACH";
    const me = session.user.id;
    const today = sofiaDay(new Date());
    const since = dateOf(addDays(today, -(isCoach ? COACH_HISTORY_DAYS : STUDENT_HISTORY_DAYS)));
    try {
        const [challenges, goals, students] = await Promise.all([
            prisma.teamChallenge.findMany({
                where: { endsOn: { gte: since } },
                orderBy: [{ startsOn: "asc" }, { createdAt: "asc" }],
                include: { teams: { orderBy: { order: "asc" }, include: { members: { select: { userId: true } } } } },
            }),
            prisma.clubGoal.findMany({ where: { endsOn: { gte: since } }, orderBy: [{ startsOn: "asc" }, { createdAt: "asc" }] }),
            loadClubStudents(),
        ]);
        const practiceIds = [...new Set([...challenges, ...goals].map(item => item.practiceId).filter((id): id is string => !!id))];
        const practiceNames = new Map((await prisma.practice.findMany({ where: { id: { in: practiceIds } }, select: { id: true, name: true } })).map(p => [p.id, p.name]));
        const names = new Map(students.map(student => [student.id, student.name]));

        const period = (item: { id: string; metric: string; tag: string | null; practiceId: string | null; startsOn: Date; endsOn: Date }): PeriodView & GoalDefinition => {
            const startsOn = dayOf(item.startsOn);
            const endsOn = dayOf(item.endsOn);
            return {
                id: item.id,
                metric: (isGoalMetric(item.metric) ? item.metric : "MANUAL") as GoalMetric,
                tag: item.tag,
                practiceId: item.practiceId,
                practiceName: item.practiceId ? practiceNames.get(item.practiceId) ?? null : null,
                startsOn,
                endsOn,
                phase: goalPhase({ startsOn, endsOn }, today),
                daysLeft: daysLeft(endsOn, today),
            };
        };

        const challengeViews = await Promise.all(challenges.map(async challenge => {
            const base = period(challenge);
            const memberIds = challenge.teams.flatMap(team => team.members.map(member => member.userId));
            const values = base.phase === "upcoming" ? new Map<string, number>() : await goalValues(base, memberIds);
            const scoring = (challenge.scoring === "AVERAGE" ? "AVERAGE" : "TOTAL") as ChallengeScoring;
            const standings = teamStandings(
                challenge.teams.map(team => ({ id: team.id, name: team.name, color: team.color, bonus: team.bonus, memberIds: team.members.map(member => member.userId) })),
                values,
                scoring,
            );
            const myTeam = standings.find(team => team.memberIds.includes(me)) ?? null;
            return {
                ...base,
                name: challenge.name,
                scoring,
                myTeamId: myTeam?.id ?? null,
                myValue: myTeam ? values.get(me) ?? 0 : null,
                teams: standings.map(team => ({
                    ...team,
                    members: team.memberIds
                        .map(id => ({ id, name: names.get(id) ?? null, value: isCoach ? values.get(id) ?? 0 : null }))
                        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
                })),
            } satisfies ChallengeView;
        }));

        const studentIds = students.map(student => student.id);
        const goalViews = await Promise.all(goals.map(async goal => {
            const base = period(goal);
            const values = base.phase === "upcoming" ? new Map<string, number>() : await goalValues(base, studentIds);
            const progress = goalProgress(goal.target, [...values.values()], goal.bonus);
            return {
                ...base,
                title: goal.title,
                target: goal.target,
                bonus: goal.bonus,
                ...progress,
                myValue: values.has(me) ? values.get(me)! : null,
            } satisfies ClubGoalView;
        }));

        return { today, isCoach, challenges: challengeViews, goals: goalViews };
    } catch (error) {
        console.error("[ClubGoals] Could not load challenges and goals:", error);
        return null;
    }
}

// Children, openings and puzzle themes for the coach's forms.
export async function getTeamPlanningOptions() {
    await requireCoach();
    const [students, practices, tags, savedTeams] = await Promise.all([
        loadClubStudents(),
        prisma.practice.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.$queryRaw<{ tag: string }[]>`
            SELECT t.tag, COUNT(*)::int as count
            FROM "Puzzle", unnest(tags) as t(tag)
            GROUP BY t.tag
            ORDER BY count DESC
        `,
        prisma.clubTeam.findMany({ orderBy: { name: "asc" }, include: { members: { select: { userId: true } } } }).catch((error: unknown) => {
            // Existing challenges remain manageable while the additive roster migration is pending.
            if (error && typeof error === "object" && "code" in error && error.code === "P2021") return null;
            throw error;
        }),
    ]);
    const eligible = new Set(students.map(student => student.id));
    return {
        students, practices, tags: tags.filter(row => isSkillTag(row.tag)).map(row => row.tag), today: sofiaDay(new Date()),
        teamsReady: savedTeams !== null,
        savedTeams: (savedTeams ?? []).map(team => ({ id: team.id, name: team.name, color: team.color, memberIds: team.members.map(member => member.userId).filter(id => eligible.has(id)) })),
    };
}
