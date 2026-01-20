import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { Glicko2, RatingData, MatchResult } from "@/lib/glicko2";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { puzzleId, success } = await request.json();

        if (!puzzleId) {
            return new NextResponse("Missing puzzleId", { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                ratingPuzzle: true,
                puzzleRd: true,
                puzzleVolatility: true
            }
        });

        const puzzle = await prisma.puzzle.findUnique({
            where: { id: puzzleId },
            select: {
                id: true,
                rating: true,
                ratingDeviation: true,
                volatility: true
            }
        });

        if (!user || !puzzle) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const userRating: RatingData = {
            rating: user.ratingPuzzle || 1500,
            rd: user.puzzleRd || 350,
            volatility: user.puzzleVolatility || 0.06
        };

        const puzzleRating: RatingData = {
            rating: puzzle.rating,
            rd: puzzle.ratingDeviation || 350,
            volatility: puzzle.volatility || 0.06
        };

        const score = success ? 1 : 0;

        // Check if user already attempted this puzzle to satisfy requirement #2
        const existingAttempt = await prisma.puzzleAttempt.findFirst({
            where: {
                userId: session.user.id,
                puzzleId: puzzleId
            }
        });

        if (existingAttempt) {
            // Already tried this puzzle, don't change rating
            await prisma.puzzleAttempt.create({
                data: {
                    userId: session.user.id,
                    puzzleId: puzzleId,
                    success: success,
                    points: 0 // No points for retries
                }
            });

            return NextResponse.json({
                oldRating: Math.round(userRating.rating),
                newRating: Math.round(userRating.rating),
                change: 0
            });
        }

        // User vs Puzzle
        const userResult: MatchResult = {
            opponentRating: puzzleRating.rating,
            opponentRd: puzzleRating.rd,
            score: score
        };
        const newUserRating = Glicko2.calculateNewRating(userRating, [userResult]);

        // Puzzle vs User
        const puzzleResult: MatchResult = {
            opponentRating: userRating.rating,
            opponentRd: userRating.rd,
            score: 1 - score
        };
        const newPuzzleRating = Glicko2.calculateNewRating(puzzleRating, [puzzleResult]);

        // Dial down rating changes: 70% for user, 10% for puzzle
        const userDiff = newUserRating.rating - userRating.rating;
        const puzzleDiff = newPuzzleRating.rating - puzzleRating.rating;

        const points = Math.round(userDiff * 0.7);
        const puzzleChange = Math.round(puzzleDiff * 0.1);

        const finalUserRating = Math.round(userRating.rating) + points;
        const finalPuzzleRating = Math.round(puzzleRating.rating) + puzzleChange;

        // Update DB
        await prisma.$transaction([
            prisma.user.update({
                where: { id: session.user.id },
                data: {
                    ratingPuzzle: finalUserRating,
                    puzzleRd: newUserRating.rd,
                    puzzleVolatility: newUserRating.volatility
                }
            }),
            prisma.puzzle.update({
                where: { id: puzzleId },
                data: {
                    rating: finalPuzzleRating,
                    ratingDeviation: newPuzzleRating.rd,
                    volatility: newPuzzleRating.volatility
                }
            }),
            prisma.puzzleAttempt.create({
                data: {
                    userId: session.user.id,
                    puzzleId: puzzleId,
                    success: success,
                    points: points
                }
            })
        ]);

        return NextResponse.json({
            oldRating: Math.round(userRating.rating),
            newRating: finalUserRating,
            change: points
        });
    } catch (error) {
        console.error("Error submitting puzzle result:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
