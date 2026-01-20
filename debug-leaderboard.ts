import { prisma } from "./src/lib/db.ts";

async function debug() {
    const now = new Date();
    const weekStart = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    console.log("Week Start:", weekStart.toISOString());

    const names = ["meliproto", "todorpro", "mi666ka"];
    const users = await prisma.user.findMany({
        where: {
            name: { in: names }
        },
        select: {
            id: true,
            name: true,
            role: true,
            puzzleAttempts: {
                select: {
                    success: true,
                    points: true,
                    createdAt: true
                }
            }
        }
    });

    users.forEach(u => {
        const weekly = u.puzzleAttempts.filter(a => a.createdAt >= weekStart && a.success);
        const allTime = u.puzzleAttempts.filter(a => a.success);
        console.log(`\nUser: ${u.name}`);
        console.log(`Role: ${u.role}`);
        console.log(`Total Attempts Record: ${u.puzzleAttempts.length}`);
        console.log(`Weekly Solved: ${weekly.length}`);
        console.log(`All Time Solved: ${allTime.length}`);
        if (allTime.length > 0) {
            console.log("Sample attempt dates:", allTime.slice(0, 3).map(a => a.createdAt.toISOString()));
        }
    });
}

debug();
