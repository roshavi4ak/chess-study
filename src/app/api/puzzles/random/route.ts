import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getNextPuzzleName } from "@/lib/puzzles";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const excludeName = searchParams.get("exclude") || undefined;
    const tag = searchParams.get("tag") || undefined;

    const session = await auth();
    const rating = session?.user?.ratingPuzzle ?? 1500;


    const puzzleName = await getNextPuzzleName({
        userId: session?.user?.id,
        rating,
        tag,
        excludeName
    });

    return NextResponse.json({ name: puzzleName });
}
