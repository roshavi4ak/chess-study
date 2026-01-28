import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
    try {
        console.log('[API] Fetching practices...');

        // Require authentication
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Include only the requesting user's progress entries and nodes for progress calculation
        const practices = await prisma.practice.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                creator: true,
                progress: {
                    where: { userId }
                },
                nodes: true
            }
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
