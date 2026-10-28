"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getClubChallenges, type ClubChallenges } from "@/app/actions/clubGoals";
import { teamStyle } from "@/components/TeamBadge";

// Dashboard rows: the child's team in each running challenge, and each running club goal.
export default function ClubChallengeSummary() {
    const t = useTranslations("Teams");
    const [club, setClub] = useState<ClubChallenges | null>(null);

    useEffect(() => {
        getClubChallenges().then(setClub).catch(() => undefined);
    }, []);

    const challenges = club?.challenges.filter(item => item.phase === "active" && (item.myTeamId || club.isCoach)) ?? [];
    const goals = club?.goals.filter(item => item.phase === "active") ?? [];
    if (!challenges.length && !goals.length) return null;

    return (
        <div className="space-y-2">
            {challenges.map(challenge => {
                const team = challenge.teams.find(entry => entry.id === challenge.myTeamId) ?? challenge.teams[0];
                return (
                    <Link key={challenge.id} href="/challenges" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-3 hover:shadow-md transition">
                        <span className="font-medium text-gray-900 dark:text-white">🏆 {challenge.name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            {team && (challenge.myTeamId
                                ? t("myTeamPlace", { dot: teamStyle(team.color).dot, team: team.name, rank: team.rank, count: challenge.teams.length })
                                : t("leading", { dot: teamStyle(team.color).dot, team: team.name }))}
                            {" · "}{t("daysLeft", { count: challenge.daysLeft })} <span className="text-blue-600 dark:text-blue-400">→</span>
                        </span>
                    </Link>
                );
            })}
            {goals.map(goal => (
                <Link key={goal.id} href="/challenges" className="block rounded-lg bg-white dark:bg-gray-800 shadow px-4 py-3 hover:shadow-md transition space-y-2">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">🎯 {goal.title}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{goal.total} / {goal.target} <span className="text-blue-600 dark:text-blue-400">→</span></span>
                    </span>
                    <span className="block h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <span className={`block h-full ${goal.reached ? "bg-green-500" : "bg-indigo-500"}`} style={{ width: `${goal.percent}%` }} />
                    </span>
                </Link>
            ))}
        </div>
    );
}
