"use client";

import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { applyPawnMove, computerPawnMove, pawnMoves, pawnWinner, type PawnPosition, type PawnWarsLevel } from "@/lib/miniGames";

// Pawns only: the child plays White against the computer. First pawn to the far side wins.
export default function PawnWarsGame({ level, onComplete }: { level: PawnWarsLevel; onComplete: (stars: number, moves: number) => void }) {
    const t = useTranslations("MiniGames");
    const start = (): PawnPosition => ({ white: level.white, black: level.black, turn: "w" });
    const [position, setPosition] = useState<PawnPosition>(start);
    const [selected, setSelected] = useState<string | null>(null);
    const [moves, setMoves] = useState(0);
    const winner = pawnWinner(position);

    // The computer answers after a short pause.
    useEffect(() => {
        if (winner || position.turn !== "b") return;
        const timer = setTimeout(() => {
            const move = computerPawnMove(position);
            if (move) setPosition(applyPawnMove(position, move));
        }, 500);
        return () => clearTimeout(timer);
    }, [position, winner]);

    useEffect(() => {
        if (winner === "w") onComplete(3, moves);
        // Reported once, when the child wins.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [winner]);

    const mine = winner || position.turn !== "w" ? [] : pawnMoves(position, "w");
    const options = selected ? mine.filter(move => move.from === selected).map(move => move.to) : [];

    function onSquareClick({ square }: { square: string }) {
        if (winner || position.turn !== "w") return;
        if (selected && options.includes(square)) {
            setPosition(applyPawnMove(position, { from: selected, to: square }));
            setMoves(value => value + 1);
            setSelected(null);
            return;
        }
        setSelected(mine.some(move => move.from === square) ? square : null);
    }

    const pieces: Record<string, { pieceType: string }> = {};
    for (const square of position.white) pieces[square] = { pieceType: "wP" };
    for (const square of position.black) pieces[square] = { pieceType: "bP" };
    const squareStyles: Record<string, React.CSSProperties> = {};
    if (selected) squareStyles[selected] = { backgroundColor: "rgba(255, 255, 0, 0.45)" };
    for (const square of options) squareStyles[square] = { backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.3) 22%, transparent 23%)" };

    return (
        <div className="space-y-3">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
                {winner === "w" ? `🏆 ${t("pawnWarsWon")}` : winner === "b" ? t("pawnWarsLost") : position.turn === "w" ? t("pawnWarsGoal") : t("computerThinking")}
            </p>
            <div className="w-full max-w-[560px] aspect-square rounded-lg overflow-hidden border-4 border-green-700">
                <Chessboard options={{ id: `pawns-${level.id}`, position: pieces, allowDragging: false, onSquareClick, squareStyles }} />
            </div>
            {winner === "b" && (
                <button type="button" onClick={() => { setPosition(start()); setMoves(0); setSelected(null); }}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-green-600 text-white font-bold">
                    <RotateCcw className="h-4 w-4" /> {t("tryAgain")}
                </button>
            )}
        </div>
    );
}
