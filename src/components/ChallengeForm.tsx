"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createChallenge, updateChallenge, type ChallengeEdit, type ClubTeamView } from "@/app/actions/clubGoals";
import { Link } from "@/i18n/navigation";
import { MAX_TEAMS, MIN_TEAMS, TEAM_COLORS, balancedTeams, presetPeriod, type ChallengeScoring, type TeamColor } from "@/lib/clubGoals";
import TeamGoalFields, { fieldClass, type GoalFieldsValue } from "@/components/TeamGoalFields";
import { TEAM_STYLE } from "@/components/TeamBadge";

interface PreviousChallenge {
    id: string;
    name: string;
    teams: { name: string; color: string; memberIds: string[] }[];
}

// Coach form: name the challenge, choose what counts and when, then split the children into teams.
export default function ChallengeForm({ students, practices, tags, today, previous = [], savedTeams = [], initialData }: {
    students: { id: string; name: string | null; ratingPuzzle: number | null }[];
    practices: { id: string; name: string }[];
    tags: string[];
    today: string;
    previous?: PreviousChallenge[];
    savedTeams?: ClubTeamView[];
    initialData?: ChallengeEdit;
}) {
    const t = useTranslations("Teams");
    const router = useRouter();
    const locale = useLocale();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [name, setName] = useState(initialData?.name ?? "");
    const [goal, setGoal] = useState<GoalFieldsValue>(initialData ? { metric: initialData.metric, startsOn: initialData.startsOn, endsOn: initialData.endsOn, tag: initialData.tag ?? "", practiceId: initialData.practiceId ?? "" } : { metric: "PUZZLES_SOLVED", tag: "", practiceId: "", ...presetPeriod("thisWeek", today) });
    const [scoring, setScoring] = useState<ChallengeScoring>(initialData?.scoring ?? "AVERAGE");
    const [teams, setTeams] = useState<{ id?: string; name: string; color: TeamColor }[]>(() => initialData ? initialData.teams.map(team => ({ id: team.id, name: team.name, color: team.color as TeamColor })) : TEAM_COLORS.slice(0, 2).map(color => ({ name: t(`team_${color}`), color })));
    // Child id → team index; children without an entry are not playing.
    const [assignment, setAssignment] = useState<Record<string, number>>(() => Object.fromEntries(initialData?.teams.flatMap((team, index) => team.memberIds.map(id => [id, index])) ?? []));

    function setTeamCount(count: number) {
        setTeams(TEAM_COLORS.slice(0, count).map((color, index) => teams[index] ?? { name: t(`team_${color}`), color }));
        setAssignment(previous => Object.fromEntries(Object.entries(previous).filter(([, team]) => team < count)));
    }

    function split(byRating: boolean) {
        const groups = balancedTeams(students.map(student => ({ id: student.id, rating: byRating ? student.ratingPuzzle : 0 })), teams.length);
        setAssignment(Object.fromEntries(groups.flatMap((ids, team) => ids.map(id => [id, team]))));
    }

    function copyFrom(id: string) {
        const source = previous.find(item => item.id === id);
        if (!source) return;
        const copied = source.teams.slice(0, MAX_TEAMS).map((team, index) => ({ id: teams[index]?.id, name: team.name, color: (TEAM_COLORS.includes(team.color as TeamColor) ? team.color : TEAM_COLORS[index]) as TeamColor }));
        setTeams(copied);
        setAssignment(Object.fromEntries(source.teams.flatMap((team, index) => team.memberIds.filter(member => students.some(student => student.id === member)).map(member => [member, index]))));
    }

    function selectSavedTeam(index: number, id: string) {
        const source = savedTeams.find(team => team.id === id);
        if (!source) return;
        const overlap = source.memberIds.filter(id => assignment[id] !== undefined && assignment[id] !== index);
        if (overlap.length) {
            setError(t("teamOverlap", { names: overlap.map(id => students.find(student => student.id === id)?.name ?? "?").join(", ") }));
            return;
        }
        setError(null);
        setTeams(teams.map((team, position) => position === index ? { ...team, name: source.name, color: source.color as TeamColor } : team));
        setAssignment(current => ({
            ...Object.fromEntries(Object.entries(current).filter(([, team]) => team !== index)),
            ...Object.fromEntries(source.memberIds.map(id => [id, index])),
        }));
    }

    function submit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
            try {
                const input = {
                    name,
                    scoring,
                    ...goal,
                    teams: teams.map((team, index) => ({ ...team, memberIds: Object.entries(assignment).filter(([, value]) => value === index).map(([id]) => id) })),
                };
                if (initialData) {
                    await updateChallenge(initialData.id, input);
                    router.push(`/${locale}/coach/teams`);
                    router.refresh();
                    return;
                }
                await createChallenge(input);
                setName("");
                setAssignment({});
                setSaved(true);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        });
    }

    const counts = teams.map((_, index) => Object.values(assignment).filter(value => value === index).length);
    const selectedSavedTeams = teams.map((team, index) => savedTeams.find(saved =>
        saved.name === team.name && saved.color === team.color && saved.memberIds.length === counts[index] && saved.memberIds.every(id => assignment[id] === index)
    )?.id ?? "");

    return (
        <form onSubmit={submit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t(initialData ? "editChallenge" : "newChallenge")}</h2>
            {initialData && <p className="text-sm text-gray-600 dark:text-gray-300">{t("editRecounts")}</p>}
            <fieldset disabled={pending} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1 text-sm font-medium sm:col-span-2">
                    <span>{t("challengeName")}</span>
                    <input value={name} onChange={event => setName(event.target.value)} maxLength={80} required placeholder={t("challengeNamePlaceholder")} className={fieldClass} />
                </label>
                <TeamGoalFields value={goal} onChange={setGoal} practices={practices} tags={tags} today={today} />
                <fieldset className="space-y-1 text-sm font-medium sm:col-span-2">
                    <legend>{t("scoring")}</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        {(["AVERAGE", "TOTAL"] as ChallengeScoring[]).map(option => (
                            <label key={option} className="flex items-center gap-2 font-normal">
                                <input type="radio" checked={scoring === option} onChange={() => setScoring(option)} />
                                {t(`scoring_${option}`)}
                            </label>
                        ))}
                    </div>
                </fieldset>
            </div>

            <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="space-y-1 text-sm font-medium">
                        <span>{t("teamCount")}</span>
                        <select value={teams.length} onChange={event => setTeamCount(Number(event.target.value))} className={fieldClass}>
                            {Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, index) => MIN_TEAMS + index).map(count => <option key={count} value={count}>{count}</option>)}
                        </select>
                    </label>
                    <button type="button" onClick={() => split(true)} className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-sm font-medium">{t("splitByRating")}</button>
                    <button type="button" onClick={() => split(false)} className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-sm font-medium">{t("splitRandom")}</button>
                    {previous.length > 0 && (
                        <label className="space-y-1 text-sm font-medium">
                            <span>{t("copyTeams")}</span>
                            <select value="" onChange={event => copyFrom(event.target.value)} className={fieldClass}>
                                <option value="">—</option>
                                {previous.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </label>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {teams.map((team, index) => (
                        <div key={index} className={`rounded-lg p-2 space-y-2 ${TEAM_STYLE[team.color].soft}`}>
                            {savedTeams.length > 0 && <label className="block space-y-1 text-xs font-medium">
                                <span>{t("selectSavedTeam", { number: index + 1 })}</span>
                                <select value={selectedSavedTeams[index]} onChange={event => selectSavedTeam(index, event.target.value)} className={fieldClass}>
                                    <option value="">{t("chooseSavedTeam")}</option>
                                    {savedTeams.map(saved => <option key={saved.id} value={saved.id}>{saved.name} ({saved.memberIds.length})</option>)}
                                </select>
                            </label>}
                            <div className="flex items-center gap-2">
                                <span aria-hidden>{TEAM_STYLE[team.color].dot}</span>
                                <input value={team.name} maxLength={40} required aria-label={t("teamNameNumber", { number: index + 1 })}
                                    onChange={event => setTeams(teams.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))}
                                    className="flex-1 min-w-0 rounded border border-black/10 bg-white/80 dark:bg-gray-900/60 px-2 py-1 text-sm" />
                                <span className="text-xs font-bold">{t("members", { count: counts[index] })}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                    {students.map(student => (
                        <div key={student.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                            <span>{student.name ?? "?"} {student.ratingPuzzle ? <span className="text-xs text-gray-400">({student.ratingPuzzle})</span> : null}</span>
                            <select value={assignment[student.id] ?? ""} aria-label={t("teamFor", { name: student.name ?? "?" })}
                                onChange={event => setAssignment(previous => {
                                    const next = { ...previous };
                                    if (event.target.value === "") delete next[student.id];
                                    else next[student.id] = Number(event.target.value);
                                    return next;
                                })}
                                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1">
                                <option value="">{t("notPlaying")}</option>
                                {teams.map((team, index) => <option key={index} value={index}>{TEAM_STYLE[team.color].dot} {team.name}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("rosterSnapshot")}</p>
            </fieldset>

            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {saved && <p role="status" className="text-sm text-green-700 dark:text-green-400">{t("saved")}</p>}
            <div className="flex items-center gap-4">
                <button type="submit" disabled={pending} className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50">{t(pending ? "saving" : initialData ? "saveChanges" : "createChallenge")}</button>
                {initialData && <Link href="/coach/teams" className="text-sm text-blue-600 dark:text-blue-400">{t("cancel")}</Link>}
            </div>
        </form>
    );
}
