import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getRaceView } from "@/lib/raceState";

// Polled about once a second by racers and the projector screen.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    const { code } = await params;
    try {
        const view = await getRaceView(code, session.user.id);
        if (!view) return new NextResponse("Not found", { status: 404 });
        return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[Race] Failed to load race:", error);
        return new NextResponse("Error", { status: 500 });
    }
}
