import { prisma } from "@/lib/db";
import PuzzleSolver from "@/components/PuzzleSolver";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function PuzzlePage({ params }: PageProps) {
    const { id } = await params;
    const puzzle = await prisma.puzzle.findUnique({
        where: { id },
        include: { creator: true }
    });

    if (!puzzle) {
        notFound();
    }

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Puzzle
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {puzzle.description}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Created by {puzzle.creator.name}
                    </p>
                </div>

                <div className="flex justify-center">
                    <PuzzleSolver fen={puzzle.fen} solution={puzzle.solution} />
                </div>
            </div>
        </main>
    );
}
