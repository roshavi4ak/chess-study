import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        console.log('[API] Fetching openings...');
        
        const openings = await prisma.opening.findMany({
            orderBy: { createdAt: "desc" },
            include: { creator: true }
        });
        
        console.log(`[API] Successfully fetched ${openings.length} openings`);
        
        return NextResponse.json(openings);
    } catch (error) {
        console.error('[API] Error fetching openings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch openings' },
            { status: 500 }
        );
    }
}