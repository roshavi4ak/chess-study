import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function Dashboard() {
    const session = await auth();
    const t = await getTranslations("Dashboard");

    if (!session) {
        redirect("/");
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t("title")}
                </h1>
                <div className="mt-6">
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                        {t("welcomeBack")}, {session.user?.name}!
                    </p>
                    <p className="text-md text-gray-500 dark:text-gray-400 mt-2">
                        {t("role")}: <span className="font-semibold">{session.user?.role}</span>
                    </p>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Cards for features */}
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                {t("dailyPuzzle")}
                            </h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                <p>{t("dailyPuzzleDesc")}</p>
                            </div>
                            <div className="mt-5">
                                <a href="/puzzles" className="text-blue-600 hover:text-blue-500 font-medium">
                                    {t("goToPuzzles")} &rarr;
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                {t("studyOpenings")}
                            </h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                <p>{t("studyOpeningsDesc")}</p>
                            </div>
                            <div className="mt-5">
                                <a href="/openings" className="text-blue-600 hover:text-blue-500 font-medium">
                                    {t("goToOpenings")} &rarr;
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                {t("playChess")}
                            </h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                <p>{t("playChessDesc")}</p>
                            </div>
                            <div className="mt-5">
                                <a href="/play" className="text-blue-600 hover:text-blue-500 font-medium">
                                    {t("playNow")} &rarr;
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

