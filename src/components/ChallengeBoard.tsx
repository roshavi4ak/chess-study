"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Play, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { goalActivityHref, type GoalDefinition } from "@/lib/clubGoals";
import { addClubGoalBonus, addTeamBonus, deleteChallenge, deleteClubGoal, moveChallengeMember, type ChallengeView, type ClubGoalView } from "@/app/actions/clubGoals";
import { teamStyle } from "@/components/TeamBadge";

function usePeriodText() {
    const t = useTranslations("Teams");
    const locale = useLocale();
    const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    const day = (value: string) => format.format(new Date(`${value}T00:00:00Z`));
    return (item: { startsOn: string; endsOn: string; phase: string; daysLeft: number }) => {
        const dates = `${day(item.startsOn)} – ${day(item.endsOn)}`;
        if (item.phase === "upcoming") return t("startsOn", { date: day(item.startsOn) });
        if (item.phase === "finished") return `${dates} · ${t("finished")}`;
        return `${dates} · ${t("daysLeft", { count: item.daysLeft })}`;
    };
}

function useMeasureText() {
    const tMetrics = useTranslations("GoalMetrics");
    const tCategories = useTranslations("PuzzleCategories");
    return (item: { metric: string; tag: string | null; practiceName: string | null }) => {
        const filter = item.tag ? (tCategories.has(item.tag) ? tCategories(item.tag) : item.tag) : item.practiceName;
        return `${tMetrics(`name_${item.metric}`)}${filter ? ` · ${filter}` : ""}`;
    };
}

function useCoachAction() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const run = (action: () => Promise<unknown>) => startTransition(async () => {
        setError(null);
        try {
            await action();
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    });
    return { pending, error, run };
}

function BonusButtons({ onAdd, disabled }: { onAdd: (delta: number) => void; disabled: boolean }) {
    const t = useTranslations("Teams");
    const [amount, setAmount] = useState(5);
    return (
        <span className="inline-flex items-center gap-1 text-xs">
            <button type="button" disabled={disabled} onClick={() => onAdd(-amount)} aria-label={t("removePoints")} className="w-7 h-7 rounded bg-white/70 dark:bg-black/20 font-bold disabled:opacity-50">−</button>
            <input type="number" min={1} max={1000} value={amount} onChange={event => setAmount(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))} aria-label={t("pointsAmount")}
                className="w-14 rounded border border-black/10 bg-white/80 dark:bg-gray-900/60 px-1 py-0.5 text-center" />
            <button type="button" disabled={disabled} onClick={() => onAdd(amount)} aria-label={t("addPoints")} className="w-7 h-7 rounded bg-white/70 dark:bg-black/20 font-bold disabled:opacity-50">+</button>
        </span>
    );
}

function StartActivity({ goal, canContribute, isCoach }: { goal: GoalDefinition & { phase: string }; canContribute: boolean; isCoach: boolean }) {
    const t = useTranslations("Teams");
    const href = goalActivityHref(goal);
    if (goal.phase === "finished") return null;
    if (!href) return <p className="text-sm text-gray-500 dark:text-gray-400">{t("manualActivity")}</p>;
    return <div className="space-y-2">
        <Link href={href} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
            <Play className="h-4 w-4" /> {t(goal.phase === "active" && canContribute ? "startContributing" : "learn")}
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t(goal.phase === "upcoming" ? "practiceBeforeStart" : isCoach ? "coachActivityPreview" : canContribute ? "contributionAutomatic" : "practiceWithoutTeam")}</p>
    </div>;
}

// One team challenge: standings with bars, the child's own team highlighted. Coaches can move children,
// add points by hand and delete the challenge.
export function ChallengeCard({ challenge, isCoach, big = false, students = [] }: {
    challenge: ChallengeView;
    isCoach: boolean;
    big?: boolean;
    // Coaches: every child, so ones without a team can be added later.
    students?: { id: string; name: string | null }[];
}) {
    const t = useTranslations("Teams");
    const periodText = usePeriodText();
    const measureText = useMeasureText();
    const { pending, error, run } = useCoachAction();
    const best = Math.max(1, ...challenge.teams.map(team => team.score));
    const unassigned = students.filter(student => !challenge.teams.some(team => team.memberIds.includes(student.id)));
    const winners = challenge.phase === "finished" && challenge.teams[0]?.score > 0 ? challenge.teams.filter(team => team.rank === 1) : [];

    return (
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className={`${big ? "text-2xl" : "text-xl"} font-bold text-gray-900 dark:text-white`}>🏆 {challenge.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{measureText(challenge)} · {t(`scoring_${challenge.scoring}`)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{periodText(challenge)}</p>
                </div>
                {isCoach && (
                    <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/coach/teams/challenges/${challenge.id}/edit`} className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                        <Pencil className="h-4 w-4" /> {t("edit")}
                    </Link>
                    <button type="button" disabled={pending} onClick={() => { if (window.confirm(t("confirmDelete"))) run(() => deleteChallenge(challenge.id)); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" /> {t("delete")}
                    </button>
                    </div>
                )}
            </div>

            {winners.length > 0 && (
                <p className="rounded-xl bg-amber-50 dark:bg-amber-900/30 p-3 text-lg font-bold" role="status">
                    🎉 {t("winner", { teams: winners.map(team => team.name).join(", ") })}
                </p>
            )}

            <ol className="space-y-3">
                {challenge.teams.map(team => {
                    const style = teamStyle(team.color);
                    const mine = team.id === challenge.myTeamId;
                    return (
                        <li key={team.id} className={`rounded-xl p-3 space-y-2 ${style.soft} ${mine ? `ring-2 ${style.ring}` : ""}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`${big ? "text-xl" : "text-lg"} font-bold`}>
                                    {challenge.phase !== "upcoming" && <span className="tabular-nums mr-1">{team.rank}.</span>}
                                    {style.dot} {team.name} {mine && <span className="text-sm font-medium">({t("yourTeam")})</span>}
                                </span>
                                <span className={`${big ? "text-2xl" : "text-xl"} font-black tabular-nums`}>{team.score}</span>
                            </div>
                            <div className="h-3 rounded-full bg-white/70 dark:bg-black/20 overflow-hidden">
                                <div className={`h-full ${style.bar}`} style={{ width: `${Math.max(0, (team.score / best) * 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-200">
                                {team.members.map(member => member.name ?? "?").join(", ") || t("noMembers")}
                                {team.bonus !== 0 && <> · {t("bonusPoints", { points: team.bonus })}</>}
                            </p>
                            {isCoach && team.members.length > 0 && (
                                <div className="rounded-lg bg-white/60 dark:bg-black/10 p-3 space-y-2">
                                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200">{t("memberContributions")}</h4>
                                    <ul className="space-y-2" aria-label={t("contributionsFor", { team: team.name })}>
                                        {[...team.members].sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || (a.name ?? "").localeCompare(b.name ?? "")).map(member => (
                                            <li key={member.id} className="space-y-1">
                                                <div className="flex items-center justify-between gap-2 text-sm">
                                                    <span className="min-w-0 break-words">{member.name ?? "?"}</span>
                                                    <span className="font-bold tabular-nums">{member.value ?? 0}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-white/70 dark:bg-black/20 overflow-hidden" aria-hidden="true">
                                                    <div className={`h-full ${style.bar}`} style={{ width: `${team.earned > 0 ? ((member.value ?? 0) / team.earned) * 100 : 0}%` }} />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t("earnedTotal", { value: team.earned })}</p>
                                    {challenge.scoring === "AVERAGE" && <p className="text-xs text-gray-600 dark:text-gray-300">{t("averageExplanation", { count: team.memberIds.length })}</p>}
                                    {challenge.metric === "MANUAL" && <p className="text-xs text-gray-600 dark:text-gray-300">{t("manualTeamOnly")}</p>}
                                </div>
                            )}
                            {isCoach && (
                                <details className="text-sm">
                                    <summary className="cursor-pointer text-gray-700 dark:text-gray-200">{t("manageTeam")}</summary>
                                    <div className="mt-2 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span>{t("handPoints")}</span>
                                            <BonusButtons disabled={pending} onAdd={delta => run(() => addTeamBonus(team.id, delta))} />
                                        </div>
                                        <ul className="space-y-1">
                                            {team.members.map(member => (
                                                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2">
                                                    <span>{member.name ?? "?"} <span className="font-bold tabular-nums">{member.value ?? 0}</span></span>
                                                    <select value={team.id} disabled={pending} aria-label={t("teamFor", { name: member.name ?? "?" })}
                                                        onChange={event => run(() => moveChallengeMember(challenge.id, member.id, event.target.value || null))}
                                                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-0.5 text-xs">
                                                        {challenge.teams.map(option => <option key={option.id} value={option.id}>{teamStyle(option.color).dot} {option.name}</option>)}
                                                        <option value="">{t("notPlaying")}</option>
                                                    </select>
                                                </li>
                                            ))}
                                        </ul>
                                        {unassigned.length > 0 && (
                                            <select value="" disabled={pending} aria-label={t("addChild")}
                                                onChange={event => { if (event.target.value) run(() => moveChallengeMember(challenge.id, event.target.value, team.id)); }}
                                                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs">
                                                <option value="">+ {t("addChild")}</option>
                                                {unassigned.map(student => <option key={student.id} value={student.id}>{student.name ?? "?"}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </details>
                            )}
                        </li>
                    );
                })}
            </ol>
            {challenge.myValue !== null && challenge.phase !== "upcoming" && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">⭐ {t("yourShare", { value: challenge.myValue })}</p>
            )}
            {!challenge.myTeamId && !isCoach && <p className="text-sm text-gray-500 dark:text-gray-400">{t("notInTeam")}</p>}
            <StartActivity goal={challenge} canContribute={challenge.myTeamId !== null} isCoach={isCoach} />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>
    );
}

// One club goal: a progress bar towards the target, with the child's own share.
export function ClubGoalCard({ goal, isCoach, big = false }: { goal: ClubGoalView; isCoach: boolean; big?: boolean }) {
    const t = useTranslations("Teams");
    const periodText = usePeriodText();
    const measureText = useMeasureText();
    const { pending, error, run } = useCoachAction();
    return (
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className={`${big ? "text-2xl" : "text-xl"} font-bold text-gray-900 dark:text-white`}>🎯 {goal.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{measureText(goal)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{periodText(goal)}</p>
                </div>
                {isCoach && (
                    <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/coach/teams/goals/${goal.id}/edit`} className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                        <Pencil className="h-4 w-4" /> {t("edit")}
                    </Link>
                    <button type="button" disabled={pending} onClick={() => { if (window.confirm(t("confirmDelete"))) run(() => deleteClubGoal(goal.id)); }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" /> {t("delete")}
                    </button>
                    </div>
                )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
                <span className={`${big ? "text-4xl" : "text-3xl"} font-black tabular-nums`}>{goal.total} <span className="text-lg font-medium text-gray-500 dark:text-gray-400">/ {goal.target}</span></span>
                <span className="text-lg font-bold">{goal.percent}%</span>
            </div>
            <div className="h-5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(goal.total, goal.target)}>
                <div className={`h-full ${goal.reached ? "bg-green-500" : "bg-gradient-to-r from-sky-400 to-indigo-500"}`} style={{ width: `${goal.percent}%` }} />
            </div>
            {goal.reached && <p className="font-bold text-green-700 dark:text-green-400" role="status">🎉 {t("goalReached")}</p>}
            {!goal.reached && goal.phase === "finished" && <p className="text-gray-600 dark:text-gray-300">{t("goalMissed")}</p>}
            {goal.myValue !== null && goal.phase !== "upcoming" && goal.metric !== "MANUAL" && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">⭐ {t("yourShare", { value: goal.myValue })}</p>
            )}
            {isCoach && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{t("handProgress")}</span>
                    <BonusButtons disabled={pending} onAdd={delta => run(() => addClubGoalBonus(goal.id, delta))} />
                    {goal.bonus !== 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{t("bonusPoints", { points: goal.bonus })}</span>}
                </div>
            )}
            <StartActivity goal={goal} canContribute={goal.myValue !== null} isCoach={isCoach} />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>
    );
}
