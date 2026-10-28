import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getClubChallenges } from "@/app/actions/clubGoals";
import { ChallengeCard, ClubGoalCard } from "@/components/ChallengeBoard";

// Team challenges and club goals for everyone; big enough for the club projector.
export default async function ChallengesPage() {
    const session = await auth();
    if (!session?.user) redirect("/");
    const [t, club] = await Promise.all([getTranslations("Teams"), getClubChallenges()]);
    const isCoach = session.user.role === "COACH";
    const now = (club?.challenges ?? []).filter(item => item.phase !== "finished");
    const nowGoals = (club?.goals ?? []).filter(item => item.phase !== "finished");
    const done = (club?.challenges ?? []).filter(item => item.phase === "finished").reverse();
    const doneGoals = (club?.goals ?? []).filter(item => item.phase === "finished").reverse();
    const empty = !now.length && !nowGoals.length && !done.length && !doneGoals.length;

    return (
        <main className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🤝 {t("title")}</h1>
                <div className="flex flex-wrap gap-4">
                    {isCoach && <Link href="/coach/teams" className="text-blue-600 dark:text-blue-400 hover:underline">{t("manage")} →</Link>}
                    <Link href="/fun" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("backToFun")}</Link>
                </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>

            {!club && <p className="p-4 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{t("notReady")}</p>}
            {club && empty && <p className="text-lg text-gray-600 dark:text-gray-300">{t("nothingYet")}</p>}

            {(now.length > 0 || nowGoals.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {now.map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} isCoach={isCoach} big />)}
                    {nowGoals.map(goal => <ClubGoalCard key={goal.id} goal={goal} isCoach={isCoach} big />)}
                </div>
            )}

            {(done.length > 0 || doneGoals.length > 0) && (
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t("results")}</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {done.map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} isCoach={isCoach} />)}
                        {doneGoals.map(goal => <ClubGoalCard key={goal.id} goal={goal} isCoach={isCoach} />)}
                    </div>
                </section>
            )}
        </main>
    );
}
