"use client";

import { useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";

interface Arrow {
    startSquare: string;
    endSquare: string;
    color: string;
}

interface Step {
    id: string;
    fen: string;
    arrows: string | null;
    description: string | null;
    order: number;
}

interface OpeningStepViewerProps {
    steps: Step[];
}

export default function OpeningStepViewer({ steps }: OpeningStepViewerProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // Sort steps by order just in case
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
    const currentStep = sortedSteps[currentStepIndex];

    const handleNext = useCallback(() => {
        if (currentStepIndex < sortedSteps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        }
    }, [currentStepIndex, sortedSteps.length]);

    const handlePrev = useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    }, [currentStepIndex]);

    // Keyboard navigation
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.code === "Space" || e.key === "ArrowRight") {
                e.preventDefault(); // Prevent scrolling for space
                handleNext();
            } else if (e.key === "ArrowLeft") {
                handlePrev();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleNext, handlePrev]);

    // Parse arrows
    let arrows: Arrow[] = [];
    try {
        if (currentStep?.arrows) {
            arrows = JSON.parse(currentStep.arrows);
        }
    } catch (e) {
        console.error("Failed to parse arrows", e);
    }

    if (!currentStep) {
        return <div>No steps found for this opening.</div>;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center max-w-6xl mx-auto">
            {/* Chessboard */}
            <div className="w-full max-w-[600px] aspect-square shadow-2xl rounded-lg overflow-hidden border-4 border-[#8b5a2b]">
                <Chessboard
                    key={currentStepIndex}
                    options={{
                        id: "viewer-board",
                        position: currentStep.fen,
                        arrows: arrows,
                        arePiecesDraggable: false,
                        boardOrientation: "white",
                    } as any}
                />
            </div>

            {/* Sidebar / Description */}
            <div className="flex-1 space-y-8 max-w-md">
                {/* Description Bubble */}
                <div className="relative bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white dark:bg-gray-800 rotate-45 border-l border-b border-gray-200 dark:border-gray-700 hidden lg:block"></div>
                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-white dark:bg-gray-800 rotate-45 border-r border-b border-gray-200 dark:border-gray-700 lg:hidden"></div>

                    <div className="relative z-10 text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                        {currentStep.description || "No description for this step."}
                    </div>

                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-4">
                    <button
                        onClick={handleNext}
                        disabled={currentStepIndex === sortedSteps.length - 1}
                        className="flex-1 bg-[#6da741] hover:bg-[#5d9136] text-white text-2xl font-bold py-6 px-8 rounded-xl shadow-lg transform transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex flex-col items-center"
                    >
                        <span className="flex items-center gap-2">
                            ▶ Next
                        </span>
                        <span className="text-sm font-normal opacity-80">
                            &lt;space&gt;
                        </span>
                    </button>

                    {/* Octopus Mascot */}
                    <div className="text-8xl animate-bounce-slow">
                        🐙
                    </div>
                </div>

                {/* Progress */}
                <div className="text-center text-gray-500">
                    Step {currentStepIndex + 1} of {sortedSteps.length}
                </div>

                {currentStepIndex > 0 && (
                    <button
                        onClick={handlePrev}
                        className="w-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                    >
                        Back to previous step
                    </button>
                )}
            </div>
        </div>
    );
}
