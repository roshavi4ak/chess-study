"use client";

import { useState, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";

export default function PuzzleBuilder() {
    // Use ref to prevent stale closures (per react-chessboard docs)
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;

    // Track position in state to trigger re-renders
    const [chessPosition, setChessPosition] = useState(chessGame.fen());
    const [initialFen, setInitialFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const [solutionMoves, setSolutionMoves] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [description, setDescription] = useState("");

    function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
        if (!targetSquare) return false;

        try {
            const move = chessGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q",
            });

            if (move === null) return false;

            // Update position state to trigger re-render
            setChessPosition(chessGame.fen());
            setSolutionMoves([...solutionMoves, move.san]);
            return true;
        } catch {
            return false;
        }
    }

    function loadStartingPosition() {
        try {
            chessGame.load(initialFen);
            setChessPosition(chessGame.fen());
            setSolutionMoves([]);
        } catch {
            alert("Invalid FEN string. Please check and try again.");
        }
    }

    function resetBoard() {
        try {
            chessGame.load(initialFen);
            setChessPosition(chessGame.fen());
            setSolutionMoves([]);
        } catch {
            console.error("Invalid FEN on reset");
        }
    }

    function undoLastMove() {
        if (solutionMoves.length === 0) return;

        const newMoves = solutionMoves.slice(0, -1);
        chessGame.load(initialFen);
        for (const move of newMoves) {
            chessGame.move(move);
        }
        setChessPosition(chessGame.fen());
        setSolutionMoves(newMoves);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (solutionMoves.length === 0) {
            alert("Please make at least one move to define the solution.");
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append("fen", initialFen);
        formData.append("solution", solutionMoves.join(" "));
        formData.append("description", description);

        try {
            const { createPuzzle } = await import("@/app/actions/puzzle");
            await createPuzzle(formData);
        } catch (error) {
            console.error(error);
            alert("Failed to create puzzle");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="aspect-square w-full max-w-[500px] mx-auto border-4 border-gray-800 rounded-lg overflow-hidden shadow-xl">
                    <Chessboard
                        key={`puzzle-builder-${chessPosition}`}
                        options={{
                            id: "puzzle-builder",
                            position: chessPosition,
                            onPieceDrop: onPieceDrop,
                            boardOrientation: "white",
                        } as any}
                    />
                </div>
                <div className="text-center text-sm text-gray-500">
                    Play moves on the board to define the solution sequence.
                </div>
            </div>

            <div className="space-y-6">
                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-1">Starting Position (FEN)</label>
                        <input
                            type="text"
                            value={initialFen}
                            onChange={(e) => setInitialFen(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                            required
                        />
                        <button
                            type="button"
                            onClick={loadStartingPosition}
                            className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                        >
                            Load Starting Position
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={3}
                            placeholder="e.g. White to move and mate in 2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Solution Moves</label>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700 min-h-[60px]">
                            {solutionMoves.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {solutionMoves.map((move, i) => (
                                        <span key={i} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-medium">
                                            {i + 1}. {move}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-gray-400 text-sm">No moves recorded yet</span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={undoLastMove}
                            disabled={solutionMoves.length === 0}
                            className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Undo Last Move
                        </button>
                        <button
                            type="button"
                            onClick={resetBoard}
                            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                            Reset to Start
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || solutionMoves.length === 0}
                        className="w-full py-3 bg-green-600 text-white rounded font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Saving..." : "Save Puzzle"}
                    </button>
                </form>
            </div>
        </div>
    );
}
