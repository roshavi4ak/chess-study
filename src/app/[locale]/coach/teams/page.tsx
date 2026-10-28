import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClubChallenges, getTeamPlanningOptions } from "@/app/actions/clubGoals";
import ChallengeForm from "@/components/ChallengeForm";
import ClubGoalForm from "@/components/ClubGoalForm";
import ClubTeamLibrary from "@/components/ClubTeamLibrary";
import { ChallengeCard, ClubGoalCard } from "@/components/ChallengeBoard";

export default async function CoachTeamsPage() {
    const session = await auth();
    if (session?.user?.role !== "COACH") redirect("/dashboard");

    const [t, club, options] = await Promise.all([getTranslations("Teams"), getClubChallenges(), getTeamPlanningOptions()]);
    const students = options.students.map(({ id, name }) => ({ id, name }));

    return (
        <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("coachTitle")}</h1>
                <div className="flex flex-wrap gap-4">
                    <a href="#team-library" className="text-blue-600 dark:text-blue-400 hover:underline">{t("teamLibrary")}</a>
                    <Link href="/challenges" className="text-blue-600 dark:text-blue-400 hover:underline">{t("openClubView")} →</Link>
                    <Link href="/coach/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToDashboard")}</Link>
                </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("coachIntro")}</p>

            {!club ? (
                <p className="p-4 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{t("notReady")}</p>
            ) : (
                <>
                    {options.teamsReady ? <ClubTeamLibrary teams={options.savedTeams} students={students} /> : <p className="text-sm text-amber-800 dark:text-amber-200">{t("teamLibraryNotReady")}</p>}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t("challengesTitle")}</h2>
                        <ChallengeForm
                            students={options.students}
                            practices={options.practices}
                            tags={options.tags}
                            today={options.today}
                            savedTeams={options.savedTeams}
                            previous={club.challenges.map(challenge => ({ id: challenge.id, name: challenge.name, teams: challenge.teams.map(team => ({ name: team.name, color: team.color, memberIds: team.memberIds })) }))}
                        />
                        {club.challenges.length === 0 && <p className="text-gray-500 dark:text-gray-400">{t("noChallenges")}</p>}
                        {[...club.challenges].reverse().map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} isCoach students={students} />)}
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t("goalsTitle")}</h2>
                        <ClubGoalForm practices={options.practices} tags={options.tags} today={options.today} />
                        {club.goals.length === 0 && <p className="text-gray-500 dark:text-gray-400">{t("noGoals")}</p>}
                        {[...club.goals].reverse().map(goal => <ClubGoalCard key={goal.id} goal={goal} isCoach />)}
                    </section>
                </>
            )}
        </main>
    );
}
