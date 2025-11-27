import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PuzzlesPage() {
    const session = await auth();
    const t = await getTranslations("Navigation");

    // Fetch unique tags and their counts
    const tags = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
        SELECT t.tag, COUNT(*)::int as count
        FROM "Puzzle", unnest(tags) as t(tag)
        GROUP BY t.tag
        ORDER BY count DESC
        LIMIT 50
    `;

    const isCoach = session?.user?.role === "COACH";

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {t("puzzles")}
                    </h1>
                    {isCoach && (
                        <Link
                            href="/puzzles/create"
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                        >
                            Create Puzzle
                        </Link>
                    )}
                </div>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Categories</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {tags.map((item) => (
                            <Link
                                key={item.tag}
                                href={`/puzzles/play?tag=${item.tag}`}
                                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center gap-2"
                            >
                                <span className="font-bold text-lg capitalize text-gray-900 dark:text-white">
                                    {item.tag}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {Number(item.count)} puzzles
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Also show a "Play Random" button */}
                <div className="flex justify-center mb-8">
                    <Link
                        href="/puzzles/play"
                        className="bg-blue-600 text-white px-8 py-3 rounded-full text-xl font-bold hover:bg-blue-700 shadow-lg transition transform hover:scale-105"
                    >
                        Play Random Puzzle
                    </Link>
                </div>
            </div>
        </main>
    );
}
