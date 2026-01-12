import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag");
    const exclude = searchParams.get("exclude");

    const session = await auth();
    let rating = 1500;

    if (session?.user?.ratingPuzzle) {
        rating = session.user.ratingPuzzle;
    }

    // Define rating range (+/- 200 is a good starting point)
    const minRating = rating - 200;
    const maxRating = rating + 200;

    const whereClause: any = {
        rating: {
            gte: minRating,
            lte: maxRating
        }
    };

    if (tag) {
        whereClause.tags = {
            has: tag
        };
    }

    if (exclude) {
        whereClause.name = {
            not: exclude
        };
    }

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
        // Fallback: broaden search by removing rating constraint
        const fallbackWhere: any = {};
        if (tag) {
            fallbackWhere.tags = {
                has: tag
            };
        }
        if (exclude) {
            fallbackWhere.name = {
                not: exclude
            };
        }

        const fallbackCount = await prisma.puzzle.count({
            where: fallbackWhere
        });

        if (fallbackCount > 0) {
            const skip = Math.floor(Math.random() * fallbackCount);
            puzzle = await prisma.puzzle.findFirst({
                where: fallbackWhere,
                skip,
                select: { name: true }
            });
        } else {
            // Total fallback: any other puzzle
            const totalCount = await prisma.puzzle.count({
                where: exclude ? { name: { not: exclude } } : {}
            });
            if (totalCount > 0) {
                const skip = Math.floor(Math.random() * totalCount);
                puzzle = await prisma.puzzle.findFirst({
                    where: exclude ? { name: { not: exclude } } : {},
                    skip,
                    select: { name: true }
                });
            }
        }
    }

    return NextResponse.json({ name: puzzle?.name || null });
}
