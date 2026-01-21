import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        console.log('[API] Fetching practices...');
        
        const practices = await prisma.practice.findMany({
            orderBy: { createdAt: "desc" },
            include: { creator: true }
        });
        
        console.log(`[API] Successfully fetched ${practices.length} practices`);
        
        return NextResponse.json(practices);
    } catch (error) {
        console.error('[API] Error fetching practices:', error);
        return NextResponse.json(
            { error: 'Failed to fetch practices' },
            { status: 500 }
        );
    }
}