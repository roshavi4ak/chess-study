import { prisma } from "@/lib/db";
import { KING_LEVEL, levelProgress } from "@/lib/curriculum";

export interface MyLevel {
    currentId: string;
    currentIndex: number;
    passed: string[];
    kingPasses: number;
    kingRating: number;
    // Best test score per level id.
    best: Record<string, number>;
}

export async function loadLevel(userId: string): Promise<MyLevel> {
    const [user, sessions] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { startLevel: true } }).catch(() => null),
        prisma.playSession.findMany({ where: { userId, kind: "LEVEL_TEST" }, select: { key: true, score: true, won: true } }).catch(() => []),
    ]);
    const best: Record<string, number> = {};
    const passedIds: string[] = [];
    let kingPasses = 0;
    for (const session of sessions) {
        const id = session.key.replace(/^level:/, "");
        best[id] = Math.max(best[id] ?? 0, session.score);
        if (session.won) {
            if (id === KING_LEVEL.id) kingPasses += 1;
            else passedIds.push(id);
        }
    }
    const progress = levelProgress(passedIds, kingPasses, user?.startLevel ?? null);
    return { currentId: progress.current.id, currentIndex: progress.currentIndex, passed: [...progress.passed], kingPasses, kingRating: progress.kingRating, best };
}
