import { getTranslations } from "next-intl/server";
import LeaderboardClient from "./LeaderboardClient";

export default async function LeaderboardPage() {
    const t = await getTranslations("Leaderboard");

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    {t("title")}
                </h1>
                <LeaderboardClient />
            </div>
        </main>
    );
}