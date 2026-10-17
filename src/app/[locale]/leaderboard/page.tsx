import { getLeaderboardData } from "@/app/actions/leaderboard";
import { getWeeklyStatistics, getAllTimeWinners } from "@/app/actions/statistics";
import { getEffortBoard } from "@/app/actions/effort";
import { getLeagueView } from "@/app/actions/leagues";
import { isLeaderboardAdmin } from "@/lib/leaderboardExclusions";
import { Link } from "@/i18n/navigation";
import Leaderboard from "@/components/Leaderboard";
import { ProfileLinksProvider } from "@/components/ProfileLink";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const { tab } = await searchParams;
    const session = await auth();
    if (!session) {
        redirect("/");
    }

    try {
        const [data, weeklyStats, allTimeStats, effort, leagues] = await Promise.all([
            getLeaderboardData(),
            getWeeklyStatistics(),
            getAllTimeWinners(),
            // The effort board is optional: if it fails, the other boards still show.
            getEffortBoard().catch(error => {
                console.error("Failed to load effort board:", error);
                return undefined;
            }),
            // Leagues are optional too; null when their tables do not exist yet.
            getLeagueView(),
        ]);

        const tSettings = await getTranslations("LeaderboardSettings");

        // Transform data to ensure compatibility
        const stats = {
            weekly: {
                puzzleWinners: weeklyStats.puzzleWinners || [],
                practiceWinners: weeklyStats.practiceWinners || [],
                dateRange: weeklyStats.dateRange
            },
            allTime: allTimeStats || []
        };

        return (
            <main className="py-12 bg-gray-50 dark:bg-gray-950 min-h-screen">
                {isLeaderboardAdmin(session.user?.lichessId) && (
                    <div className="max-w-4xl mx-auto px-4 flex justify-end">
                        <Link href="/leaderboard/settings" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{tSettings("editHidden")} →</Link>
                    </div>
                )}
                {/* Coaches can open each child's profile from any name on the boards. */}
                <ProfileLinksProvider value={session.user?.role === "COACH"}>
                    <Leaderboard data={data} weeklyStats={stats} effort={effort} leagues={leagues} currentUserId={session.user?.id} initialSection={tab} />
                </ProfileLinksProvider>
            </main>
        );
    } catch (error) {
        console.error("Failed to load leaderboard data:",
            process.env.NODE_ENV === 'development' ? error : {
                message: error instanceof Error ? error.message : "Unknown error",
                code: "LEADERBOARD_LOAD_ERROR"
            }
        );

        const t = await getTranslations("Common");

        return (
            <main className="py-12 bg-gray-50 dark:bg-gray-950 min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t('errorLoading', { name: "Leaderboard" })}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        {t('tryAgainLater', { name: "leaderboard" })}
                    </p>
                    <Link
                        href="/leaderboard"
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        {t('tryAgain')}
                    </Link>
                </div>
            </main>
        );
    }
}
