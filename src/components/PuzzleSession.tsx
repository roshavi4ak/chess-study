"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import PuzzleSolver from "./PuzzleSolver";
import PuzzleDifficultySettings from "@/components/PuzzleDifficultySettings";

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

const SESSION_KEY = "puzzleSession";
const SESSION_CHANGED = "puzzleSessionChanged";

function subscribeToSession(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === SESSION_KEY || event.key === null) onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_CHANGED, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(SESSION_CHANGED, onChange);
    };
}

const getSessionSnapshot = () => sessionStorage.getItem(SESSION_KEY) || "[]";
const getServerSnapshot = () => "[]";

function parseSession(stored: string): SolvedPuzzle[] {
    try {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is SolvedPuzzle =>
            item !== null && typeof item === "object" &&
            typeof item.name === "string" &&
            (item.result === "success" || item.result === "mistake" || item.result === "hint")
        );
    } catch (error) {
        console.warn("Failed to parse puzzleSession from sessionStorage.", error);
        return [];
    }
}

export default function PuzzleSession({ id, currentPuzzleName, fen, solution, hints, tag }: PuzzleSessionProps) {
    const storedSession = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getServerSnapshot);
    const solvedPuzzles = useMemo(() => parseSession(storedSession), [storedSession]);

    const handleSolve = (result: "success" | "mistake" | "hint") => {
        const newSolved = parseSession(getSessionSnapshot()).map(puzzle => ({ ...puzzle }));
        const existingIndex = newSolved.findIndex(p => p.id === id || p.name === currentPuzzleName);

        if (existingIndex !== -1) {
            // Requirement #3: If user goes back to solve a puzzle in red and solves it correctly, change color to green
            const prevResult = newSolved[existingIndex].result;
            if (result === "success" && (prevResult === "mistake" || prevResult === "hint")) {
                newSolved[existingIndex].result = "success";
                // Ensure id is also set/updated for migration from name-only storage
                newSolved[existingIndex].id = id;
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSolved));
                window.dispatchEvent(new Event(SESSION_CHANGED));
            }
        } else {
            newSolved.push({ id, name: currentPuzzleName, result });
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(newSolved));
            window.dispatchEvent(new Event(SESSION_CHANGED));
        }
    };

    return (
        <div className="space-y-8">
            <PuzzleDifficultySettings />
            {/* Timeline */}
            <div className="w-full max-w-[250px] md:max-w-2xl mx-auto">
                <div className="flex items-center gap-2 overflow-x-auto p-2 pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {solvedPuzzles.map((p, i) => (
                        <Link
                            key={p.id || p.name}
                            href={{ pathname: `/puzzles/${p.name}`, query: tag ? { tag } : undefined }}
                            prefetch={false}
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
                key={id}
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

