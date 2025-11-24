import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import PuzzleBuilder from "@/components/PuzzleBuilder";
import { notFound, redirect } from "next/navigation";

interface PageProps {
    params: Promise<{
        name: string;
    }>;
}

export default async function EditPuzzlePage({ params }: PageProps) {
    const session = await auth();
    if (session?.user?.role !== "COACH") {
        redirect("/");
    }

    const { name } = await params;
    const puzzle = await prisma.puzzle.findUnique({
        where: { name },
    });

    if (!puzzle) {
        notFound();
    }

    if (puzzle.createdBy !== session.user.id) {
        redirect("/puzzles");
    }

    // Convert Prisma types to what PuzzleBuilder expects
    const initialData = {
        id: puzzle.id,
        fen: puzzle.fen,
        solution: puzzle.solution,
        description: puzzle.description || "",
        name: puzzle.name,
        rating: puzzle.rating,
        tags: puzzle.tags,
        hints: (puzzle.hints as unknown as string[]) || [],
    };

    return (
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Edit Puzzle
                </h1>
                <PuzzleBuilder initialData={initialData} />
            </div>
        </main>
    );
}
