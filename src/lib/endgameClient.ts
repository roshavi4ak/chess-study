import { Chess } from "chess.js";
import { learningMove } from "./puzzleLearning";
import type { EndgameAdvice } from "./endgameTablebase";

export async function endgameMove(fen: string, signal: AbortSignal): Promise<string | null> {
    return (await endgameAdvice(fen, signal))?.move ?? null;
}

export async function endgameAdvice(fen: string, signal: AbortSignal): Promise<EndgameAdvice | null> {
    try {
        const timeout = AbortSignal.any([signal, AbortSignal.timeout(20000)]);
        const response = await fetch(`/api/training/endgame?fen=${encodeURIComponent(fen)}`, { signal: timeout });
        if (!response.ok) return null;
        const data = await response.json();
        if (typeof data.move !== "string" || signal.aborted) return null;
        learningMove(new Chess(fen), data.move);
        return { move: data.move, category: typeof data.category === "string" ? data.category : "unknown", dtm: typeof data.dtm === "number" ? data.dtm : null };
    } catch { return null; }
}
