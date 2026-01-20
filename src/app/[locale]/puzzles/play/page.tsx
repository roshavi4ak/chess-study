import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNextPuzzleName } from "@/lib/puzzles";

export default async function PuzzlePlayPage({
    searchParams,
}: {
    searchParams: Promise<{ tag?: string }>;
}) {
    const { tag } = await searchParams;
    const session = await auth();

    let rating = 1500;
    if (session?.user?.id) {
        rating = session?.user?.ratingPuzzle || 1500;
    }

    const puzzleName = await getNextPuzzleName({
        userId: session?.user?.id,
        rating,
        tag: tag || undefined
    });

    if (puzzleName) {
        redirect(`/puzzles/${puzzleName}${tag ? `?tag=${tag}` : ''}`);
    } else {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-600">No puzzles found</h1>
                <p className="mt-2 text-gray-600">Try selecting a different category.</p>
            </div>
        );
    }
}
