"use client";

import { useState, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
// import { Arrow } from "react-chessboard/dist/chessboard/types";

type Arrow = [string, string, string?];

interface OpeningStep {
    fen: string;
    arrows: Arrow[];
    description: string;
}

export default function OpeningBuilder() {
    const [game, setGame] = useState(new Chess());
    const [steps, setSteps] = useState<OpeningStep[]>([]);
    const [currentDescription, setCurrentDescription] = useState("");
    const [currentArrows, setCurrentArrows] = useState<Arrow[]>([]);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Arrow drawing state
    const [rightClickStart, setRightClickStart] = useState<Square | null>(null);

    function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: Square, targetSquare: Square }) {
        try {
            const move = game.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q",
            });

            if (move === null) return false;
            setGame(new Chess(game.fen()));
            return true;
        } catch (e) {
            return false;
        }
    }

    function handleSquareRightClick({ square }: { square: Square }) {
        if (rightClickStart) {
            // Complete arrow
            if (rightClickStart === square) {
                // Clear arrows if clicked on same square? Or maybe just cancel
                setRightClickStart(null);
            } else {
                const newArrow: Arrow = [rightClickStart, square, "green"];
                // Check if arrow already exists to remove it (toggle)
                const existingIndex = currentArrows.findIndex(
                    (a) => a[0] === rightClickStart && a[1] === square
                );
                if (existingIndex >= 0) {
                    setCurrentArrows(currentArrows.filter((_, i) => i !== existingIndex));
                } else {
                    setCurrentArrows([...currentArrows, newArrow]);
                }
                setRightClickStart(null);
            }
        } else {
            // Start arrow
            setRightClickStart(square);
        }
    }

    function addStep() {
        setSteps([
            ...steps,
            {
                fen: game.fen(),
                arrows: [...currentArrows],
                description: currentDescription,
            },
        ]);
        // Reset for next step? Or keep current state?
        // Usually you want to continue from current position
        setCurrentDescription("");
        setCurrentArrows([]);
    }

    function removeStep(index: number) {
        setSteps(steps.filter((_, i) => i !== index));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("pgn", game.pgn()); // Still save PGN for reference
        formData.append("steps", JSON.stringify(steps));

        // We need to import the action dynamically or pass it as prop if it's a server action
        // For now assuming we'll use the one from actions/opening.ts
        // But we can't import server action directly in client component easily without passing it down or using a separate file
        // So I will create a separate file for the submit handler or just use fetch if it was an API route.
        // Since we are using server actions, we can import it.

        try {
            // Dynamic import to avoid server-only issues during build if not handled correctly? 
            // Actually standard import works in Next.js 14+ for server actions in client components.
            const { createOpening } = await import("@/app/actions/opening");
            await createOpening(formData);
        } catch (error) {
            console.error(error);
            alert("Failed to create opening");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Board and Controls */}
                <div className="space-y-4">
                    <div className="aspect-square w-full max-w-[500px] mx-auto border-4 border-gray-800 rounded-lg overflow-hidden shadow-xl">
                        <Chessboard
                            options={{
                                position: game.fen(),
                                onPieceDrop: onPieceDrop,
                                onSquareRightClick: handleSquareRightClick,
                                customArrows: currentArrows,
                                boardOrientation: "white",
                            } as any}
                        />
                    </div>
                    <div className="text-sm text-gray-500 text-center">
                        Right-click start and end squares to draw arrows. Move pieces to set position.
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Step Description</label>
                            <textarea
                                value={currentDescription}
                                onChange={(e) => setCurrentDescription(e.target.value)}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                rows={3}
                                placeholder="Explain this position..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={addStep}
                                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                            >
                                Add Step
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setGame(new Chess());
                                    setCurrentArrows([]);
                                    setCurrentDescription("");
                                }}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Reset Board
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Form and Steps List */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Opening Details</h2>
                        <div className="space-y-4">
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
                                <label className="block text-sm font-medium mb-1">General Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Steps ({steps.length})</h2>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            {steps.map((step, index) => (
                                <div key={index} className="border dark:border-gray-700 p-3 rounded flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="font-medium">Step {index + 1}</div>
                                        <div className="text-sm text-gray-500 truncate">{step.fen}</div>
                                        <div className="text-sm mt-1">{step.description}</div>
                                        {step.arrows.length > 0 && (
                                            <div className="text-xs text-green-600 mt-1">{step.arrows.length} arrows</div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeStep(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            {steps.length === 0 && (
                                <div className="text-gray-500 text-center py-4">
                                    No steps added yet.
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || steps.length === 0 || !name}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Saving..." : "Save Opening"}
                    </button>
                </div>
            </div>
        </div>
    );
}
