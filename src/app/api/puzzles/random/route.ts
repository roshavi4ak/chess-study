import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getNextPuzzleSelection } from "@/lib/puzzles";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const excludeName = searchParams.get("exclude") || undefined;
    const tag = searchParams.get("tag") || undefined;

    const session = await auth();
    const selection = await getNextPuzzleSelection({
        userId: session?.user?.id,
        tag,
        excludeName
    });

    return NextResponse.json({ name: selection.name, range: selection.range }, { headers: { "Cache-Control": "no-store" } });
}
