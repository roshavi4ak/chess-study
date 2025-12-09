import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const session = await auth();
    let rating = 1500;

    if (session?.user?.ratingPuzzle) {
        rating = session.user.ratingPuzzle;
    }

    // Define rating range (+/- 200 is a good starting point)
    const minRating = rating - 200;
    const maxRating = rating + 200;

    const whereClause = {
        rating: {
            gte: minRating,
            lte: maxRating
        }
    };

    // Find count of matching puzzles
    const count = await prisma.puzzle.count({
        where: whereClause
    });

    let puzzle;
    if (count > 0) {
        const skip = Math.floor(Math.random() * count);
        puzzle = await prisma.puzzle.findFirst({
            where: whereClause,
            skip,
            select: { name: true }
        });
    } else {
        // Fallback: broaden search or just random
        // Try searching broadly first (any rating)
        const totalCount = await prisma.puzzle.count();
        if (totalCount > 0) {
            const skip = Math.floor(Math.random() * totalCount);
            puzzle = await prisma.puzzle.findFirst({
                skip,
                select: { name: true }
            });
        }
    }

    return NextResponse.json({ name: puzzle?.name || null });
}
