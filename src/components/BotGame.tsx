"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { Flag, RotateCcw, Undo2 } from "lucide-react";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { chooseBotMove } from "@/lib/botEngine";
import { getAvatarPath } from "@/lib/avatars";
import { trainingMove } from "@/lib/trainingEngine";
import { captureThreats, coachingGoals, coachingHint, coachingPraise, copyGame, moveWarning } from "@/lib/chessTeaching";
import ProgressiveHint from "./ProgressiveHint";
import TrainingLine from "./TrainingLine";
import type { BotProfile } from "@/lib/bots";

export type BotGameResult = "win" | "loss" | "draw";
type Line = "Greeting" | "Capture" | "Check" | "BotWins" | "ChildWins" | "Draw";

const MIN_THINK_MS = 600;

async function pickMove(bot: BotProfile, fen: string, signal: AbortSignal) {
    if (bot.stockfish && Math.random() >= bot.policy.randomChance) {
        const engineMove = await trainingMove(fen, signal, bot.stockfish.depth, 8000, bot.stockfish.skill);
        if (engineMove) return engineMove;
    }
    return chooseBotMove(fen, bot.policy);
}

export default function BotGame({ bot, childColor, onFinish, initialTeaching = true }: { bot: BotProfile; childColor: "w" | "b"; onFinish: (result: BotGameResult, moves: number, teaching: boolean) => void; initialTeaching?: boolean }) {
    const t = useTranslations("Bots");
    const tCoach = useTranslations("BotTeaching");
    const tPieces = useTranslations("LearningHelp");
    const [game, setGame] = useState(() => new Chess());
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [line, setLine] = useState<Line>("Greeting");
    const [thinking, setThinking] = useState(false);
    const [result, setResult] = useState<BotGameResult | null>(null);
    const finished = useRef(false);
    const locked = useRef(false);
    const [teaching, setTeaching] = useState(initialTeaching);
    const teachingUsed = useRef(initialTeaching);
    const [identifiedFen, setIdentifiedFen] = useState("");
    const [wrongPiece, setWrongPiece] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [hintStage, setHintStage] = useState(0);
    const [pending, setPending] = useState<{ move: string; warning: NonNullable<ReturnType<typeof moveWarning>> } | null>(null);
    const botColor = childColor === "w" ? "b" : "w";
    const yourTurn = !result && !thinking && game.turn() === childColor;
    const threats = useMemo(() => teaching && yourTurn ? captureThreats(game.fen(), childColor) : [], [teaching, yourTurn, game, childColor]);
    const threat = threats[0];
    const needsIdentify = !!(threat && !game.inCheck() && identifiedFen !== game.fen());
    const hint = useMemo(() => teaching && hintStage > 0 && yourTurn && !pending ? coachingHint(game.fen()) : null, [teaching, hintStage, yourTurn, pending, game]);
    const goals = coachingGoals(game.history({ verbose: true }), childColor);

    function end(outcome: BotGameResult, finalGame: Chess) {
        if (finished.current) return;
        finished.current = true;
        setResult(outcome);
        setLine(outcome === "win" ? "ChildWins" : outcome === "loss" ? "BotWins" : "Draw");
        onFinish(outcome, finalGame.history().length, teachingUsed.current);
    }

    function checkEnd(next: Chess) {
        if (!next.isGameOver()) return false;
        if (next.isCheckmate()) end(next.turn() === childColor ? "loss" : "win", next);
        else end("draw", next);
        return true;
    }

    // The bot moves whenever it is its turn.
    useEffect(() => {
        if (finished.current || game.turn() !== botColor) return;
        let cancelled = false;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const started = Date.now();
        // Shows the thinking bubble while the bot works out its move.
        setThinking(true);
        void pickMove(bot, game.fen(), controller.signal).then(move => {
            if (cancelled || finished.current || !move) return;
            timer = setTimeout(() => {
                if (cancelled || finished.current) return;
                const next = copyGame(game);
                const played = next.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
                setGame(next);
                setLastMove({ from: played.from, to: played.to });
                setThinking(false);
                locked.current = false;
                if (!checkEnd(next)) {
                    if (next.inCheck()) setLine("Check");
                    else if (played.captured) setLine("Capture");
                }
            }, Math.max(0, MIN_THINK_MS - (Date.now() - started)));
        });
        return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
        // checkEnd only reads refs and stable values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game, bot, botColor, result]);

    function handleMove({ from, to, promotion }: { from: string; to: string; promotion?: string }) {
        if (finished.current || thinking || locked.current || pending || needsIdentify || game.turn() !== childColor) return false;
        const next = copyGame(game);
        try {
            const played = next.move({ from, to, promotion: promotion ?? "q" });
            const uci = played.from + played.to + (played.promotion ?? "");
            const warning = teaching ? moveWarning(game.fen(), uci) : null;
            if (warning) { locked.current = true; setPending({ move: uci, warning }); setHintStage(0); return false; }
            commit(next, played.from, played.to, uci);
            return true;
        } catch {
            return false;
        }
    }

    function commit(next: Chess, from: string, to: string, uci: string) {
        locked.current = true;
        if (teaching) setFeedback(coachingPraise(game.fen(), uci));
        setGame(next); setLastMove({ from, to }); setPending(null); setHintStage(0); setWrongPiece(false);
        if (!checkEnd(next)) setThinking(true);
    }

    function takeback() {
        if (finished.current || thinking) return;
        const next = new Chess();
        const history = game.history({ verbose: true });
        // Undo the bot's reply and the child's move, so it is the child's turn again.
        const keep = history.length - (game.turn() === childColor ? 2 : 1);
        history.slice(0, Math.max(0, keep)).forEach(move => next.move(move));
        setGame(next);
        setLastMove(null);
        setPending(null); setHintStage(0); setFeedback(null); setWrongPiece(false); locked.current = false;
    }

    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({ game, onMove: handleMove });
    const highlights: Record<string, React.CSSProperties> = lastMove ? {
        [lastMove.from]: { backgroundColor: "rgba(255, 255, 0, 0.35)" },
        [lastMove.to]: { backgroundColor: "rgba(255, 255, 0, 0.55)" },
    } : {};
    if (teaching && threat && identifiedFen === game.fen()) highlights[threat.square] = { backgroundColor: "rgba(239,68,68,.4)" };
    if (hint && hintStage >= 2) highlights[hint.move.slice(0, 2)] = { backgroundColor: "rgba(250,204,21,.7)" };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
                <div className="flex items-start gap-3">
                    <Image src={getAvatarPath(bot.avatar)} alt="" width={64} height={64} className="h-16 w-16 rounded-full bg-white ring-2 ring-orange-300 object-contain p-1 shrink-0" />
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none shadow px-4 py-3 text-gray-900 dark:text-white">
                        <p className="font-bold text-sm text-orange-600 dark:text-orange-400">{t(`${bot.id}Name`)}</p>
                        <p>{thinking ? t("thinking") : t(`${bot.id}${line}`)}</p>
                        {teaching && yourTurn && <p role="status" className="mt-2 font-semibold text-indigo-700 dark:text-indigo-200">{tCoach(pending ? "pauseBeforeMove" : game.inCheck() ? "escapeCheck" : needsIdentify ? "identifyThreat" : threat ? "defendClue" : "thinkClue")}</p>}
                        {wrongPiece && <p role="status" className="mt-1 text-amber-700 dark:text-amber-200">{tCoach("wrongPiece")}</p>}
                    </div>
                </div>
                <div className="w-full max-w-[600px] aspect-square rounded-lg overflow-hidden border-4 border-gray-800">
                    <Chessboard
                        options={{
                            id: "bot-game",
                            position: game.fen(),
                            boardOrientation: childColor === "w" ? "white" : "black",
                            onPieceDrop: (args) => { void onPieceDrop(args); return false; },
                            onSquareClick: args => {
                                if (!yourTurn || pending) return;
                                if (needsIdentify) { if (args.square === threat?.square) { setIdentifiedFen(game.fen()); setWrongPiece(false); } else setWrongPiece(true); }
                                else void onSquareClick(args);
                            },
                            onPieceClick: args => { if (yourTurn && !needsIdentify && !pending) onPieceClick(args); },
                            squareStyles: { ...highlights, ...optionSquares },
                            allowDragging: yourTurn && !needsIdentify && !pending,
                            arrows: hint && hintStage >= 3 ? [{ startSquare: hint.move.slice(0, 2), endSquare: hint.move.slice(2, 4), color: "#4f46e5" }] : [],
                            animationDurationInMs: 200,
                        }}
                    />
                </div>
            </div>
            <div className="space-y-3">
                {!result && <div className="rounded-xl border border-indigo-200 bg-white dark:bg-gray-800 p-4 space-y-3">
                    <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={teaching} onChange={event => { setTeaching(event.target.checked); if (event.target.checked) teachingUsed.current = true; setPending(null); setHintStage(0); setWrongPiece(false); if (!thinking) locked.current = false; }} />{tCoach("enabled")}</label>
                    {teaching && <>
                        <p className="text-sm">{tCoach("intro")}</p>
                        {needsIdentify && <button type="button" onClick={() => { setIdentifiedFen(game.fen()); setWrongPiece(false); }} className="text-sm underline">{tCoach("showThreat")}</button>}
                        {threat && !needsIdentify && <p>{tCoach("threatNamed", { piece: tPieces(`piece_${threat.piece}`), square: threat.square })}</p>}
                        {feedback && <p role="status" className="text-green-700 dark:text-green-300">{tCoach(feedback)}</p>}
                        <ul className="text-sm space-y-1"><li>{goals.developed ? "✓" : "○"} {tCoach("developGoal")}</li><li>{goals.castled ? "✓" : "○"} {tCoach("castleGoal")}</li></ul>
                        {yourTurn && !pending && !needsIdentify && hintStage < 3 && <button type="button" onClick={() => setHintStage(value => value + 1)} className="rounded-lg bg-amber-100 text-amber-950 px-3 py-2">{tCoach("hint")}</button>}
                        {hint && <><p>{tCoach(hint.clue)}</p><ProgressiveHint fen={game.fen()} move={hint.move} stage={hintStage} /></>}
                        {hintStage > 0 && !hint && yourTurn && !pending && <p>{tCoach("thinkClue")}</p>}
                    </>}
                </div>}
                {pending && <div className="rounded-xl bg-amber-50 text-amber-950 p-4 space-y-3">
                    <p className="font-semibold">{tCoach(pending.warning.kind === "mate" ? "mateWarning" : "materialWarning", { piece: tPieces(`piece_${pending.warning.piece}`), square: pending.warning.square })}</p>
                    <TrainingLine key={pending.move} fen={game.fen()} moves={[pending.move, pending.warning.reply]} orientation={childColor === "w" ? "white" : "black"} label={tCoach("showConsequence")} />
                    <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-indigo-600 text-white px-3 py-2" onClick={() => { setPending(null); locked.current = false; }}>{tCoach("tryAnother")}</button><button type="button" className="underline text-sm" onClick={() => { const next = copyGame(game); const played = next.move({ from: pending.move.slice(0, 2), to: pending.move.slice(2, 4), promotion: pending.move[4] }); commit(next, played.from, played.to, pending.move); }}>{tCoach("playAnyway")}</button></div>
                </div>}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center space-y-3">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {result === "win" ? `🏆 ${t("youWon")}` : result === "loss" ? t("youLost") : result === "draw" ? t("draw") : yourTurn ? t("yourTurn") : t("botTurn")}
                    </p>
                    {!result && (
                        <div className="flex flex-wrap gap-2 justify-center">
                            {(bot.takebacks || teaching) && (
                                <button type="button" onClick={takeback} disabled={thinking || game.history().length < 1}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium disabled:opacity-40">
                                    <Undo2 className="h-4 w-4" /> {t("takeback")}
                                </button>
                            )}
                            <button type="button" onClick={() => end("loss", game)}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium">
                                <Flag className="h-4 w-4" /> {t("resign")}
                            </button>
                        </div>
                    )}
                    {result && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 inline-flex items-center gap-1"><RotateCcw className="h-4 w-4" /> {t("playAgainHint")}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
