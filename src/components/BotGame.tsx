"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { Flag, RotateCcw, Undo2 } from "lucide-react";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { chooseBotMove } from "@/lib/botEngine";
import { getAvatarPath } from "@/lib/avatars";
import { requestBotMove } from "@/lib/stockfishWorker";
import type { BotProfile } from "@/lib/bots";

export type BotGameResult = "win" | "loss" | "draw";
type Line = "Greeting" | "Capture" | "Check" | "BotWins" | "ChildWins" | "Draw";

const MIN_THINK_MS = 600;

async function pickMove(bot: BotProfile, fen: string) {
    if (bot.stockfish && Math.random() >= bot.policy.randomChance) {
        const engineMove = await requestBotMove(fen, bot.stockfish);
        if (engineMove) return engineMove;
    }
    return chooseBotMove(fen, bot.policy);
}

export default function BotGame({ bot, childColor, onFinish }: { bot: BotProfile; childColor: "w" | "b"; onFinish: (result: BotGameResult, moves: number) => void }) {
    const t = useTranslations("Bots");
    const [game, setGame] = useState(() => new Chess());
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [line, setLine] = useState<Line>("Greeting");
    const [thinking, setThinking] = useState(false);
    const [result, setResult] = useState<BotGameResult | null>(null);
    const finished = useRef(false);
    const botColor = childColor === "w" ? "b" : "w";

    function end(outcome: BotGameResult, finalGame: Chess) {
        if (finished.current) return;
        finished.current = true;
        setResult(outcome);
        setLine(outcome === "win" ? "ChildWins" : outcome === "loss" ? "BotWins" : "Draw");
        onFinish(outcome, finalGame.history().length);
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
        const started = Date.now();
        // Shows the thinking bubble while the bot works out its move.
        setThinking(true);
        void pickMove(bot, game.fen()).then(move => {
            if (cancelled || !move) return;
            setTimeout(() => {
                if (cancelled) return;
                const next = new Chess(game.fen());
                const played = next.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
                setGame(next);
                setLastMove({ from: played.from, to: played.to });
                setThinking(false);
                if (!checkEnd(next)) {
                    if (next.inCheck()) setLine("Check");
                    else if (played.captured) setLine("Capture");
                }
            }, Math.max(0, MIN_THINK_MS - (Date.now() - started)));
        });
        return () => { cancelled = true; };
        // checkEnd only reads refs and stable values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game, bot, botColor]);

    function handleMove({ from, to, promotion }: { from: string; to: string; promotion?: string }) {
        if (finished.current || thinking || game.turn() !== childColor) return false;
        const next = new Chess(game.fen());
        try {
            const played = next.move({ from, to, promotion: promotion ?? "q" });
            setGame(next);
            setLastMove({ from: played.from, to: played.to });
            checkEnd(next);
            return true;
        } catch {
            return false;
        }
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
    }

    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({ game, onMove: handleMove });
    const highlights: Record<string, React.CSSProperties> = lastMove ? {
        [lastMove.from]: { backgroundColor: "rgba(255, 255, 0, 0.35)" },
        [lastMove.to]: { backgroundColor: "rgba(255, 255, 0, 0.55)" },
    } : {};
    const yourTurn = !result && !thinking && game.turn() === childColor;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
                <div className="flex items-start gap-3">
                    <Image src={getAvatarPath(bot.avatar)} alt="" width={64} height={64} className="h-16 w-16 rounded-full bg-white ring-2 ring-orange-300 object-contain p-1 shrink-0" />
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none shadow px-4 py-3 text-gray-900 dark:text-white">
                        <p className="font-bold text-sm text-orange-600 dark:text-orange-400">{t(`${bot.id}Name`)}</p>
                        <p>{thinking ? t("thinking") : t(`${bot.id}${line}`)}</p>
                    </div>
                </div>
                <div className="w-full max-w-[600px] aspect-square rounded-lg overflow-hidden border-4 border-gray-800">
                    <Chessboard
                        options={{
                            id: "bot-game",
                            position: game.fen(),
                            boardOrientation: childColor === "w" ? "white" : "black",
                            onPieceDrop: (args) => { void onPieceDrop(args); return false; },
                            onSquareClick,
                            onPieceClick,
                            squareStyles: { ...highlights, ...optionSquares },
                            allowDragging: yourTurn,
                            animationDurationInMs: 200,
                        }}
                    />
                </div>
            </div>
            <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center space-y-3">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {result === "win" ? `🏆 ${t("youWon")}` : result === "loss" ? t("youLost") : result === "draw" ? t("draw") : yourTurn ? t("yourTurn") : t("botTurn")}
                    </p>
                    {!result && (
                        <div className="flex flex-wrap gap-2 justify-center">
                            {bot.takebacks && (
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
