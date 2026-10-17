import { prisma } from "./src/lib/db";

async function run() {
    const now = new Date();
    const weekStart = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);

    const students = await prisma.user.findMany({
        where: {
            role: "STUDENT",
            name: {
                notIn: ["mi666ka", "petar1976"],
            }
        },
        select: {
            id: true,
            name: true,
            puzzleAttempts: {
                select: {
                    success: true,
                    points: true,
                    createdAt: true
                }
            }
        }
    });

    const results = students.filter(s => s.name === "meliproto" || s.name === "todorpro").map(student => {
        const weeklyPuzzleAttempts = student.puzzleAttempts.filter((a) => a.createdAt >= weekStart);
        return {
            name: student.name,
            puzzleStats: {
                weekly: {
                    count: weeklyPuzzleAttempts.filter((a) => a.success).length,
                    points: weeklyPuzzleAttempts.reduce((sum, a) => sum + (a.points || 0), 0)
                },
                allTime: {
                    count: student.puzzleAttempts.filter((a) => a.success).length,
                    points: student.puzzleAttempts.reduce((sum, a) => sum + (a.points || 0), 0)
                }
            }
        };
    });

    console.log(JSON.stringify(results, null, 2));
}

run();
