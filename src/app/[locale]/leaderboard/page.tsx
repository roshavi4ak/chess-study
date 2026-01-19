import { getTranslations } from "next-intl/server";
import { LeaderboardSection } from "@/components/LeaderboardSection";

export default async function LeaderboardPage() {
    const t = await getTranslations("Leaderboard");

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
                    {t("title")}
                </h1>

                <div className="space-y-8">
                    <LeaderboardSection
                        title={t("puzzles")}
                        apiEndpoint="/api/leaderboard/puzzles"
                    />

                    <LeaderboardSection
                        title={t("openings")}
                        apiEndpoint="/api/leaderboard/openings"
                    />
                </div>
            </div>
        </main>
    );
}