import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getNextPuzzleName } from "@/lib/puzzles";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag") || undefined;
    const exclude = searchParams.get("exclude") || undefined;

    const session = await auth();
    const rating = session?.user?.ratingPuzzle ?? 1500;


    const puzzleName = await getNextPuzzleName({
        userId: session?.user?.id,
        rating,
        tag,
        excludeName: exclude
    });

    return NextResponse.json({ puzzleName });
}
