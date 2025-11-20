import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const params = new URLSearchParams(body);

        // Inject client_id if missing
        if (!params.has("client_id")) {
            params.append("client_id", process.env.LICHESS_CLIENT_ID || "chess-study-app");
        }

        const response = await fetch("https://lichess.org/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Token proxy error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
