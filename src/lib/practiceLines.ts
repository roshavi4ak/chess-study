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

export function getAllLeafNodes(node: PracticeNode): PracticeNode[] {
    return node.children.length === 0 ? [node] : node.children.flatMap(getAllLeafNodes);
}

export function hasSeenLine(progress: LineProgress | undefined): boolean {
    return !!progress && progress.status !== "NEVER_SEEN" && progress.attempts > 0;
}

export function getLineCandidates(
    leaves: PracticeNode[],
    progress: Map<string, LineProgress>,
    completed: Set<string>,
    seenOnly: boolean,
) {
    const eligible = seenOnly ? leaves.filter(node => hasSeenLine(progress.get(node.id))) : leaves;
    let remaining = eligible.filter(node => !completed.has(node.id));
    const resetCycle = eligible.length > 0 && remaining.length === 0;
    if (resetCycle) remaining = eligible;

    const unseen = remaining.filter(node => !hasSeenLine(progress.get(node.id)));
    if (unseen.length) {
        unseen.sort((a, b) => (a.lineNumber ?? Infinity) - (b.lineNumber ?? Infinity));
        return { lines: unseen, random: false, resetCycle };
    }
    const notPerfect = remaining.filter(node => progress.get(node.id)?.status !== "PERFECT");
    if (notPerfect.length) {
        notPerfect.sort((a, b) => (progress.get(a.id)?.perfectCount ?? 0) - (progress.get(b.id)?.perfectCount ?? 0));
        return { lines: notPerfect, random: false, resetCycle };
    }
    return { lines: remaining, random: true, resetCycle };
}

export function getAvailableChildren(node: PracticeNode, seenIds: Set<string> | null): PracticeNode[] {
    if (!seenIds) return node.children;
    return node.children.filter(child => getAllLeafNodes(child).some(leaf => seenIds.has(leaf.id)));
}

export function chooseOpponentChild(node: PracticeNode, targetId: string | null, eligibleIds: Set<string>): PracticeNode | undefined {
    const scored = node.children.map(child => {
        const leaves = getAllLeafNodes(child);
        return {
            child,
            target: leaves.some(leaf => leaf.id === targetId),
            score: leaves.filter(leaf => eligibleIds.has(leaf.id)).length,
        };
    }).filter(candidate => candidate.score > 0);
    scored.sort((a, b) => Number(b.target) - Number(a.target) || b.score - a.score);
    return scored[0]?.child;
}
