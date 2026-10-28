"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { ENDGAMES, randomEndgameFen, endgameOutcome, type Endgame } from "@/lib/endgameTraining";
import { copyGame } from "@/lib/chessTeaching";
import { learningMove } from "@/lib/puzzleLearning";
import { endgameMove, endgameAdvice } from "@/lib/endgameClient";
import type { EndgameAdvice } from "@/lib/endgameTablebase";
import { endgameHintContext } from "@/lib/endgameHints";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import EndgameHint from "./EndgameHint";
import EndgameTutorial from "./EndgameTutorial";
import TrainingResult from "./TrainingResult";
import ReadAloud from "./ReadAloud";
import { ChessnutSession } from "./ChessnutSession";
import { useActivityChessnut } from "@/hooks/useActivityChessnut";
import ActivityBoardPanel from "./ActivityBoardPanel";

export default function EndgameTrainer({ initialFen = ENDGAMES[0].fen }: { initialFen?: string }) {
    return <ChessnutSession><EndgameTrainerContent initialFen={initialFen} /></ChessnutSession>;
}

function EndgameTrainerContent({ initialFen }: { initialFen: string }) {
    const t = useTranslations("Endgames");
    const tLesson = useTranslations("EndgameLessons");
    const [selection, setSelection] = useState<{ challenge: Endgame; fen: string; round: number }>({ challenge: ENDGAMES[0], fen: initialFen, round: 0 });
    const [mode, setMode] = useState<"learn" | "practice">("learn");
    const [started, setStarted] = useState(false);
    const [lessonHelp, setLessonHelp] = useState(false);
    function choose(challenge: Endgame, learn = false) {
        setSelection(previous => ({ challenge, fen: randomEndgameFen(challenge, previous.fen), round: previous.round + 1 }));
        setMode(learn ? "learn" : "practice"); setStarted(!learn); setLessonHelp(false);
    }
    function learn() { if (started && mode === "practice") setLessonHelp(true); setMode("learn"); }
    function practise() { setStarted(true); setMode("practice"); }
    return <div className="space-y-5">
        <div className="flex flex-wrap gap-2">{ENDGAMES.map(item => <button key={item.id} type="button" aria-pressed={selection.challenge.id === item.id} onClick={() => choose(item, true)} className={`rounded-xl px-4 py-3 text-left font-bold ${item.id === selection.challenge.id ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"}`}>{t(`${item.id}.title`)}</button>)}</div>
        <div className="flex flex-wrap gap-2" aria-label={tLesson("chooseMode")}><button type="button" aria-pressed={mode === "learn"} onClick={learn} className={`rounded-xl px-4 py-3 font-bold ${mode === "learn" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{tLesson("learn")}</button><button type="button" aria-pressed={mode === "practice"} onClick={practise} className={`rounded-xl px-4 py-3 font-bold ${mode === "practice" ? "bg-green-700 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{tLesson("try")}</button></div>
        {mode === "learn" && <EndgameTutorial key={selection.challenge.id} id={selection.challenge.id} onPractice={practise} />}
        {started && <div hidden={mode !== "practice"}><EndgameSession key={selection.round} challenge={selection.challenge} initialFen={selection.fen} active={mode === "practice"} lessonHelp={lessonHelp} onRestart={() => choose(selection.challenge)} onNew={() => choose(selection.challenge)} onLearn={learn} /></div>}
    </div>;
}

function EndgameSession({ challenge, initialFen, active, lessonHelp, onRestart, onNew, onLearn }: { challenge: Endgame; initialFen: string; active: boolean; lessonHelp: boolean; onRestart: () => void; onNew: () => void; onLearn: () => void }) {
    const t = useTranslations("Endgames");
    const tTraining = useTranslations("Training");
    const tLesson = useTranslations("EndgameLessons");
    const [game, setGame] = useState(() => new Chess(initialFen));
    const [outcome, setOutcome] = useState<ReturnType<typeof endgameOutcome>>(null);
    const [thinking, setThinking] = useState(false);
    const [engineError, setEngineError] = useState(false);
    const [engineRetry, setEngineRetry] = useState(0);
    const [helpUsed, setAssisted] = useState(false);
    const [outcomeHelp, setOutcomeHelp] = useState<boolean | null>(null);
    const assisted = outcomeHelp ?? (helpUsed || lessonHelp);
    const [hint, setHint] = useState<{ fen: string; advice: EndgameAdvice; stage: number } | null>(null);
    const [hintBusy, setHintBusy] = useState(false);
    const locked = useRef(false);
    const hintRequest = useRef<AbortController | null>(null);
    const fen = game.fen();
    const side = "w";
    const yourTurn = active && game.turn() === side && !outcome && !hintBusy;
    const last = game.history({ verbose: true }).at(-1);
    const boardReply = last?.color === "b" ? last.from + last.to + (last.promotion ?? "") : undefined;
    const board = useActivityChessnut({
        fen, active, canMove: !!yourTurn && !thinking,
        onMove: move => handleMove(move, true), syncMove: boardReply,
        hintMove: hint && hint.stage >= 3 ? hint.advice.move : undefined,
        completion: outcome ? `${outcome}:${fen}` : undefined,
    });

    useEffect(() => () => hintRequest.current?.abort(), [active]);
    useEffect(() => {
        if (!active || game.turn() === side || outcome || !board.ready) return;
        const controller = new AbortController();
        void endgameMove(fen, controller.signal).then(move => {
            if (controller.signal.aborted) return;
            setThinking(false);
            if (!move) { setEngineError(true); locked.current = false; return; }
            const next = copyGame(game);
            learningMove(next, move);
            setGame(next);
            const result = endgameOutcome(next, challenge.goal, side);
            setOutcome(result);
            if (result) setOutcomeHelp(assisted);
            locked.current = false;
        });
        return () => controller.abort();
    }, [fen, game, challenge.goal, outcome, engineRetry, active, assisted, board.ready]);

    function handleMove({ from, to, promotion }: { from: string; to: string; promotion?: string }, physical = false) {
        if (board.enabled && !physical) return false;
        if (!yourTurn || locked.current) return false;
        try {
            const next = copyGame(game);
            next.move({ from, to, promotion: promotion ?? "q" });
            locked.current = true;
            setHint(null);
            setEngineError(false);
            setGame(next);
            const result = endgameOutcome(next, challenge.goal, side);
            setOutcome(result);
            if (result) setOutcomeHelp(assisted);
            setThinking(!result && next.turn() !== side);
            return true;
        } catch { return false; }
    }
    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({ game, onMove: handleMove });

    function undo() {
        board.reset();
        hintRequest.current?.abort();
        const next = copyGame(game);
        next.undo();
        if (next.turn() !== side && next.history().length) next.undo();
        setGame(next); setThinking(false); setHintBusy(false); setEngineError(false); setHint(null); setAssisted(true); locked.current = false;
    }
    async function askHint() {
        if (!yourTurn || locked.current) return;
        if (hint?.fen === fen) { setHint({ ...hint, stage: Math.min(3, hint.stage + 1) }); return; }
        const controller = new AbortController();
        hintRequest.current?.abort(); hintRequest.current = controller;
        setHintBusy(true); locked.current = true;
        try {
            const advice = await endgameAdvice(fen, controller.signal);
            if (controller.signal.aborted) return;
            if (advice) { setHint({ fen, advice, stage: 1 }); setAssisted(true); } else setEngineError(true);
        } finally {
            if (hintRequest.current === controller) { setHintBusy(false); locked.current = false; }
        }
    }
    const styles: Record<string, React.CSSProperties> = last ? { [last.from]: { backgroundColor: "rgba(250,204,21,.4)" }, [last.to]: { backgroundColor: "rgba(250,204,21,.6)" } } : {};
    const hintContext = hint ? endgameHintContext(challenge.id, hint.fen, hint.advice.move) : null;
    if (hintContext) hintContext.focus.forEach(square => { styles[square] = { backgroundColor: "rgba(14,165,233,.35)" }; });
    if (hint && hint.stage >= 2) styles[hint.advice.move.slice(0, 2)] = { backgroundColor: "rgba(250,204,21,.7)" };
    return <section className="space-y-4">
        <ActivityBoardPanel board={board} reply={boardReply} />
        <div className="rounded-xl bg-indigo-50 text-indigo-950 p-4 space-y-2"><h2 className="font-bold text-xl">{t(`${challenge.id}.title`)}</h2><p>{t(`${challenge.id}.instruction`)}</p><ReadAloud text={t(`${challenge.id}.instruction`)} /><p className="text-sm">{tTraining("unrated")}</p></div>
        <details className="rounded-xl border border-indigo-200 p-3"><summary className="font-bold cursor-pointer">{tLesson("checklist")}</summary><ol className="list-decimal pl-5 mt-2 space-y-1">{[1, 2, 3].map(number => <li key={number}>{tLesson(`${challenge.id}.check${number}`)}</li>)}</ol><button type="button" onClick={onLearn} className="mt-3 underline text-indigo-600 dark:text-indigo-300">{tLesson("review")}</button></details>
        <div className="max-w-[560px] mx-auto aspect-square"><Chessboard options={{ id: "endgame-board", position: fen, boardOrientation: "white", allowDragging: !board.enabled && yourTurn && !thinking, onSquareClick: args => { if (!board.enabled && yourTurn) void onSquareClick(args); }, onPieceClick: args => { if (!board.enabled && yourTurn) onPieceClick(args); }, onPieceDrop: args => { if (!board.enabled && yourTurn) void onPieceDrop(args); return false; }, squareStyles: { ...optionSquares, ...styles }, arrows: hint && hint.stage >= 3 ? [{ startSquare: hint.advice.move.slice(0, 2), endSquare: hint.advice.move.slice(2, 4), color: "#4f46e5" }] : [], allowDrawingArrows: false, animationDurationInMs: 200 }} /></div>
        <p role="status" className="font-bold">{outcome ? t(`outcome_${outcome}`) : thinking || hintBusy ? t("thinking") : game.turn() === side ? t("yourTurn") : t("computerTurn")}</p>
        {hint && <EndgameHint id={challenge.id} fen={hint.fen} advice={hint.advice} stage={hint.stage} />}
        {engineError && <div role="alert" className="rounded-lg bg-amber-50 text-amber-950 p-3 space-y-2"><p>{t("engineError")}</p>{game.turn() !== side && <button type="button" onClick={() => { setEngineError(false); setThinking(true); setEngineRetry(value => value + 1); }} className="underline">{t("retryComputer")}</button>}</div>}
        {!outcome && <div className="flex flex-wrap gap-2"><button type="button" disabled={!yourTurn || hintBusy || hint?.stage === 3} onClick={() => void askHint()} className="rounded-lg bg-amber-100 text-amber-950 px-4 py-2 disabled:opacity-40">{t("hint")}</button><button type="button" disabled={!game.history().length || hintBusy} onClick={undo} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 disabled:opacity-40">{t("takeback")}</button></div>}
        {outcome && board.ready && <div className={`rounded-xl p-4 space-y-3 ${outcome === "won" ? "bg-green-50 text-green-950" : "bg-amber-50 text-amber-950"}`}><p>{t(outcome === "stalemate" ? "stalemateHelp" : outcome === "won" ? assisted ? "wonWithHelp" : "wonAlone" : "tryAgainHelp")}</p><TrainingResult activityKey={`endgame:${challenge.id}`} score={outcome === "won" ? assisted ? 1 : 3 : 0} won={outcome === "won"} details={{ feature: "endgame", challenge: challenge.id, assisted, moves: game.history().length }} /></div>}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={outcome ? onNew : onRestart} className="rounded-lg bg-indigo-600 text-white px-4 py-2">{t(outcome ? "newPosition" : "restart")}</button></div>
        {last && <p className="text-sm text-gray-500 dark:text-gray-400">{t("lastMove", { move: last.san })}</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("verifiedStarts")} · <a href="https://tablebase.lichess.ovh/" target="_blank" rel="noreferrer" className="underline">Lichess / Syzygy</a></p>
    </section>;
}
