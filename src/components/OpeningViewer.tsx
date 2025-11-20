"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import ChessBoard from "./ChessBoard";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

interface OpeningViewerProps {
    pgn: string;
}

export default function OpeningViewer({ pgn }: OpeningViewerProps) {
    const [game, setGame] = useState(new Chess());
    const [currentFen, setCurrentFen] = useState("start");
    const [moveIndex, setMoveIndex] = useState(-1); // -1 means start position
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const newGame = new Chess();
        try {
            newGame.loadPgn(pgn);
        } catch (e) {
            console.error("Error loading PGN:", e);
        }
        setGame(newGame);
        setHistory(newGame.history({ verbose: true }).map(m => m.after));
        // Reset to start
        setCurrentFen("start");
        setMoveIndex(-1);
    }, [pgn]);

    const handleNext = () => {
        if (moveIndex < history.length - 1) {
            const nextIndex = moveIndex + 1;
            setMoveIndex(nextIndex);
            setCurrentFen(history[nextIndex]);
        }
    };

    const handlePrev = () => {
        if (moveIndex > -1) {
            const prevIndex = moveIndex - 1;
            setMoveIndex(prevIndex);
            setCurrentFen(prevIndex === -1 ? "start" : history[prevIndex]);
        }
    };

    const handleReset = () => {
        setMoveIndex(-1);
        setCurrentFen("start");
    };

    const handleMove = (move: { from: string; to: string; promotion?: string }) => {
        const tempGame = new Chess(currentFen === "start" ? undefined : currentFen);
        try {
            const result = tempGame.move(move);
            if (!result) return false;

            const newFen = tempGame.fen();

            // Check if this move matches the next move in history
            if (moveIndex + 1 < history.length) {
                // We compare FENs. Note: chess.js FENs include move counts, so they should match exactly
                // if the game history was generated from the same sequence.
                if (history[moveIndex + 1] === newFen) {
                    setMoveIndex(moveIndex + 1);
                    setCurrentFen(newFen);
                    return true;
                }
            }

            // Allow exploration but don't update viewer state
            return true;
        } catch (e) {
            return false;
        }
    };

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-md">
                <ChessBoard
                    fen={currentFen}
                    onMove={handleMove}
                    interactive={true} // Allow user to move pieces
                    orientation="white"
                />
            </div>

            <div className="flex space-x-4">
                <button
                    onClick={handleReset}
                    className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                    title="Reset"
                >
                    <RotateCcw className="w-6 h-6" />
                </button>
                <button
                    onClick={handlePrev}
                    disabled={moveIndex === -1}
                    className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50"
                    title="Previous Move"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                    onClick={handleNext}
                    disabled={moveIndex === history.length - 1}
                    className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50"
                    title="Next Move"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
                Move {Math.floor((moveIndex + 1) / 2) + 1}
            </div>
        </div>
    );
}
