export interface PuzzleStats {
    weekly: {
        count: number;
        points: number;
    };
    allTime: {
        count: number;
        points: number;
    };
}

export interface OpeningStats {
    weekly: {
        completed: number;
        perfected: number;
    };
    allTime: {
        completed: number;
        perfected: number;
    };
}

export interface LeaderboardEntry {
    id: string;
    name: string | null;
    image: string | null;
    puzzleStats: PuzzleStats;
    openingStats: OpeningStats;
}
