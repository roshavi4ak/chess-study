"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { CheckCircle, XCircle, RotateCcw } from "lucide-react";

interface PuzzleSolverProps {
    fen: string;
    solution: string; // Space separated SAN moves
}

export default function PuzzleSolver({ fen, solution }: PuzzleSolverProps) {
    const [game, setGame] = useState(new Chess(fen));
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");
    const [message, setMessage] = useState("");

    // Parse solution moves
    const solutionMoves = solution.split(" ").filter(m => m.trim() !== "");

    function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
        if (!targetSquare || status !== "playing") return false;

        try {
            // Create a temp game to validate the move and get SAN
            const tempGame = new Chess(game.fen());
            const move = tempGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q'
            });

            if (!move) return false; // Illegal move

            const expectedMoveSan = solutionMoves[currentMoveIndex];

            if (move.san !== expectedMoveSan) {
                // Wrong move!
                setStatus("wrong");
                setMessage("Incorrect move. Try again.");
                setTimeout(() => {
                    setStatus("playing");
                    setMessage("");
                }, 1000);
                return false; // Snap back
            }

            // Correct move!
            game.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
            const newGame = new Chess(game.fen());
            setGame(newGame);
            const newMoveIndex = currentMoveIndex + 1;
            setCurrentMoveIndex(newMoveIndex);
            setMessage("");

            // Check if puzzle solved by this move
            if (newMoveIndex >= solutionMoves.length) {
                setStatus("correct");
                setMessage("Puzzle Solved!");
                return true;
            }

            // Auto-play opponent's move
            setTimeout(() => {
                const nextMoveSan = solutionMoves[newMoveIndex];
                if (nextMoveSan) {
                    game.move(nextMoveSan);
                    setGame(new Chess(game.fen()));
                    setCurrentMoveIndex(prev => prev + 1); // Increment by 1 for opponent's move

                    // Check if puzzle solved after opponent's move
                    if (newMoveIndex + 1 >= solutionMoves.length) {
                        setStatus("correct");
                        setMessage("Puzzle Solved!");
                    }
                }
            }, 200);

            return true;

        } catch {
            return false;
        }
    }

    function resetPuzzle() {
        setGame(new Chess(fen));
        setCurrentMoveIndex(0);
        setStatus("playing");
        setMessage("");
    }

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-[600px] aspect-square relative">
                <Chessboard
                    key={`puzzle-solver-${game.fen()}`}
                    options={{
                        id: "puzzle-solver",
                        position: game.fen(),
                        onPieceDrop: onPieceDrop,
                        boardOrientation: new Chess(fen).turn() === 'w' ? 'white' : 'black',
                        animationDuration: 200,
                    } as any}
                />

                {/* Overlay for Wrong Move (Optional, but visual feedback is nice) */}
                {status === "wrong" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <XCircle className="w-32 h-32 text-red-600 opacity-50 animate-pulse" />
                    </div>
                )}
            </div>

            <div className="text-center h-16 space-y-2">
                {status === "correct" && (
                    <div className="flex flex-col items-center justify-center text-green-600 animate-bounce">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-8 h-8" />
                            <span className="text-2xl font-bold">{message}</span>
                        </div>
                        <button
                            onClick={resetPuzzle}
                            className="mt-2 px-4 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm font-medium transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                )}
                {status === "wrong" && (
                    <div className="flex items-center justify-center text-red-600 space-x-2">
                        <XCircle className="w-6 h-6" />
                        <span className="text-xl font-bold">{message}</span>
                    </div>
                )}
                {status === "playing" && (
                    <div className="text-gray-500">
                        {currentMoveIndex === 0 ? "Your turn" : "Keep going..."}
                    </div>
                )}
            </div>

            {status !== "correct" && (
                <button
                    onClick={resetPuzzle}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Puzzle</span>
                </button>
            )}
        </div>
    );
}
