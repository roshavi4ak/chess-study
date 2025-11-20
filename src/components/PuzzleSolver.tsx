"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import ChessBoard from "./ChessBoard";
import { CheckCircle, XCircle } from "lucide-react";

interface PuzzleSolverProps {
    fen: string;
    solution: string; // Space separated SAN moves
}

export default function PuzzleSolver({ fen, solution }: PuzzleSolverProps) {
    const [game, setGame] = useState(new Chess(fen));
    const [currentFen, setCurrentFen] = useState(fen);
    const [moveIndex, setMoveIndex] = useState(0);
    const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");
    const [message, setMessage] = useState("");

    const solutionMoves = solution.split(" ").filter(m => m.trim() !== "");

    const onMove = (move: { from: string; to: string; promotion?: string }) => {
        if (status !== "playing") return false;

        try {
            const tempGame = new Chess(game.fen());
            const moveResult = tempGame.move(move);

            if (!moveResult) return false;

            // Check if move matches solution
            const expectedMoveSan = solutionMoves[moveIndex];

            if (moveResult.san === expectedMoveSan) {
                // Correct move
                game.move(move);
                setCurrentFen(game.fen());
                setMoveIndex(prev => prev + 1);
                setMessage("");

                // Check if puzzle is finished
                if (moveIndex + 1 >= solutionMoves.length) {
                    setStatus("correct");
                    setMessage("Puzzle Solved!");
                } else {
                    // Play opponent's move automatically
                    setTimeout(() => {
                        const nextMoveSan = solutionMoves[moveIndex + 1];
                        game.move(nextMoveSan);
                        setCurrentFen(game.fen());
                        setMoveIndex(prev => prev + 1);

                        // Check if puzzle finished after opponent move (unlikely for puzzles ending on user move, but possible)
                        if (moveIndex + 2 >= solutionMoves.length) {
                            // Usually puzzles end on user move, but if not:
                            // setStatus("correct"); 
                        }
                    }, 500);
                }
                return true;
            } else {
                // Wrong move
                setStatus("wrong");
                setMessage("Incorrect move. Try again.");
                setTimeout(() => setStatus("playing"), 2000);
                return false;
            }
        } catch (e) {
            return false;
        }
    };

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-md">
                <ChessBoard
                    fen={currentFen}
                    onMove={onMove}
                    orientation={game.turn() === 'w' ? 'white' : 'black'}
                    interactive={status === "playing"}
                />
            </div>

            <div className="text-center h-16">
                {status === "correct" && (
                    <div className="flex items-center justify-center text-green-600 space-x-2">
                        <CheckCircle className="w-6 h-6" />
                        <span className="text-xl font-bold">{message}</span>
                    </div>
                )}
                {status === "wrong" && (
                    <div className="flex items-center justify-center text-red-600 space-x-2">
                        <XCircle className="w-6 h-6" />
                        <span className="text-xl font-bold">{message}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
