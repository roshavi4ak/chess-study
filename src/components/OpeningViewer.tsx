"use client";

import { useState, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import LichessAnalysisLink from "@/components/LichessAnalysisLink";

interface OpeningViewerProps {
    pgn: string;
}

export default function OpeningViewer({ pgn }: OpeningViewerProps) {
    return <OpeningViewerContent key={pgn} pgn={pgn} />;
}

function OpeningViewerContent({ pgn }: OpeningViewerProps) {
    // Opening line state
    const [{ history, loadError }] = useState(() => {
        try {
            const game = new Chess();
            game.loadPgn(pgn);
            return { history: game.history({ verbose: true }).map(move => move.after), loadError: false };
        } catch (error) {
            console.error("Error loading PGN:", error);
            return { history: [] as string[], loadError: true };
        }
    });
    const [moveIndex, setMoveIndex] = useState(-1); // -1 = start position
    const [currentFen, setCurrentFen] = useState("start");
    const [message, setMessage] = useState(loadError ? "Error loading opening" : "Follow the opening line");
    const chessGameRef = useRef(new Chess());

    const handleMove = (move: { from: string; to: string; promotion?: string }) => {
        const { from, to, promotion = 'q' } = move;
        setOptionSquares({});
        if (from === to) return false;

        // Create a temporary game from current position
        const tempGame = new Chess(currentFen === "start" ? undefined : currentFen);

        try {
            // Try to make the move
            const result = tempGame.move({
                from,
                to,
                promotion
            });

            if (!result) return false;

            const newFen = tempGame.fen();

            // Check if we're still within the opening line
            if (moveIndex + 1 < history.length) {
                // Check if this move matches the next move in the opening
                if (history[moveIndex + 1] === newFen) {
                    // Correct move! Advance the position
                    const nextIndex = moveIndex + 1;
                    setMoveIndex(nextIndex);
                    setCurrentFen(newFen);

                    if (nextIndex === history.length - 1) {
                        setMessage("✓ Opening complete!");
                    } else {
                        setMessage(`✓ Correct! Move ${Math.floor(nextIndex / 2) + 1}`);
                    }
                    return true;
                } else {
                    // Wrong move - reject it
                    setMessage("❌ Incorrect move. Try again!");
                    setTimeout(() => {
                        if (moveIndex === -1) {
                            setMessage("Follow the opening line");
                        } else {
                            setMessage(`Move ${Math.floor(moveIndex / 2) + 1}`);
                        }
                    }, 2000);
                    return false;
                }
            } else {
                // Past the opening line - allow free exploration
                setCurrentFen(newFen);
                chessGameRef.current = tempGame;
                setMessage("Exploring beyond the opening");
                return true;
            }
        } catch {
            return false;
        }
    };

    const { onSquareClick, onPieceClick, optionSquares, setOptionSquares, onPieceDrop } = useLegalMoves({
        game: useMemo(() => new Chess(currentFen === "start" ? undefined : currentFen), [currentFen]),
        onMove: handleMove
    });

    // Navigation handlers
    function handleNext() {
        if (moveIndex < history.length - 1) {
            const nextIndex = moveIndex + 1;
            setMoveIndex(nextIndex);
            setCurrentFen(history[nextIndex]);
            setMessage(`Move ${Math.floor(nextIndex / 2) + 1}`);
        }
    }

    function handlePrev() {
        if (moveIndex > -1) {
            const prevIndex = moveIndex - 1;
            setMoveIndex(prevIndex);
            setCurrentFen(prevIndex === -1 ? "start" : history[prevIndex]);
            setMessage(prevIndex === -1 ? "Starting position" : `Move ${Math.floor(prevIndex / 2) + 1}`);
        }
    }

    function handleReset() {
        setMoveIndex(-1);
        setCurrentFen("start");
        setMessage("Follow the opening line");
    }

    const chessboardOptions: ChessboardOptions = {
        position: currentFen,
        onPieceDrop: (args) => { void onPieceDrop(args); return false; },
        id: 'opening-viewer',
        onSquareClick,
        onPieceClick,
        squareStyles: optionSquares
    };

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-[600px] aspect-square">
                <Chessboard options={chessboardOptions} />
            </div>

            <div className="flex flex-wrap justify-center gap-4">
                <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
                    title="Reset to start"
                >
                    Reset
                </button>
                <button
                    onClick={handlePrev}
                    disabled={moveIndex === -1}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    title="Previous move"
                >
                    ◀ Prev
                </button>
                <button
                    onClick={handleNext}
                    disabled={moveIndex === history.length - 1}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    title="Next move"
                >
                    Next ▶
                </button>
                <LichessAnalysisLink fen={currentFen === "start" ? new Chess().fen() : currentFen} />
            </div>

            <div className="text-center">
                <div className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                    {message}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Position: {moveIndex === -1 ? "Start" : `${moveIndex + 1} / ${history.length}`}
                </div>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400 max-w-md">
                <p>Navigate with buttons or click pieces to practice the opening.</p>
                <p className="mt-1">Correct moves will advance the position automatically.</p>
            </div>
        </div>
    );
}
