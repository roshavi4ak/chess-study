export interface PracticeTreeNode {
    id: string;
    fen: string;
    move: string | null;
    notes: string | null;
    lineNumber: number | null;
    children: PracticeTreeNode[];
}
