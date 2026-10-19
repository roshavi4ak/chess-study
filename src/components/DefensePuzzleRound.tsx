"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { equivalentDefense, type DefensePuzzle } from "@/lib/defensePuzzles";
import { copyGame, captureThreats, moveUci } from "@/lib/chessTeaching";
import { learningMove } from "@/lib/puzzleLearning";
import { trainingAnalysis } from "@/lib/trainingEngine";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { orderThemes, themeLabel } from "@/lib/puzzleThemes";
import ProgressiveHint from "./ProgressiveHint";
import TrainingLine from "./TrainingLine";
import TrainingResult from "./TrainingResult";

export default function DefensePuzzleRound({ level, exclude, onAgain, onComplete }: { level: number; exclude: string; onAgain: () => void; onComplete: (ids: string[], stars: number) => void }) {
    const tLevels = useTranslations("DefenseLevels");
    const tDefense = useTranslations("Defense");
    const [puzzles, setPuzzles] = useState<DefensePuzzle[] | null>(null);
    const [error, setError] = useState(false);
    const [index, setIndex] = useState(0);
    const [results, setResults] = useState<boolean[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        void fetch(`/api/training/defense?level=${level}&exclude=${encodeURIComponent(exclude)}`, { signal: controller.signal }).then(async response => {
            if (!response.ok) throw new Error("Defense positions unavailable");
            const data = await response.json();
            if (!Array.isArray(data.puzzles) || data.puzzles.length !== 5) throw new Error("Incomplete round");
            if (!controller.signal.aborted) setPuzzles(data.puzzles);
        }).catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => controller.abort();
    }, [level, exclude]);
    if (error) return <div role="alert" className="space-y-3"><p>{tLevels("loadError")}</p><button type="button" onClick={onAgain} className="underline">{tLevels("retry")}</button></div>;
    if (!puzzles) return <p role="status">{tLevels("loading")}</p>;
    if (index === puzzles.length) return <section className="rounded-2xl bg-green-50 text-green-950 p-6 space-y-4"><h2 className="text-2xl font-bold">{tDefense("roundDone")}</h2><p>{tDefense("summary", { correct: results.filter(Boolean).length, total: results.length })}</p><TrainingResult activityKey={`defense:level:${level}`} score={results.every(Boolean) ? 3 : 1} won details={{ feature: "defense", level, independent: results.filter(Boolean).length, total: results.length, positions: puzzles.map(p => p.id) }} /><button type="button" onClick={onAgain} className="rounded-lg bg-green-600 text-white px-4 py-2 font-bold">{tDefense("newRound")}</button></section>;
    return <section className="space-y-4"><p className="font-bold">{tDefense("progress", { current: index + 1, total: puzzles.length })}</p><DefensePuzzleExercise key={puzzles[index].id} puzzle={puzzles[index]} onDone={independent => {
        const next = [...results, independent];
        setResults(next); setIndex(value => value + 1);
        if (next.length === puzzles.length) onComplete(puzzles.map(p => p.id), next.every(Boolean) ? 3 : 1);
    }} /></section>;
}

function DefensePuzzleExercise({ puzzle, onDone }: { puzzle: DefensePuzzle; onDone: (independent: boolean) => void }) {
    const tPuzzle = useTranslations("DefenseLevels");
    const tDefense = useTranslations("Defense");
    const tThemes = useTranslations("PuzzleCategories");
    const [game, setGame] = useState(() => new Chess(puzzle.fen));
    const [started, setStarted] = useState(false);
    const [cursor, setCursor] = useState(0);
    const [done, setDone] = useState(false);
    const [helped, setHelped] = useState(false);
    const [hint, setHint] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const [alternative, setAlternative] = useState(false);
    const [mistake, setMistake] = useState<{ fen: string; moves: string[] } | null>(null);
    const request = useRef<AbortController | null>(null);
    const locked = useRef(false);
    useEffect(() => () => request.current?.abort(), []);
    const expected = puzzle.moves[cursor];
    const fen = game.fen();
    const orientation = puzzle.side === "w" ? "white" : "black";
    const threats = started && hint > 0 ? captureThreats(fen, puzzle.side) : [];
    function accept(next: Chess, isAlternative = false) {
        setMistake(null); setError(false); setHint(0);
        if (isAlternative || cursor + 1 >= puzzle.moves.length || next.isGameOver()) { setDone(true); setAlternative(isAlternative); }
        else { learningMove(next, puzzle.moves[cursor + 1]); setCursor(value => value + 2); }
        setGame(next);
    }
    async function answer(uci: string) {
        if (!started || done || locked.current) return false;
        const next = copyGame(game);
        let played;
        try { played = learningMove(next, uci); } catch { return false; }
        const move = moveUci(played);
        const reference = copyGame(game);
        const expectedMove = learningMove(reference, expected);
        if (move === moveUci(expectedMove)) { accept(next); return true; }
        locked.current = true; setBusy(true); setError(false); setMistake(null);
        const controller = new AbortController(); request.current = controller;
        try {
            const best = await trainingAnalysis(reference.fen(), controller.signal);
            const candidate = controller.signal.aborted ? null : await trainingAnalysis(next.fen(), controller.signal);
            if (controller.signal.aborted) return false;
            if (!best || !candidate) { setError(true); return false; }
            if (equivalentDefense(best, candidate)) { accept(next, true); return true; }
            setHelped(true);
            setMistake({ fen, moves: [move, ...candidate.pv.slice(0, 5)] });
            return false;
        } catch { if (!controller.signal.aborted) setError(true); return false; }
        finally { if (!controller.signal.aborted) { locked.current = false; setBusy(false); } }
    }
    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({ game, onMove: ({ from, to, promotion }) => answer(from + to + (promotion ?? "")) });
    const last = game.history({ verbose: true }).at(-1);
    const styles: Record<string, React.CSSProperties> = last ? { [last.from]: { backgroundColor: "rgba(250,204,21,.35)" }, [last.to]: { backgroundColor: "rgba(250,204,21,.55)" } } : {};
    if (hint >= 2 && expected) styles[expected.slice(0, 2)] = { backgroundColor: "rgba(250,204,21,.75)" };
    return <div className="space-y-4">
        <div className="rounded-xl bg-indigo-50 text-indigo-950 p-4 space-y-2"><h2 className="font-bold text-xl">{done ? tDefense("correct") : !started ? tDefense("watch") : tPuzzle(game.inCheck() ? "answerCheck" : "findDefense")}</h2><p>{done ? tPuzzle(alternative ? "alternative" : "solved") : tPuzzle(!started ? "watchHelp" : "playHelp")}</p><p className="text-sm font-semibold">{tPuzzle(puzzle.side === "w" ? "playWhite" : "playBlack")}</p></div>
        <div className="space-y-2"><h3 className="font-bold break-words">{puzzle.name} · {tPuzzle("rating", { rating: puzzle.rating })}</h3>{done && <div className="flex flex-wrap gap-2">{orderThemes(puzzle.tags).map(tag => <span key={tag} className="rounded bg-gray-100 text-gray-800 px-2 py-1 text-xs">{themeLabel(tag, tThemes)}</span>)}</div>}</div>
        <div className="max-w-[560px] aspect-square mx-auto"><Chessboard options={{ id: "defense-puzzle-board", position: fen, boardOrientation: orientation, allowDragging: started && !done && !busy, onSquareClick: args => { if (started && !done && !busy) void onSquareClick(args); }, onPieceClick: args => { if (started && !done && !busy) onPieceClick(args); }, onPieceDrop: args => { if (started && !done && !busy) void onPieceDrop(args); return false; }, squareStyles: { ...optionSquares, ...styles }, arrows: hint >= 3 && expected ? [{ startSquare: expected.slice(0, 2), endSquare: expected.slice(2, 4), color: "#4f46e5" }] : [], allowDrawingArrows: false, animationDurationInMs: 300 }} /></div>
        {!started && <button type="button" onClick={() => { const next = copyGame(game); learningMove(next, puzzle.setup); setGame(next); setStarted(true); }} className="rounded-lg bg-indigo-600 text-white px-4 py-3 font-bold">{tDefense("showMove")}</button>}
        {busy && <p role="status">{tPuzzle("checking")}</p>}
        {error && <p role="alert" className="text-amber-800 dark:text-amber-200">{tPuzzle("engineError")}</p>}
        {started && !done && <button type="button" disabled={busy || hint === 3} onClick={() => { setHelped(true); setHint(value => value + 1); }} className="rounded-lg bg-amber-100 text-amber-950 px-4 py-2 disabled:opacity-40">{tPuzzle("hint")}</button>}
        {hint > 0 && !done && <><p>{game.inCheck() ? tPuzzle("checkThreat") : threats.length ? tPuzzle("pieceThreat", { squares: threats.map(threat => threat.square).join(", ") }) : tPuzzle("hiddenThreat")}</p><ProgressiveHint fen={fen} move={expected} stage={hint} /></>}
        {mistake && <><p role="status" className="text-amber-800 dark:text-amber-200">{tPuzzle("weaker")}</p><TrainingLine key={mistake.fen + mistake.moves[0]} fen={mistake.fen} moves={mistake.moves} orientation={orientation} label={tDefense("consequence")} /></>}
        {done && <><p role="status" className="text-green-700 dark:text-green-300">{tDefense(helped ? "learned" : "independent")}</p><button type="button" onClick={() => onDone(!helped)} className="rounded-lg bg-green-600 text-white px-4 py-3 font-bold">{tDefense("next")}</button></>}
    </div>;
}
