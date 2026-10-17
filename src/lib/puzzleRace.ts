// Rules for the club puzzle race and the two-player duel (inspired by Lichess Puzzle Racer):
// everyone gets the same puzzles in the same order; a solved puzzle is 1 point; every COMBO_STEP solved
// puzzles in a row adds a growing bonus; a wrong move empties the combo and moves on; one skip per race.

export const RACE_SECONDS = 90;
export const DUEL_SECONDS = 120;
export const COUNTDOWN_SECONDS = 3;
export const RACE_PUZZLES = 80;
export const MAX_RACERS = 30;
export const COMBO_STEP = 5;
// Answers arriving shortly after the end still count (slow networks).
export const LATE_GRACE_MS = 2000;

export interface RacerState {
    nextIndex: number; // index of the puzzle the racer is on
    score: number;
    solved: number;
    combo: number;
    bonuses: number;
    skipped: boolean;
}

export type RaceEvent = { index: number; result: "solved" | "failed" | "skip" };

export const newRacer = (): RacerState => ({ nextIndex: 0, score: 0, solved: 0, combo: 0, bonuses: 0, skipped: false });

// Returns the new state, or null when the event is not allowed (wrong puzzle, second skip).
export function applyRaceEvent(state: RacerState, event: RaceEvent, puzzleCount: number): RacerState | null {
    if (event.index !== state.nextIndex || event.index >= puzzleCount) return null;
    if (event.result === "skip") {
        if (state.skipped) return null;
        return { ...state, nextIndex: state.nextIndex + 1, skipped: true };
    }
    if (event.result === "failed") return { ...state, nextIndex: state.nextIndex + 1, combo: 0 };
    const combo = state.combo + 1;
    const bonus = combo % COMBO_STEP === 0 ? state.bonuses + 1 : 0;
    return {
        ...state,
        nextIndex: state.nextIndex + 1,
        solved: state.solved + 1,
        combo,
        bonuses: state.bonuses + (bonus ? 1 : 0),
        score: state.score + 1 + bonus,
    };
}

// Progress (0–1) of the combo bar towards the next bonus.
export const comboProgress = (combo: number) => (combo % COMBO_STEP) / COMBO_STEP;

export function rankRacers<T extends { score: number; solved: number; name: string | null }>(racers: T[]): T[] {
    return [...racers].sort((a, b) => b.score - a.score || b.solved - a.solved || (a.name ?? "").localeCompare(b.name ?? ""));
}

export type RacePhase = "waiting" | "countdown" | "running" | "finished";

export function racePhase(race: { startsAt: Date | null; endsAt: Date | null }, now: Date): RacePhase {
    if (!race.startsAt || !race.endsAt) return "waiting";
    if (now < race.startsAt) return "countdown";
    if (now < race.endsAt) return "running";
    return "finished";
}

export function randomRaceCode(random: () => number = Math.random) {
    return String(Math.floor(random() * 9000) + 1000);
}
