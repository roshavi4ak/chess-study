import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getNextPuzzleSelection } from "@/lib/puzzles";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag") || undefined;
    const exclude = searchParams.get("exclude") || undefined;

    const session = await auth();
    const selection = await getNextPuzzleSelection({
        userId: session?.user?.id,
        tag,
        excludeName: exclude
    });

    return NextResponse.json({ puzzleName: selection.name, range: selection.range }, { headers: { "Cache-Control": "no-store" } });
}
