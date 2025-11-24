"use client";

import { useState, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { Trash2, Plus, X } from "lucide-react";

interface PuzzleBuilderProps {
    initialData?: {
        id: string;
        fen: string;
        solution: string;
        description: string;
        name: string;
        rating: number;
        tags: string[];
        hints: string[];
    };
}

export default function PuzzleBuilder({ initialData }: PuzzleBuilderProps) {
    const chessGameRef = useRef(new Chess());
    const chessGame = chessGameRef.current;

    const [chessPosition, setChessPosition] = useState(chessGame.fen());
    const [initialFen, setInitialFen] = useState(initialData?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const [solutionMoves, setSolutionMoves] = useState<string[]>(initialData?.solution.split(" ") || []);
    const [description, setDescription] = useState(initialData?.description || "");

    // New fields
    const [name, setName] = useState(initialData?.name || "");
    const [rating, setRating] = useState(initialData?.rating || 1200);
    const [tags, setTags] = useState<string[]>(initialData?.tags || []);
    const [currentTag, setCurrentTag] = useState("");
    const [hints, setHints] = useState<string[]>(initialData?.hints || []);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!initialData && !name) {
            // Generate random 6 char string for name
            setName(Math.random().toString(36).substring(2, 8).toUpperCase());
        }
        if (initialData) {
            try {
                chessGame.load(initialData.fen);
                // Replay moves to get to end position if needed, but for builder we usually start at FEN
                // Actually, if we are editing, we might want to show the solution moves already played? 
                // Or just show the start position. Let's show start position.
                setChessPosition(chessGame.fen());
            } catch {
                console.error("Invalid initial FEN");
            }
        }
    }, [initialData, name, chessGame]);

    function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
        if (!targetSquare) return false;

        try {
            const move = chessGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q",
            });

            if (move === null) return false;

            setChessPosition(chessGame.fen());
            setSolutionMoves([...solutionMoves, move.san]);
            // Add empty hint for the new move
            setHints([...hints, ""]);
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
            setHints([]);
        } catch {
            alert("Invalid FEN string. Please check and try again.");
        }
    }

    function resetBoard() {
        try {
            chessGame.load(initialFen);
            setChessPosition(chessGame.fen());
            setSolutionMoves([]);
            setHints([]);
        } catch {
            console.error("Invalid FEN on reset");
        }
    }

    function undoLastMove() {
        if (solutionMoves.length === 0) return;

        const newMoves = solutionMoves.slice(0, -1);
        const newHints = hints.slice(0, -1);

        chessGame.load(initialFen);
        for (const move of newMoves) {
            chessGame.move(move);
        }
        setChessPosition(chessGame.fen());
        setSolutionMoves(newMoves);
        setHints(newHints);
    }

    function addTag() {
        if (currentTag && !tags.includes(currentTag)) {
            setTags([...tags, currentTag]);
            setCurrentTag("");
        }
    }

    function removeTag(tagToRemove: string) {
        setTags(tags.filter(t => t !== tagToRemove));
    }

    function updateHint(index: number, value: string) {
        const newHints = [...hints];
        newHints[index] = value;
        setHints(newHints);
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
        formData.append("name", name);
        formData.append("rating", rating.toString());
        formData.append("tags", tags.join(","));
        formData.append("hints", JSON.stringify(hints));

        try {
            const { createPuzzle, updatePuzzle } = await import("@/app/actions/puzzle");
            if (initialData?.id) {
                await updatePuzzle(initialData.id, formData);
            } else {
                await createPuzzle(formData);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to save puzzle");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete() {
        if (!initialData?.id || !confirm("Are you sure you want to delete this puzzle?")) return;

        setIsSubmitting(true);
        try {
            const { deletePuzzle } = await import("@/app/actions/puzzle");
            await deletePuzzle(initialData.id);
        } catch (error) {
            console.error(error);
            alert("Failed to delete puzzle");
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Rating</label>
                            <input
                                type="number"
                                value={rating}
                                onChange={(e) => setRating(parseInt(e.target.value))}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Tags</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={currentTag}
                                onChange={(e) => setCurrentTag(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Add a tag..."
                            />
                            <button type="button" onClick={addTag} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Starting Position (FEN)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={initialFen}
                                onChange={(e) => setInitialFen(e.target.value)}
                                className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                                required
                            />
                            <button
                                type="button"
                                onClick={loadStartingPosition}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                                Load
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={2}
                            placeholder="e.g. White to move and mate in 2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Solution & Hints</label>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto p-2 border rounded dark:border-gray-700">
                            {solutionMoves.length > 0 ? (
                                solutionMoves.map((move, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                                        <span className="font-bold w-8 text-gray-500">{i + 1}.</span>
                                        <span className="font-medium w-16">{move}</span>
                                        <input
                                            type="text"
                                            value={hints[i] || ""}
                                            onChange={(e) => updateHint(i, e.target.value)}
                                            placeholder="Add hint for this move..."
                                            className="flex-1 p-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="text-gray-400 text-sm text-center py-4">Make moves on the board to start</div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={undoLastMove}
                            disabled={solutionMoves.length === 0}
                            className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                        >
                            Undo Move
                        </button>
                        <button
                            type="button"
                            onClick={resetBoard}
                            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                            Reset
                        </button>
                    </div>

                    <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                        <button
                            type="submit"
                            disabled={isSubmitting || solutionMoves.length === 0}
                            className="flex-1 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                            {isSubmitting ? "Saving..." : (initialData ? "Update Puzzle" : "Create Puzzle")}
                        </button>

                        {initialData && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
