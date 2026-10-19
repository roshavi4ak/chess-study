import { Chess } from "chess.js";
import { learningMove } from "./puzzleLearning";
import type { TrainingEvaluation } from "./defensePuzzles";

// Dedicated, cancellable workers prevent hints, restarts and bot games sharing a stale bestmove.
export function trainingMove(fen: string, signal: AbortSignal, depth = 10, timeoutMs = 10000, skill = 20): Promise<string | null> {
    return engineRequest(fen, signal, depth, timeoutMs, skill).then(result => result?.move ?? null);
}

export function trainingAnalysis(fen: string, signal: AbortSignal, depth = 14, timeoutMs = 20000): Promise<TrainingEvaluation | null> {
    const game = new Chess(fen);
    if (game.isGameOver()) return Promise.resolve({ score: { type: game.isCheckmate() ? "mate" : "cp", value: game.isCheckmate() ? -1 : 0 }, pv: [] });
    return engineRequest(fen, signal, depth, timeoutMs, 20).then(result => result?.evaluation ?? null);
}

function engineRequest(fen: string, signal: AbortSignal, depth: number, timeoutMs: number, skill: number): Promise<{ move: string; evaluation: TrainingEvaluation | null } | null> {
    return new Promise(resolve => {
        if (signal.aborted) { resolve(null); return; }
        let worker: Worker | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let settled = false;
        let evaluation: TrainingEvaluation | null = null;
        const finish = (move: string | null) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
            resolve(move ? { move, evaluation } : null);
        };
        const abort = () => finish(null);
        try {
            const game = new Chess(fen);
            if (game.isGameOver()) { finish(null); return; }
            worker = new Worker("/stockfish.js");
            signal.addEventListener("abort", abort, { once: true });
            timer = setTimeout(() => finish(null), timeoutMs);
            worker.onerror = () => finish(null);
            worker.onmessage = event => {
                if (typeof event.data !== "string") return;
                if (event.data === "uciok") {
                    worker?.postMessage(`setoption name Skill Level value ${Math.max(0, Math.min(20, skill))}`);
                    worker?.postMessage("isready");
                } else if (event.data === "readyok") {
                    worker?.postMessage(`position fen ${fen}`);
                    worker?.postMessage(`go depth ${depth}`);
                } else if (event.data.startsWith("bestmove ")) {
                    const move = event.data.split(" ")[1];
                    try { learningMove(new Chess(fen), move); finish(move); } catch { finish(null); }
                } else if (event.data.startsWith("info ") && !/\b(?:lowerbound|upperbound)\b/.test(event.data)) {
                    const score = event.data.match(/\bscore (cp|mate) (-?\d+)/);
                    const pv = event.data.match(/\bpv (.+)$/);
                    if (score && pv) {
                        try {
                            const line = pv[1].trim().split(/\s+/);
                            const board = new Chess(fen);
                            line.forEach(move => learningMove(board, move));
                            evaluation = { score: { type: score[1] as "cp" | "mate", value: Number(score[2]) }, pv: line };
                        } catch { /* An incomplete engine line is not evidence for accepting a defense. */ }
                    }
                }
            };
            worker.postMessage("uci");
        } catch { finish(null); }
    });
}
