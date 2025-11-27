import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Helper function to convert tag to camelCase for translation key
// Database tags are already in camelCase (e.g., "kingsideAttack", "mateIn1")
// We just need to ensure the first letter is lowercase
function tagToCamelCase(tag: string): string {
    if (!tag) return tag;
    return tag.charAt(0).toLowerCase() + tag.slice(1);
}

export default async function PuzzlesPage() {
    const session = await auth();
    const t = await getTranslations("Puzzles");
    const tCategories = await getTranslations("PuzzleCategories");

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
                        {t("title")}
                    </h1>
                    {isCoach && (
                        <Link
                            href="/puzzles/create"
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                        >
                            {t("createPuzzle")}
                        </Link>
                    )}
                </div>

                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">{t("categories")}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {tags.map((item) => {
                            const translationKey = tagToCamelCase(item.tag);
                            const translatedTag = tCategories.has(translationKey)
                                ? tCategories(translationKey)
                                : item.tag;

                            return (
                                <Link
                                    key={item.tag}
                                    href={`/puzzles/play?tag=${item.tag}`}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center gap-2"
                                >
                                    <span className="font-bold text-lg capitalize text-gray-900 dark:text-white">
                                        {translatedTag}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                        {Number(item.count)} {t("puzzlesCount")}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Also show a "Play Random" button */}
                <div className="flex justify-center mb-8">
                    <Link
                        href="/puzzles/play"
                        className="bg-blue-600 text-white px-8 py-3 rounded-full text-xl font-bold hover:bg-blue-700 shadow-lg transition transform hover:scale-105"
                    >
                        {t("playRandom")}
                    </Link>
                </div>
            </div>
        </main>
    );
}

