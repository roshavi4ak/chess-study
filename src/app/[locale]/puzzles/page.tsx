import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PuzzlesPage() {
    const session = await auth();
    const t = await getTranslations("Navigation");

    const puzzles = await prisma.puzzle.findMany({
        orderBy: { createdAt: "desc" },
        include: { creator: true }
    });

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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {puzzles.length === 0 ? (
                        <p className="text-gray-500">No puzzles found.</p>
                    ) : (
                        puzzles.map((puzzle) => (
                            <Link
                                key={puzzle.id}
                                href={`/puzzles/${puzzle.id}`}
                                className="block bg-white dark:bg-gray-800 shadow rounded-lg hover:shadow-md transition"
                            >
                                <div className="p-4">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                                        {puzzle.description || "Untitled Puzzle"}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Created by {puzzle.creator.name}
                                    </p>
                                    <div className="mt-4">
                                        {/* Mini board preview could go here */}
                                        <div className="text-xs text-gray-400 font-mono truncate">
                                            {puzzle.fen}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
