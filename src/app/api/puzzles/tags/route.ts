import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        console.log('[API] Fetching puzzle tags...');
        
        const tags = await prisma.$queryRaw<{ tag: string; count: number }[]>`
            SELECT t.tag, COUNT(*)::int as count
            FROM "Puzzle", unnest(tags) as t(tag)
            GROUP BY t.tag
            ORDER BY count DESC
            LIMIT 50
        `;
        
        console.log(`[API] Successfully fetched ${tags.length} tags`);
        
        return NextResponse.json(tags);
    } catch (error) {
        console.error('[API] Error fetching tags:', error);
        return NextResponse.json(
            { error: 'Failed to fetch puzzle tags' },
            { status: 500 }
        );
    }
}