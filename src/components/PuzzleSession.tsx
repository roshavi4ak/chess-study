"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import PuzzleSolver from "./PuzzleSolver";

interface SolvedPuzzle {
    name: string;
    result: "success" | "mistake" | "hint";
}

interface PuzzleSessionProps {
    currentPuzzleName: string;
    fen: string;
    solution: string;
    hints: string[];
    tag?: string;
}

export default function PuzzleSession({ currentPuzzleName, fen, solution, hints, tag }: PuzzleSessionProps) {
    const [solvedPuzzles, setSolvedPuzzles] = useState<SolvedPuzzle[]>([]);

    useEffect(() => {
        // Load session from sessionStorage
        const stored = sessionStorage.getItem("puzzleSession");
        if (stored) {
            setSolvedPuzzles(JSON.parse(stored));
        } else {
            // New session
            sessionStorage.setItem("puzzleSession", JSON.stringify([]));
        }
    }, []);

    const handleSolve = (result: "success" | "mistake" | "hint") => {
        const newSolved = [...solvedPuzzles];
        // Check if already added to avoid duplicates if user solves again without navigating
        if (!newSolved.find(p => p.name === currentPuzzleName)) {
            newSolved.push({ name: currentPuzzleName, result });
            setSolvedPuzzles(newSolved);
            sessionStorage.setItem("puzzleSession", JSON.stringify(newSolved));
        }
    };

    return (
        <div className="space-y-8">
            {/* Timeline */}
            <div className="flex items-center gap-2 overflow-x-auto p-2 pb-4">
                {solvedPuzzles.map((p, i) => (
                    <Link
                        key={i}
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

            {/* Puzzle Solver */}
            <PuzzleSolver
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

