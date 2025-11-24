import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const excludeName = searchParams.get("exclude");

    const count = await prisma.puzzle.count({
        where: {
            name: { not: excludeName || undefined }
        }
    });

    if (count === 0) {
        return NextResponse.json({ name: null });
    }

    const skip = Math.floor(Math.random() * count);
    const puzzle = await prisma.puzzle.findFirst({
        where: {
            name: { not: excludeName || undefined }
        },
        skip,
        select: { name: true }
    });

    return NextResponse.json({ name: puzzle?.name || null });
}
