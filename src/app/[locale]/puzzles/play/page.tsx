
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function PuzzlePlayPage({
    searchParams,
}: {
    searchParams: Promise<{ tag?: string }>;
}) {
    const { tag } = await searchParams;

    const whereClause: any = {};
    if (tag) {
        whereClause.tags = { has: tag };
    }

    const count = await prisma.puzzle.count({ where: whereClause });

    if (count === 0) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600">No puzzles found</h1>
                <p className="mt-2 text-gray-600">Try selecting a different category.</p>
            </div>
        );
    }

    const skip = Math.floor(Math.random() * count);
    const puzzle = await prisma.puzzle.findFirst({
        where: whereClause,
        skip,
        select: { name: true }
    });

    if (puzzle) {
        redirect(`/puzzles/${puzzle.name}${tag ? `?tag=${tag}` : ''}`);
    } else {
        return <div>Error finding puzzle</div>;
    }
}
