import { Chess, validateFen } from "chess.js";
import { learningMove } from "./puzzleLearning";

export interface EndgameAdvice { move: string; category: string; dtm: number | null }
const cache = new Map<string, EndgameAdvice>();
const pending = new Map<string, Promise<EndgameAdvice>>();
let queue: Promise<unknown> = Promise.resolve();
let nextProbe = 0;
let cooldownUntil = 0;

export function validTrainingEndgame(fen: string) {
    if (fen.length > 120 || !validateFen(fen).ok || fen.split(" ")[2] !== "-") return false;
    const game = new Chess(fen);
    const pieces = game.board().flat().filter(piece => piece !== null);
    if (pieces.length > 5 || game.isGameOver()) return false;
    const other = game.turn() === "w" ? "b" : "w";
    const king = pieces.find(piece => piece.type === "k" && piece.color === other)!;
    return !game.isAttacked(king.square, game.turn());
}

// Best-first Syzygy moves include the fifty-move rule. One upstream request at a time;
// identical positions share a request. Bounded memory/queue and a rate-limit cooldown.
export function tablebaseMove(fen: string): Promise<string> {
    return tablebaseAdvice(fen).then(advice => advice.move);
}

export function tablebaseAdvice(fen: string): Promise<EndgameAdvice> {
    if (!validTrainingEndgame(fen)) return Promise.reject(new Error("Invalid training endgame"));
    const cached = cache.get(fen);
    if (cached) return Promise.resolve(cached);
    const existing = pending.get(fen);
    if (existing) return existing;
    if (pending.size >= 20 || Date.now() < cooldownUntil) return Promise.reject(new Error("Endgame advisor busy"));
    const task = queue.catch(() => undefined).then(async () => {
        if (Date.now() < cooldownUntil) throw new Error("Endgame advisor cooling down");
        const delay = nextProbe - Date.now();
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        nextProbe = Date.now() + 1100;
        const response = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (response.status === 429) cooldownUntil = Date.now() + 60000;
        if (!response.ok) throw new Error("Endgame advisor unavailable");
        const data = await response.json();
        const move = data.moves?.[0]?.uci;
        if (typeof move !== "string") throw new Error("No endgame move");
        learningMove(new Chess(fen), move);
        if (cache.size >= 512) cache.delete(cache.keys().next().value!);
        const advice: EndgameAdvice = { move, category: typeof data.category === "string" ? data.category : "unknown", dtm: typeof data.dtm === "number" ? data.dtm : null };
        cache.set(fen, advice);
        return advice;
    });
    queue = task;
    pending.set(fen, task);
    void task.finally(() => pending.delete(fen)).catch(() => undefined);
    return task;
}
