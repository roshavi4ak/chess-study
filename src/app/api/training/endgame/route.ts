import { NextRequest, NextResponse } from "next/server";
import { tablebaseAdvice, validTrainingEndgame } from "@/lib/endgameTablebase";

export async function GET(request: NextRequest) {
    const fen = request.nextUrl.searchParams.get("fen") ?? "";
    if (!validTrainingEndgame(fen)) return NextResponse.json({ error: "Invalid endgame" }, { status: 400 });
    try {
        const advice = await tablebaseAdvice(fen);
        return NextResponse.json(advice, { headers: { "Cache-Control": "private, max-age=3600" } });
    } catch {
        return NextResponse.json({ error: "Endgame advisor unavailable" }, { status: 503, headers: { "Retry-After": "10" } });
    }
}
