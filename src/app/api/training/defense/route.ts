import { NextRequest, NextResponse } from "next/server";
import { loadDefensePuzzles } from "@/lib/defensePuzzleService";

export async function GET(request: NextRequest) {
    const value = request.nextUrl.searchParams.get("level") ?? "";
    if (!/^(?:[2-9]|10)$/.test(value)) return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    const exclude = (request.nextUrl.searchParams.get("exclude") ?? "").split(",").filter(id => /^[a-zA-Z0-9_-]{1,64}$/.test(id)).slice(0, 100);
    try {
        const puzzles = await loadDefensePuzzles(Number(value), exclude);
        if (puzzles.length !== 5) return NextResponse.json({ error: "Not enough defensive positions" }, { status: 503 });
        return NextResponse.json({ puzzles }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
        return NextResponse.json({ error: "Could not load defensive positions" }, { status: 503 });
    }
}
