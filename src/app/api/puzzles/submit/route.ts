import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { Glicko2, RatingData, MatchResult } from "@/lib/glicko2";
import { puzzleChallengePoints } from "@/lib/puzzleChallenge";
import { puzzleMoveErrors } from "@/lib/attemptMoves";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        console.log("Received puzzle submission request:", {
            userId: session.user.id,
            method: request.method
        });
        
        const body = await request.json();
        console.log("Request body:", body);
        
        if (!body || typeof body !== "object") return new NextResponse("Invalid submission", { status: 400 });
        const { puzzleId, hintUsed = false, review = false } = body;
        if (typeof puzzleId !== "string" || typeof hintUsed !== "boolean" || typeof review !== "boolean" || typeof body.success !== "boolean") {
            return new NextResponse("Invalid submission", { status: 400 });
        }
        // Assistance is always an unsolved, unrated attempt, even if success was sent.
        const success = !hintUsed && body.success === true;

        if (!puzzleId) {
            console.error("Missing puzzleId");
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
                volatility: true,
                tags: true, fen: true, solution: true,
            }
        });

        console.log("Found user and puzzle:", {
            userFound: !!user,
            puzzleFound: !!puzzle,
            puzzleId
        });

        if (!user || !puzzle) {
            return new NextResponse("Not Found", { status: 404 });
        }

        let moveErrors: ReturnType<typeof puzzleMoveErrors> | undefined = undefined;
        try {
            moveErrors = body.moveErrors === undefined ? undefined : puzzleMoveErrors(puzzle.fen, puzzle.solution, body.moveErrors);
        } catch { return new NextResponse("Invalid move errors", { status: 400 }); }
        if (success && moveErrors?.length) return new NextResponse("A successful attempt cannot contain mistakes", { status: 400 });

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

        if (existingAttempt || hintUsed || review) {
            // Retries and assisted attempts never change either rating.
            const attempt = await prisma.puzzleAttempt.create({
                data: {
                    userId: session.user.id,
                    puzzleId: puzzleId,
                    success: success,
                    ...(moveErrors !== undefined ? { moveErrors } : {}),
                    points: 0,
                    challengePoints: 0, // No competition points for retries, hints, or reviews.
                    challengeStudentRating: userRating.rating,
                    challengePuzzleRating: puzzleRating.rating
                }
            });

            // Update tag stats for retries as well
            if (puzzle?.tags) {
                for (const tag of puzzle.tags) {
                    await prisma.userTagStats.upsert({
                        where: { userId_tag: { userId: session.user.id, tag } },
                        update: {
                            totalCount: { increment: 1 },
                            unsolvedCount: { increment: success ? 0 : 1 }
                        },
                        create: {
                            userId: session.user.id,
                            tag,
                            totalCount: 1,
                            unsolvedCount: success ? 0 : 1
                        }
                    });
                }
            }

            return NextResponse.json({
                oldRating: Math.round(userRating.rating),
                newRating: Math.round(userRating.rating),
                change: 0,
                challengePoints: 0,
                ...(moveErrors !== undefined ? { attemptId: attempt.id } : {}),
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
        const challengePoints = success ? puzzleChallengePoints(userRating.rating, puzzleRating.rating) : 0;
        const puzzleChange = Math.round(puzzleDiff * 0.1);

        const finalUserRating = Math.round(userRating.rating) + points;
        const finalPuzzleRating = Math.round(puzzleRating.rating) + puzzleChange;

        // Update DB
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                ratingPuzzle: finalUserRating,
                puzzleRd: newUserRating.rd,
                puzzleVolatility: newUserRating.volatility
            }
        });

        await prisma.puzzle.update({
            where: { id: puzzleId },
            data: {
                rating: finalPuzzleRating,
                ratingDeviation: newPuzzleRating.rd,
                volatility: newPuzzleRating.volatility
            }
        });

        const attempt = await prisma.puzzleAttempt.create({
            data: {
                userId: session.user.id,
                puzzleId: puzzleId,
                success: success,
                ...(moveErrors !== undefined ? { moveErrors } : {}),
                points: points,
                challengePoints,
                challengeStudentRating: userRating.rating,
                challengePuzzleRating: puzzleRating.rating
            }
        });

        // Update tag stats
        if (puzzle?.tags) {
            for (const tag of puzzle.tags) {
                await prisma.userTagStats.upsert({
                    where: { userId_tag: { userId: session.user.id, tag } },
                    update: {
                        totalCount: { increment: 1 },
                        unsolvedCount: { increment: success ? 0 : 1 }
                    },
                    create: {
                        userId: session.user.id,
                        tag,
                        totalCount: 1,
                        unsolvedCount: success ? 0 : 1
                    }
                });
            }
        }

        return NextResponse.json({
            oldRating: Math.round(userRating.rating),
            newRating: finalUserRating,
            change: points,
            challengePoints,
            ...(moveErrors !== undefined ? { attemptId: attempt.id } : {}),
        });
    } catch (error) {
        console.error("Error submitting puzzle result:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

// Further mistakes belong to the original attempt, without another rating change or activity count.
export async function PATCH(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    let body;
    try { body = await request.json(); } catch { return new NextResponse("Invalid submission", { status: 400 }); }
    if (!body || typeof body.attemptId !== "string") return new NextResponse("Invalid submission", { status: 400 });
    const attempt = await prisma.puzzleAttempt.findFirst({
        where: { id: body.attemptId, userId: session.user.id, success: false },
        select: { id: true, puzzle: { select: { fen: true, solution: true } } },
    });
    if (!attempt) return new NextResponse("Not Found", { status: 404 });
    let moveErrors;
    try { moveErrors = puzzleMoveErrors(attempt.puzzle.fen, attempt.puzzle.solution, body.moveErrors); }
    catch { return new NextResponse("Invalid move errors", { status: 400 }); }
    await prisma.puzzleAttempt.update({ where: { id: attempt.id }, data: { moveErrors } });
    return NextResponse.json({ attemptId: attempt.id });
}
