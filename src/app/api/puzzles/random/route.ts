import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const excludeName = searchParams.get("exclude");
    const tag = searchParams.get("tag");

    const whereClause: any = {
        name: { not: excludeName || undefined }
    };

    if (tag) {
        whereClause.tags = { has: tag };
    }

    const count = await prisma.puzzle.count({
        where: whereClause
    });

    if (count === 0) {
        return NextResponse.json({ name: null });
    }

    const skip = Math.floor(Math.random() * count);
    const puzzle = await prisma.puzzle.findFirst({
        where: whereClause,
        skip,
        select: { name: true }
    });

    return NextResponse.json({ name: puzzle?.name || null });
}
