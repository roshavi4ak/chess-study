"use client";

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { useRouter } from "next/navigation";
import { updateOpening } from "@/app/actions/opening";

// Arrow format per documentation: { startSquare: string; endSquare: string; color: string; }
interface Arrow {
    startSquare: string;
    endSquare: string;
    color: string;
}

interface OpeningStep {
    fen: string;
    arrows: Arrow[];
    description: string;
}

interface OpeningEditorProps {
    opening: {
        id: string;
        name: string;
        description: string | null;
        pgn: string;
        steps: Array<{
            fen: string;
            arrows: string;
            description: string | null;
            order: number;
        }>;
    };
}

export default function OpeningEditor({ opening }: OpeningEditorProps) {
    const router = useRouter();

    // Parse existing steps
    const initialSteps: OpeningStep[] = opening.steps.map(step => ({
        fen: step.fen,
        arrows: JSON.parse(step.arrows),
        description: step.description || ""
    }));

    // Initialize game from PGN
    const initialGame = new Chess();
    try {
        initialGame.loadPgn(opening.pgn);
    } catch (e) {
        console.error("Failed to load PGN:", e);
    }

    const [game, setGame] = useState(initialGame);
    const [steps, setSteps] = useState<OpeningStep[]>(initialSteps);
    const [currentDescription, setCurrentDescription] = useState("");
    const [currentArrows, setCurrentArrows] = useState<Arrow[]>([]);
    const [name, setName] = useState(opening.name);
    const [description, setDescription] = useState(opening.description || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);

    // Arrow drawing state
    const [rightClickStart, setRightClickStart] = useState<Square | null>(null);

    // Track changes
    useEffect(() => {
        const hasChanges =
            name !== opening.name ||
            description !== (opening.description || "") ||
            JSON.stringify(steps) !== JSON.stringify(initialSteps);
        setHasUnsavedChanges(hasChanges);
    }, [name, description, steps, opening.name, opening.description, initialSteps]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

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
                // Cancel if clicked same square
                setRightClickStart(null);
            } else {
                const newArrow: Arrow = {
                    startSquare: rightClickStart,
                    endSquare: square,
                    color: "#008000" // Green
                };

                // Check if arrow already exists to remove it (toggle)
                const existingIndex = currentArrows.findIndex(
                    (a) => a.startSquare === rightClickStart && a.endSquare === square
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

    function resetToPreviousStep() {
        if (editingStepIndex === null) return;
        const prevIndex = editingStepIndex - 1;
        const newGame = new Chess();
        if (prevIndex >= 0) {
            newGame.load(steps[prevIndex].fen);
        } else {
            newGame.reset();
        }
        setGame(newGame);
    }

    function addStep() {
        if (editingStepIndex !== null) {
            // Update existing step
            const updatedSteps = [...steps];
            updatedSteps[editingStepIndex] = {
                fen: game.fen(),
                arrows: [...currentArrows],
                description: currentDescription,
            };
            setSteps(updatedSteps);
            setEditingStepIndex(null);

            // Load the chessboard in its final position (after the currently final step)
            const lastStep = updatedSteps[updatedSteps.length - 1];
            const lastGame = new Chess();
            lastGame.load(lastStep.fen);
            setGame(lastGame);
            setCurrentArrows([]);
            setCurrentDescription("");
        } else {
            // Add new step
            setSteps([
                ...steps,
                {
                    fen: game.fen(),
                    arrows: [...currentArrows],
                    description: currentDescription,
                },
            ]);
            // Keep current position but clear arrows/description for next step
            setCurrentDescription("");
            setCurrentArrows([]);
        }
    }

    function editStep(index: number) {
        const step = steps[index];
        // Load the step into the editor
        const newGame = new Chess();
        newGame.load(step.fen);
        setGame(newGame);
        setCurrentArrows([...step.arrows]);
        setCurrentDescription(step.description);
        setEditingStepIndex(index);
    }

    function cancelEdit() {
        setEditingStepIndex(null);
        setCurrentDescription("");
        setCurrentArrows([]);
        setGame(new Chess());
    }

    function removeStep(index: number) {
        setSteps(steps.filter((_, i) => i !== index));
        // If we're editing this step, cancel the edit
        if (editingStepIndex === index) {
            cancelEdit();
        } else if (editingStepIndex !== null && editingStepIndex > index) {
            // Adjust the editing index if we removed a step before it
            setEditingStepIndex(editingStepIndex - 1);
        }
    }

    function goToPreviousStep() {
        if (steps.length === 0) return;

        if (editingStepIndex === null) {
            // Currently adding a new step, go to the last existing step
            editStep(steps.length - 1);
        } else if (editingStepIndex > 0) {
            // Go to previous step
            editStep(editingStepIndex - 1);
        }
    }

    function goToNextStep() {
        if (editingStepIndex === null) return;

        if (editingStepIndex < steps.length - 1) {
            // Go to next step
            editStep(editingStepIndex + 1);
        } else {
            // Go to "Add New Step" mode
            // Instead of fully resetting, load the last step's position so user can continue
            const lastStep = steps[steps.length - 1];
            const lastGame = new Chess();
            lastGame.load(lastStep.fen);
            setGame(lastGame);

            setEditingStepIndex(null);
            setCurrentDescription("");
            setCurrentArrows([]);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("pgn", game.pgn());
        formData.append("steps", JSON.stringify(steps));

        try {
            await updateOpening(opening.id, formData);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error(error);
            alert("Failed to update opening");
            setIsSubmitting(false);
        }
    }

    const handleCancel = () => {
        if (hasUnsavedChanges) {
            if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
                router.push("/openings");
            }
        } else {
            router.push("/openings");
        }
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Board and Controls */}
                <div className="space-y-4">
                    <div className="aspect-square w-full max-w-[500px] mx-auto border-4 border-gray-800 rounded-lg overflow-hidden shadow-xl">
                        <Chessboard
                            key={`editor-${JSON.stringify(currentArrows)}-${game.fen()}`}
                            options={{
                                id: "editor-board",
                                position: game.fen(),
                                onPieceDrop: onPieceDrop,
                                onSquareRightClick: handleSquareRightClick,
                                arrows: currentArrows,
                                boardOrientation: "white",
                                allowDrawingArrows: false,
                                squareStyles: rightClickStart ? {
                                    [rightClickStart]: { backgroundColor: "rgba(255, 255, 0, 0.5)" }
                                } : undefined
                            } as any}
                        />
                    </div>
                    <div className="text-sm text-gray-500 text-center">
                        <strong>Right-click</strong> a square to start an arrow, then <strong>right-click</strong> another to end it.
                        <br />
                        Move pieces to set the position for this step.
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
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={addStep}
                                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 min-w-[100px]"
                            >
                                {editingStepIndex !== null ? "Update Step" : "Add Step"}
                            </button>
                            {editingStepIndex !== null && (
                                <>
                                    <button
                                        type="button"
                                        onClick={resetToPreviousStep}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                        title="Reset board to the position before this step to make a new move"
                                    >
                                        Redo Move
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                    >
                                        Cancel Edit
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setGame(new Chess());
                                    setCurrentArrows([]);
                                    setCurrentDescription("");
                                    setEditingStepIndex(null);
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
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Steps ({steps.length})</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={goToPreviousStep}
                                    disabled={steps.length === 0 || editingStepIndex === 0}
                                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Previous Step"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m15 18-6-6 6-6" />
                                    </svg>
                                </button>
                                <button
                                    onClick={goToNextStep}
                                    disabled={editingStepIndex === null}
                                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Next Step"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            {steps.map((step, index) => (
                                <div
                                    key={index}
                                    className={`border p-3 rounded flex justify-between items-start gap-4 ${editingStepIndex === index
                                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                        : 'dark:border-gray-700'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium">
                                            Step {index + 1}
                                            {editingStepIndex === index && (
                                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Editing)</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate">{step.fen}</div>
                                        <div className="text-sm mt-1">{step.description}</div>
                                        {step.arrows.length > 0 && (
                                            <div className="text-xs text-green-600 mt-1">
                                                {step.arrows.length} arrows
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => editStep(index)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2"
                                            disabled={editingStepIndex === index}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => removeStep(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {steps.length === 0 && (
                                <div className="text-gray-500 text-center py-4">
                                    No steps added yet.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || steps.length === 0 || !name}
                            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Saving..." : "Update Opening"}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={isSubmitting}
                            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-bold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
