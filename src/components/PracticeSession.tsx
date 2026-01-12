"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { saveLineProgress } from "@/app/actions/progress";

interface PracticeNode {
    id: string;
    fen: string;
    move: string | null;
    notes: string | null;
    children: PracticeNode[];
}

interface LineProgress {
    lineSignature: string;
    status: "PERFECT" | "COMPLETED" | "PARTIAL" | "NEVER_SEEN";
    attempts: number;
    perfectCount: number;
}

interface PracticeSessionProps {
    practice: {
        id: string;
        name: string;
        description: string | null;
        playerColor: "WHITE" | "BLACK";
        creatorName: string | null;
        tree: PracticeNode;
    };
    initialProgress: LineProgress[];
}

// Get all possible lines (paths from root to leaves)
function getAllLines(node: PracticeNode, currentPath: string[] = []): string[][] {
    const path = [...currentPath, node.id];

    if (node.children.length === 0) {
        return [path];
    }

    const lines: string[][] = [];
    for (const child of node.children) {
        lines.push(...getAllLines(child, path));
    }
    return lines;
}

// Get line signature from path (for tracking)
function getLineSignature(path: string[]): string {
    return path.join(",");
}

import { useTranslations } from "next-intl";

export default function PracticeSession({ practice, initialProgress }: PracticeSessionProps) {
    const t = useTranslations("Practice");
    const commonT = useTranslations("Common");
    const [game, setGame] = useState(new Chess());
    const [currentNode, setCurrentNode] = useState<PracticeNode>(practice.tree);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [nodePath, setNodePath] = useState<string[]>([practice.tree.id]);
    const [feedback, setFeedback] = useState<{ type: "incorrect" | "complete" | "note" | null; message: string }>({ type: null, message: "" });
    const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});

    // Track wrong moves and session stats
    const [hadWrongMoves, setHadWrongMoves] = useState(false);
    const [sessionLinesCompleted, setSessionLinesCompleted] = useState(0);
    const [sessionLinesPerfect, setSessionLinesPerfect] = useState(0);

    // Progress tracking from DB
    const [progressMap, setProgressMap] = useState<Map<string, LineProgress>>(new Map());
    const [currentLineFirstTime, setCurrentLineFirstTime] = useState(true);

    // All available lines
    const allLines = useMemo(() => getAllLines(practice.tree), [practice.tree]);

    // Initialize progress map from DB
    useEffect(() => {
        const map = new Map<string, LineProgress>();
        initialProgress.forEach(p => map.set(p.lineSignature, p));
        setProgressMap(map);
    }, [initialProgress]);

    // Initialize game position
    useEffect(() => {
        startNewLine();
    }, [practice]);

    // Determine whose turn it is
    function getCurrentTurn(fen: string): "WHITE" | "BLACK" {
        const g = new Chess(fen);
        return g.turn() === "w" ? "WHITE" : "BLACK";
    }

    function isOpponentTurn(fen: string): boolean {
        return getCurrentTurn(fen) !== practice.playerColor;
    }

    function isStudentTurn(): boolean {
        return !isOpponentTurn(game.fen());
    }

    // Highlight last move
    function highlightMove(from: string, to: string) {
        setHighlightSquares({
            [from]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
            [to]: { backgroundColor: "rgba(255, 255, 0, 0.6)" },
        });
    }

    // Get priority lines to practice
    function getPriorityLines(): string[][] {
        // Priority 1: Never seen lines
        const neverSeen = allLines.filter(line => !progressMap.has(getLineSignature(line)));
        if (neverSeen.length > 0) return neverSeen;

        // Priority 2: Partial lines
        const partial = allLines.filter(line => {
            const prog = progressMap.get(getLineSignature(line));
            return prog?.status === "PARTIAL";
        });
        if (partial.length > 0) return partial;

        // Priority 3: Completed but not perfect
        const completed = allLines.filter(line => {
            const prog = progressMap.get(getLineSignature(line));
            return prog?.status === "COMPLETED";
        });
        if (completed.length > 0) return completed;

        // All lines reviewed - return all for practice
        return allLines;
    }

    // Start a new line, prioritizing unseen/incomplete lines
    function startNewLine(previousLineSignature?: string) {
        const newGame = new Chess(practice.tree.fen);
        setGame(newGame);
        setCurrentNode(practice.tree);
        setMoveHistory([]);
        setNodePath([practice.tree.id]);
        setFeedback({ type: null, message: "" });
        setHighlightSquares({});
        setHadWrongMoves(false);

        // Determine if this will be a first-time line
        const priorityLines = getPriorityLines();
        if (priorityLines.length > 0) {
            const candidateLine = priorityLines[Math.floor(Math.random() * priorityLines.length)];
            const sig = getLineSignature(candidateLine);
            setCurrentLineFirstTime(!progressMap.has(sig));
        }

        // If opponent moves first, pick a move toward priority lines
        if (isOpponentTurn(practice.tree.fen)) {
            const children = practice.tree.children;
            if (children.length > 0) {
                // Score children by priority lines
                const childScores = children.map(child => {
                    const linesThrough = priorityLines.filter(line => line[1] === child.id);
                    return { child, score: linesThrough.length };
                });
                childScores.sort((a, b) => b.score - a.score);

                const topChildren = childScores.filter(c => c.score === childScores[0].score);
                const selected = topChildren[Math.floor(Math.random() * topChildren.length)].child;

                executeOpponentMove(practice.tree, selected, [], [practice.tree.id]);
            }
        }
    }

    // Execute opponent move
    function executeOpponentMove(parentNode: PracticeNode, childNode: PracticeNode, history: string[], path: string[]) {
        const gameCopy = new Chess(parentNode.fen);

        if (childNode.move) {
            const from = childNode.move.slice(0, 2) as Square;
            const to = childNode.move.slice(2, 4) as Square;
            const promotion = childNode.move[4] as "q" | "r" | "b" | "n" | undefined;

            try {
                const move = gameCopy.move({ from, to, promotion });
                if (move) {
                    const newHistory = [...history, move.san];
                    const newPath = [...path, childNode.id];

                    setGame(new Chess(gameCopy.fen()));
                    setMoveHistory(newHistory);
                    setCurrentNode(childNode);
                    setNodePath(newPath);
                    highlightMove(from, to);

                    // Show notes only if first-time line
                    if (childNode.notes && currentLineFirstTime) {
                        setFeedback({ type: "note", message: `💡 ${childNode.notes}` });
                    } else {
                        setFeedback({ type: null, message: "" });
                    }

                    if (childNode.children.length === 0) {
                        handleLineComplete(newPath);
                    }
                }
            } catch (e) {
                console.error("Error making opponent move:", e);
            }
        }
    }

    // Make opponent move, prioritizing priority lines
    function makeOpponentMove(node: PracticeNode, history: string[], path: string[]) {
        if (node.children.length === 0) {
            handleLineComplete(path);
            return;
        }

        let selectedChild: PracticeNode;

        if (node.children.length > 1) {
            const priorityLines = getPriorityLines();

            const childScores = node.children.map(child => {
                const linesThrough = priorityLines.filter(line => {
                    const idx = line.indexOf(node.id);
                    return idx !== -1 && line[idx + 1] === child.id;
                });
                return { child, score: linesThrough.length };
            });

            childScores.sort((a, b) => b.score - a.score);
            const maxScore = childScores[0].score;
            const topChildren = childScores.filter(c => c.score === maxScore);
            selectedChild = topChildren[Math.floor(Math.random() * topChildren.length)].child;
        } else {
            selectedChild = node.children[0];
        }

        executeOpponentMove(node, selectedChild, history, path);
    }

    // Handle line completion
    async function handleLineComplete(finalPath: string[]) {
        const lineSignature = getLineSignature(finalPath);

        // Update session stats
        setSessionLinesCompleted(prev => prev + 1);
        if (!hadWrongMoves) {
            setSessionLinesPerfect(prev => prev + 1);
        }

        // Update progress map locally
        const existingProgress = progressMap.get(lineSignature);
        const newProgress: LineProgress = {
            lineSignature,
            status: hadWrongMoves ? "COMPLETED" : "PERFECT",
            attempts: (existingProgress?.attempts || 0) + 1,
            perfectCount: (existingProgress?.perfectCount || 0) + (hadWrongMoves ? 0 : 1),
        };
        setProgressMap(prev => new Map(prev).set(lineSignature, newProgress));

        setFeedback({
            type: "complete",
            message: hadWrongMoves
                ? t("lineCompletedMistakes")
                : t("lineCompletedFlawlessly")
        });

        // Save progress to database
        try {
            await saveLineProgress({
                practiceId: practice.id,
                lineSignature,
                hadWrongMoves,
                completed: true,
            });
        } catch (e) {
            console.error("Failed to save progress:", e);
        }
    }

    // Handle student's move
    function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: Square, targetSquare: Square }) {
        if (!isStudentTurn()) return false;

        const uciMove = `${sourceSquare}${targetSquare}`;

        const matchingChild = currentNode.children.find(child =>
            child.move?.startsWith(uciMove)
        );

        if (!matchingChild) {
            // WRONG MOVE - Show coach notes immediately for the correct move
            setHadWrongMoves(true);

            // Try to find helpful notes in multiple places:
            // 1. Notes on any of the correct children (the moves they should make)
            const childWithNotes = currentNode.children.find(c => c.notes && c.notes.trim() !== "");
            // 2. Notes on the current node (might describe what to do here)
            const currentNodeNotes = currentNode.notes && currentNode.notes.trim() !== "" ? currentNode.notes : null;
            // 3. Show the correct move itself as a hint
            const firstChild = currentNode.children[0];

            if (childWithNotes?.notes) {
                setFeedback({
                    type: "incorrect",
                    message: t("wrongMoveHint", { hint: childWithNotes.notes })
                });
            } else if (currentNodeNotes) {
                setFeedback({
                    type: "incorrect",
                    message: t("wrongMoveHint", { hint: currentNodeNotes })
                });
            } else if (firstChild?.move) {
                // Show the correct move as last resort hint
                const from = firstChild.move.slice(0, 2);
                const to = firstChild.move.slice(2, 4);
                setFeedback({
                    type: "incorrect",
                    message: t("wrongMoveTryMoving", { from, to })
                });
            } else {
                setFeedback({ type: "incorrect", message: t("wrongMoveTryAgain") });
            }
            return false;
        }

        // CORRECT MOVE
        const gameCopy = new Chess(game.fen());

        try {
            const promotion = matchingChild.move && matchingChild.move[4] as "q" | "r" | "b" | "n" | undefined;
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: promotion || "q",
            });

            if (move) {
                const newHistory = [...moveHistory, move.san];
                const newPath = [...nodePath, matchingChild.id];

                setGame(new Chess(gameCopy.fen()));
                setMoveHistory(newHistory);
                setCurrentNode(matchingChild);
                setNodePath(newPath);
                highlightMove(sourceSquare, targetSquare);

                // Check if practice is complete
                if (matchingChild.children.length === 0) {
                    handleLineComplete(newPath);
                    return true;
                }

                // Show notes ONLY if first-time line AND no mistakes made yet
                // (If they made a mistake, they already saw the hint)
                if (matchingChild.notes && currentLineFirstTime && !hadWrongMoves) {
                    setFeedback({ type: "note", message: `💡 ${matchingChild.notes}` });
                } else {
                    setFeedback({ type: null, message: "" });
                }

                // Make opponent's move
                makeOpponentMove(matchingChild, newHistory, newPath);

                return true;
            }
        } catch (e) {
            console.error("Error processing move:", e);
        }

        return false;
    }

    // Restart practice
    function handleRestart() {
        const currentLineSignature = getLineSignature(nodePath);
        startNewLine(currentLineSignature);
    }

    // Calculate progress stats
    const totalLines = allLines.length;
    const neverSeenCount = allLines.filter(line => !progressMap.has(getLineSignature(line))).length;
    const partialCount = allLines.filter(line => progressMap.get(getLineSignature(line))?.status === "PARTIAL").length;
    const completedCount = allLines.filter(line => progressMap.get(getLineSignature(line))?.status === "COMPLETED").length;
    const perfectCount = allLines.filter(line => progressMap.get(getLineSignature(line))?.status === "PERFECT").length;
    const totalSeen = totalLines - neverSeenCount;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Board */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="aspect-square w-full max-w-[600px] mx-auto border-4 border-gray-800 rounded-lg overflow-hidden shadow-xl">
                        <Chessboard
                            key={`session-${game.fen()}`}
                            options={{
                                id: "practice-session-board",
                                position: game.fen(),
                                onPieceDrop: onPieceDrop,
                                boardOrientation: practice.playerColor.toLowerCase() as "white" | "black",
                                squareStyles: highlightSquares,
                                arePiecesDraggable: isStudentTurn() && feedback.type !== "complete",
                            } as any}
                        />
                    </div>

                    {/* Feedback */}
                    {feedback.message && (
                        <div className={`p-4 rounded-lg text-center text-lg font-medium ${feedback.type === "incorrect" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
                            feedback.type === "complete" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" :
                                "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}>
                            {feedback.message}
                        </div>
                    )}
                </div>

                {/* Side Panel */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-2">{practice.name}</h2>
                        {practice.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                                {practice.description}
                            </p>
                        )}
                        <div className="text-sm text-gray-500">
                            {t("playingAs")}: <span className="font-medium">{practice.playerColor === "WHITE" ? commonT("white") : commonT("black")}</span>
                        </div>
                    </div>

                    {/* Overall Progress */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="font-medium mb-3">{t("overallProgress")}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>{t("totalLines")}:</span>
                                <span className="font-medium">{totalLines}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("linesSeen")}:</span>
                                <span className="font-medium text-blue-600">{totalSeen} / {totalLines}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("perfect")}:</span>
                                <span className="font-medium text-green-600">{perfectCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("completedMistakes")}:</span>
                                <span className="font-medium text-yellow-600">{completedCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("neverSeen")}:</span>
                                <span className="font-medium text-gray-500">{neverSeenCount}</span>
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300"
                                    style={{ width: `${totalLines > 0 ? (totalSeen / totalLines) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Session Stats */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="font-medium mb-3">{t("thisSession")}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>{t("linesCompleted")}:</span>
                                <span className="font-medium text-green-600">{sessionLinesCompleted}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t("perfectNoMistakes")}:</span>
                                <span className="font-medium text-blue-600">{sessionLinesPerfect}</span>
                            </div>
                        </div>
                    </div>

                    {/* Move History */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="font-medium mb-2">{t("moveHistory")}</h3>
                        <div className="text-sm max-h-[120px] overflow-y-auto">
                            {moveHistory.length === 0 ? (
                                <p className="text-gray-500">{t("noMovesYet")}</p>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {moveHistory.map((move, index) => (
                                        <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                            {index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ""} {move}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleRestart}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
                    >
                        {feedback.type === "complete"
                            ? (neverSeenCount > 0 ? t("nextLineCount", { count: neverSeenCount }) : t("practiceAgain"))
                            : t("restartPractice")
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
