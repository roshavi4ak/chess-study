"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { useActivityChessnut } from "@/hooks/useActivityChessnut";
import ActivityBoardPanel from "./ActivityBoardPanel";

interface QuickPuzzleBoardProps {
    fen: string;
    solution: string; // Space-separated UCI moves; the first one is the opponent's set-up move
    // Called once: true when every move was right, false at the first wrong move.
    onResult: (solved: boolean) => void;
    disabled?: boolean;
    boardSupport?: boolean;
}

function applyUci(game: Chess, uci: string) {
    return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

// Unrated puzzle board for timed modes: no rating, no hints, one try.
// Remount it (change its React key) for each new puzzle.
export default function QuickPuzzleBoard({ fen, solution, onResult, disabled, boardSupport = false }: QuickPuzzleBoardProps) {
    const moves = solution.split(" ").filter(Boolean);
    const [game, setGame] = useState(() => new Chess(fen));
    const [index, setIndex] = useState(0);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
    const finished = useRef(false);
    const [done, setDone] = useState(false);
    const [result, setResult] = useState<boolean | null>(null);
    const reported = useRef(false);
    const orientation = new Chess(fen).turn() === "w" ? "black" : "white";

    function finish(solved: boolean) {
        if (finished.current) return;
        finished.current = true;
        setDone(true);
        setFlash(solved ? "right" : "wrong");
        setResult(solved);
    }

    function playOpponent(from: Chess, moveIndex: number) {
        const next = new Chess(from.fen());
        const move = applyUci(next, moves[moveIndex]);
        setGame(next);
        setLastMove({ from: move.from, to: move.to });
        setIndex(moveIndex + 1);
        if (moveIndex + 1 >= moves.length) finish(true);
    }

    useEffect(() => {
        const timer = setTimeout(() => playOpponent(new Chess(fen), 0), 400);
        return () => clearTimeout(timer);
        // The board is remounted for every puzzle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleMove({ from, to, promotion }: { from: string; to: string; promotion?: string }, physical = false) {
        if (boardSupport && board.enabled && !physical) return false;
        if (disabled || finished.current || index === 0 || index >= moves.length) return false;
        const attempt = new Chess(game.fen());
        let move;
        try {
            move = attempt.move({ from, to, promotion: promotion ?? "q" });
        } catch {
            return false;
        }
        const expected = moves[index];
        // Any mate in one counts, like on Lichess.
        const correct = `${move.from}${move.to}${move.promotion ?? ""}` === expected || (index === moves.length - 1 && attempt.isCheckmate());
        if (!correct) {
            finish(false);
            return false;
        }
        setGame(attempt);
        setLastMove({ from: move.from, to: move.to });
        if (index + 1 >= moves.length) {
            setIndex(index + 1);
            finish(true);
        } else {
            setIndex(index + 1);
            setTimeout(() => playOpponent(attempt, index + 1), 250);
        }
        return true;
    }

    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares } = useLegalMoves({ game, onMove: handleMove, boardOrientation: orientation });
    const board = useActivityChessnut({
        fen: game.fen(), active: boardSupport,
        canMove: !disabled && !done && index > 0 && index < moves.length && index % 2 === 1,
        expectedMoves: moves[index] ? [moves[index]] : [], onMove: move => handleMove(move, true),
        syncMove: index % 2 === 1 ? moves[index - 1] : undefined,
        completion: result ? fen : undefined,
    });
    useEffect(() => {
        if (result === null || reported.current || (boardSupport && !board.ready)) return;
        const timer = setTimeout(() => { reported.current = true; onResult(result); }, boardSupport && board.enabled && result ? 4700 : result ? 350 : 700);
        return () => clearTimeout(timer);
    }, [result, boardSupport, board.ready, board.enabled, onResult]);
    const squareStyles: Record<string, React.CSSProperties> = lastMove ? {
        [lastMove.from]: { backgroundColor: "rgba(255, 255, 0, 0.35)" },
        [lastMove.to]: { backgroundColor: "rgba(255, 255, 0, 0.55)" },
    } : {};

    return (
        <div className="space-y-3">
        {boardSupport && <ActivityBoardPanel board={board} reply={index % 2 === 1 ? moves[index - 1] : undefined} />}
        <div className={`relative w-full aspect-square rounded-lg overflow-hidden border-4 ${flash === "right" ? "border-green-500" : flash === "wrong" ? "border-red-500" : "border-gray-800"}`}>
            <Chessboard
                options={{
                    id: "quick-puzzle",
                    position: game.fen(),
                    boardOrientation: orientation,
                    onPieceDrop: (args) => { if (!boardSupport || !board.enabled) void onPieceDrop(args); return false; },
                    onSquareClick: !boardSupport || !board.enabled ? onSquareClick : undefined,
                    onPieceClick: !boardSupport || !board.enabled ? onPieceClick : undefined,
                    squareStyles: { ...squareStyles, ...optionSquares },
                    allowDragging: (!boardSupport || !board.enabled) && !disabled && !done,
                    animationDurationInMs: 150,
                }}
            />
        </div>
        </div>
    );
}
