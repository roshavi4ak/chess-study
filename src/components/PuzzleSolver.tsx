"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { CheckCircle, XCircle, RotateCcw, Lightbulb, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface PuzzleSolverProps {
    fen: string;
    solution: string; // Space separated SAN moves
    hints?: string[]; // Array of hints corresponding to moves
    name: string; // Current puzzle name
    onSolve?: (result: "success" | "mistake" | "hint") => void;
}

export default function PuzzleSolver({ fen, solution, hints = [], name, onSolve }: PuzzleSolverProps) {
    const [game, setGame] = useState(new Chess(fen));
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");
    const [message, setMessage] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [mistakeMade, setMistakeMade] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const router = useRouter();

    // Parse solution moves
    const solutionMoves = solution.split(" ").filter(m => m.trim() !== "");

    useEffect(() => {
        // Reset state when puzzle changes
        setGame(new Chess(fen));
        setCurrentMoveIndex(0);
        setStatus("playing");
        setMessage("");
        setShowHint(false);
        setMistakeMade(false);
        setHintUsed(false);
    }, [fen]);

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
                setMistakeMade(true);
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
            setShowHint(false); // Hide hint after correct move

            // Check if puzzle solved by this move
            if (newMoveIndex >= solutionMoves.length) {
                setStatus("correct");
                setMessage("Puzzle Solved!");
                if (onSolve) {
                    if (mistakeMade) onSolve("mistake");
                    else if (hintUsed) onSolve("hint");
                    else onSolve("success");
                }
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
                        if (onSolve) {
                            if (mistakeMade) onSolve("mistake");
                            else if (hintUsed) onSolve("hint");
                            else onSolve("success");
                        }
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
        setShowHint(false);
        // We don't reset mistakeMade or hintUsed to discourage spamming reset to get perfect score
    }

    function handleHint() {
        setShowHint(true);
        setHintUsed(true);
    }

    async function handleNextPuzzle() {
        try {
            const res = await fetch(`/api/puzzles/random?exclude=${name}`);
            const data = await res.json();
            if (data.name) {
                router.push(`/puzzles/${data.name}`);
            } else {
                alert("No more puzzles available!");
            }
        } catch (error) {
            console.error("Failed to fetch next puzzle", error);
        }
    }

    const currentHint = hints[currentMoveIndex];

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

                {/* Overlay for Wrong Move */}
                {status === "wrong" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <XCircle className="w-32 h-32 text-red-600 opacity-50 animate-pulse" />
                    </div>
                )}
            </div>

            <div className="text-center min-h-[80px] space-y-2 w-full max-w-[600px]">
                {status === "correct" ? (
                    <div className="flex flex-col items-center justify-center text-green-600 animate-bounce">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-8 h-8" />
                            <span className="text-2xl font-bold">{message}</span>
                        </div>
                        <button
                            onClick={handleNextPuzzle}
                            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-full text-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            Next Puzzle <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <>
                        {status === "wrong" && (
                            <div className="flex items-center justify-center text-red-600 space-x-2">
                                <XCircle className="w-6 h-6" />
                                <span className="text-xl font-bold">{message}</span>
                            </div>
                        )}
                        {status === "playing" && (
                            <div className="text-gray-500 text-lg">
                                {currentMoveIndex === 0 ? "Your turn" : "Keep going..."}
                            </div>
                        )}

                        {/* Hint Display */}
                        {showHint && currentHint && (
                            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
                                💡 <strong>Hint:</strong> {currentHint}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="flex gap-4">
                {status !== "correct" && (
                    <>
                        <button
                            onClick={resetPuzzle}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Reset</span>
                        </button>

                        {currentHint && !showHint && (
                            <button
                                onClick={handleHint}
                                className="flex items-center space-x-2 px-4 py-2 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 rounded-md transition-colors"
                            >
                                <Lightbulb className="w-4 h-4" />
                                <span>Show Hint</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
