"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import PuzzleSolver from "./PuzzleSolver";

interface SolvedPuzzle {
    id: string;
    name: string;
    result: "success" | "mistake" | "hint";
}

interface PuzzleSessionProps {
    id: string;
    currentPuzzleName: string;
    fen: string;
    solution: string;
    hints: string[];
    tag?: string;
}

export default function PuzzleSession({ id, currentPuzzleName, fen, solution, hints, tag }: PuzzleSessionProps) {
    const [solvedPuzzles, setSolvedPuzzles] = useState<SolvedPuzzle[]>([]);

    useEffect(() => {
        // Load session from sessionStorage
        const stored = sessionStorage.getItem("puzzleSession");
        if (stored) {
            try {
                setSolvedPuzzles(JSON.parse(stored));
            } catch (error) {
                console.warn("Failed to parse 'puzzleSession' from sessionStorage. Falling back to default.", { error, stored });
                sessionStorage.removeItem("puzzleSession");
                setSolvedPuzzles([]);
            }
        } else {
            // New session
            sessionStorage.setItem("puzzleSession", JSON.stringify([]));
        }
    }, []);

    const handleSolve = (result: "success" | "mistake" | "hint") => {
        const newSolved = [...solvedPuzzles];
        const existingIndex = newSolved.findIndex(p => p.id === id || p.name === currentPuzzleName);

        if (existingIndex !== -1) {
            // Requirement #3: If user goes back to solve a puzzle in red and solves it correctly, change color to green
            const prevResult = newSolved[existingIndex].result;
            if (result === "success" && (prevResult === "mistake" || prevResult === "hint")) {
                newSolved[existingIndex].result = "success";
                // Ensure id is also set/updated for migration from name-only storage
                newSolved[existingIndex].id = id;
                setSolvedPuzzles(newSolved);
                sessionStorage.setItem("puzzleSession", JSON.stringify(newSolved));
            }
        } else {
            newSolved.push({ id, name: currentPuzzleName, result });
            setSolvedPuzzles(newSolved);
            sessionStorage.setItem("puzzleSession", JSON.stringify(newSolved));
        }
    };

    return (
        <div className="space-y-8">
            {/* Timeline */}
            <div className="w-full max-w-[250px] md:max-w-2xl mx-auto">
                <div className="flex items-center gap-2 overflow-x-auto p-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {solvedPuzzles.map((p, i) => (
                        <Link
                            key={p.id || p.name}
                            href={`/puzzles/${p.name}${tag ? `?tag=${tag}` : ''}`}
                            className={cn(
                                "w-8 h-8 flex-shrink-0 rounded flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-110",
                                p.result === "success" && "bg-green-500",
                                p.result === "mistake" && "bg-red-500",
                                p.result === "hint" && "bg-yellow-500"
                            )}
                            title={p.name}
                        >
                            {i + 1}
                        </Link>
                    ))}
                    <div className={cn(
                        "w-8 h-8 flex-shrink-0 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400",
                        "bg-gray-50"
                    )}>
                        {solvedPuzzles.length + 1}
                    </div>
                </div>
            </div>

            {/* Puzzle Solver */}
            <PuzzleSolver
                id={id}
                fen={fen}
                solution={solution}
                hints={hints}
                name={currentPuzzleName}
                onSolve={handleSolve}
                tag={tag}
            />
        </div>
    );
}

