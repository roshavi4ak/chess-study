import { REVIEW_INTERVALS, getLineReviewState, isLineMastered, sofiaDay, type AttemptStatus } from "./reviewSchedule";

export interface PracticeNode {
    id: string;
    fen: string;
    move: string | null;
    notes: string | null;
    lineNumber: number | null;
    children: PracticeNode[];
}

export interface LineProgress {
    nodeId: string;
    status: "PERFECT" | "COMPLETED" | "PARTIAL" | "NEVER_SEEN";
    attempts: number;
    perfectCount: number;
}

export interface LineAttemptRecord {
    nodeId: string;
    status: AttemptStatus;
    createdAt: Date;
}

// How many other lines must be played before a line played today comes back.
export const RETRY_AFTER_MISTAKES = 2;
export const REPEAT_AFTER_PERFECT = 4;

export function getAllLeafNodes(node: PracticeNode): PracticeNode[] {
    return node.children.length === 0 ? [node] : node.children.flatMap(getAllLeafNodes);
}

export function hasSeenLine(progress: LineProgress | undefined): boolean {
    return !!progress && progress.status !== "NEVER_SEEN" && progress.attempts > 0;
}

export interface LinePickContext {
    seenIds: Set<string>;
    // This practice's attempt history, in any order.
    attempts: LineAttemptRecord[];
    seenOnly: boolean;
    now: Date;
    random?: () => number;
}

interface Candidate {
    node: PracticeNode;
    tier: number;
    // Lines played since this one today; Infinity when it was not played today.
    playedSince: number;
    ready: boolean;
    // Days since the last run divided by the line's review interval; 1 or more means due.
    overdue: number;
    tiebreak: number;
}

const Tier = { Retry: 0, TowardMastery: 1, New: 2, Due: 3, Learning: 4, Mastered: 5 } as const;

function daysBetween(from: string, to: string): number {
    return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function weightedPick(candidates: Candidate[], random: () => number): Candidate {
    // Lines closer to their review day come up more often, but every line keeps a chance.
    const weights = candidates.map(candidate => candidate.overdue + 0.1);
    let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < candidates.length; index++) {
        roll -= weights[index];
        if (roll < 0) return candidates[index];
    }
    return candidates[candidates.length - 1];
}

/**
 * Picks the next line to practice, in this order:
 * 1. lines with mistakes today, after a couple of other lines (a quick retry fixes the memory);
 * 2. lines played perfectly today but not mastered yet, after a few other lines;
 * 3. new lines, by line number (never in seen-only mode);
 * 4. lines due for review, the most overdue first;
 * 5. other lines still being learned, then mastered lines, at random weighted by how close they are to due.
 * A line played today waits its turn; only when every line is waiting does the longest-waiting one come back.
 */
export function pickNextLine(leaves: PracticeNode[], context: LinePickContext): PracticeNode | undefined {
    const { seenIds, seenOnly, now, random = Math.random } = context;
    const today = sofiaDay(now);
    const finished = context.attempts
        .filter(attempt => attempt.status === "PERFECT" || attempt.status === "COMPLETED")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const history = new Map<string, LineAttemptRecord[]>();
    for (const attempt of finished) history.set(attempt.nodeId, [...history.get(attempt.nodeId) ?? [], attempt]);
    const todayOrder = finished.filter(attempt => sofiaDay(attempt.createdAt) === today);

    const candidates = leaves.filter(node => !seenOnly || seenIds.has(node.id)).map((node): Candidate => {
        const runs = history.get(node.id) ?? [];
        const lastIndex = todayOrder.findLastIndex(attempt => attempt.nodeId === node.id);
        const lastToday = lastIndex === -1 ? null : todayOrder[lastIndex];
        const playedSince = lastToday ? todayOrder.length - 1 - lastIndex : Infinity;
        const wait = lastToday?.status === "PERFECT" ? REPEAT_AFTER_PERFECT : RETRY_AFTER_MISTAKES;
        const state = getLineReviewState(runs);
        const mastered = isLineMastered(runs);
        // A seen line without saved runs (older data) is treated as just due.
        const overdue = state ? daysBetween(state.lastDay, today) / REVIEW_INTERVALS[state.level] : 1;
        const tier = lastToday?.status === "COMPLETED" ? Tier.Retry
            : lastToday && !mastered ? Tier.TowardMastery
                : !seenIds.has(node.id) && !runs.length ? Tier.New
                    : overdue >= 1 ? Tier.Due
                        : mastered ? Tier.Mastered : Tier.Learning;
        return { node, tier, playedSince, ready: playedSince >= wait, overdue, tiebreak: random() };
    });
    if (!candidates.length) return undefined;

    const ready = candidates.filter(candidate => candidate.ready);
    if (!ready.length) return candidates.reduce((best, candidate) => candidate.playedSince > best.playedSince ? candidate : best).node;

    const tier = Math.min(...ready.map(candidate => candidate.tier));
    const inTier = ready.filter(candidate => candidate.tier === tier);
    if (tier === Tier.Learning || tier === Tier.Mastered) return weightedPick(inTier, random).node;
    inTier.sort((a, b) => {
        if (tier === Tier.New) return (a.node.lineNumber ?? Infinity) - (b.node.lineNumber ?? Infinity);
        if (tier === Tier.Due) return b.overdue - a.overdue || a.tiebreak - b.tiebreak;
        return b.playedSince - a.playedSince || a.tiebreak - b.tiebreak;
    });
    return inTier[0].node;
}

export function getAvailableChildren(node: PracticeNode, seenIds: Set<string> | null): PracticeNode[] {
    if (!seenIds) return node.children;
    return node.children.filter(child => getAllLeafNodes(child).some(leaf => seenIds.has(leaf.id)));
}

// The opponent steers toward the target line, or toward the preferred line when the student left the target's branch.
export function chooseOpponentChild(node: PracticeNode, targetId: string | null, preferredId: string | null): PracticeNode | undefined {
    const leadsTo = (id: string | null) => node.children.find(child => getAllLeafNodes(child).some(leaf => leaf.id === id));
    return leadsTo(targetId) ?? leadsTo(preferredId);
}
