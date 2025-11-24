import { prisma } from "@/lib/db";
import PuzzleSession from "@/components/PuzzleSession";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        name: string;
    }>;
}

export default async function PuzzlePage({ params }: PageProps) {
    const { name } = await params;
    const puzzle = await prisma.puzzle.findUnique({
        where: { name },
        include: { creator: true }
    });

    if (!puzzle) {
        notFound();
    }

    const hints = (puzzle.hints as unknown as string[]) || [];
    const session = await import("@/auth").then(m => m.auth());
    const isCreator = session?.user?.id === puzzle.createdBy;

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center relative">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {puzzle.name}
                    </h1>
                    {isCreator && (
                        <div className="absolute top-0 right-0">
                            <a
                                href={`/puzzles/${puzzle.name}/edit`}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                            >
                                Edit Puzzle
                            </a>
                        </div>
                    )}
                    <div className="flex justify-center gap-2 mt-2">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-bold">
                            {puzzle.rating}
                        </span>
                        {puzzle.tags.map((tag: string) => (
                            <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {tag}
                            </span>
                        ))}
                    </div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        {puzzle.description}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Created by {puzzle.creator.name}
                    </p>
                </div>

                <div className="flex justify-center">
                    <PuzzleSession
                        currentPuzzleName={puzzle.name}
                        fen={puzzle.fen}
                        solution={puzzle.solution}
                        hints={hints}
                    />
                </div>
            </div>
        </main>
    );
}
