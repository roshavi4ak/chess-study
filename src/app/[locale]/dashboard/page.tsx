import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function Dashboard() {
    const session = await auth();
    const t = await getTranslations("HomePage");

    if (!session) {
        redirect("/");
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {t("dashboard")}
                </h1>
                <div className="mt-6">
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                        Welcome back, {session.user?.name}!
                    </p>
                    <p className="text-md text-gray-500 dark:text-gray-400 mt-2">
                        Role: <span className="font-semibold">{session.user?.role}</span>
                    </p>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Cards for features */}
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                Daily Puzzle
                            </h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                <p>Solve today's puzzle to keep your tactical skills sharp.</p>
                            </div>
                            <div className="mt-5">
                                <a href="/puzzles" className="text-blue-600 hover:text-blue-500 font-medium">
                                    Go to Puzzles &rarr;
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                Study Openings
                            </h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                <p>Explore new openings or review your repertoire.</p>
                            </div>
                            <div className="mt-5">
                                <a href="/openings" className="text-blue-600 hover:text-blue-500 font-medium">
                                    Go to Openings &rarr;
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                                Play Chess
                            </h3>
                            <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                <p>Challenge a friend or play against the computer.</p>
                            </div>
                            <div className="mt-5">
                                <a href="/play" className="text-blue-600 hover:text-blue-500 font-medium">
                                    Play Now &rarr;
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
