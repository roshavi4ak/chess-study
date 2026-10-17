import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getExclusionSettings, type ExclusionSettings } from "@/app/actions/leaderboardExclusions";
import { isLeaderboardAdmin } from "@/lib/leaderboardExclusions";
import LeaderboardExclusionsEditor from "@/components/LeaderboardExclusionsEditor";

export default async function LeaderboardSettingsPage() {
    const session = await auth();
    if (!isLeaderboardAdmin(session?.user?.lichessId)) redirect("/leaderboard");

    const t = await getTranslations("LeaderboardSettings");
    let settings: ExclusionSettings | null = null;
    try {
        settings = await getExclusionSettings();
    } catch (error) {
        // Usually the LeaderboardExclusion table has not been created yet; the leaderboard itself keeps working.
        console.error("[LeaderboardSettings] Failed to load hidden accounts:", error);
    }

    return (
        <main className="max-w-2xl mx-auto py-6 px-4 sm:px-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
                <Link href="/leaderboard" className="text-blue-600 dark:text-blue-400 hover:underline">← {t("back")}</Link>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{t("intro")}</p>
            {settings ? (
                <LeaderboardExclusionsEditor settings={settings} />
            ) : (
                <p className="p-4 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{t("notReady")}</p>
            )}
        </main>
    );
}
