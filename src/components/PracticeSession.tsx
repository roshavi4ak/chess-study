"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { saveLineProgress, getPracticeProgress } from "@/app/actions/progress";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { useTranslations } from "next-intl";

interface PracticeNode {
    id: string;
    fen: string;
    move: string | null;
    notes: string | null;
    lineNumber: number | null;
    children: PracticeNode[];
}

interface LineProgress {
    nodeId: string;
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

function getAllLeafNodes(node: PracticeNode): PracticeNode[] {
    if (node.children.length === 0) return [node];
    const leaves: PracticeNode[] = [];
    for (const child of node.children) {
        leaves.push(...getAllLeafNodes(child));
    }
    return leaves;
}

function getLeafDescendants(node: PracticeNode): PracticeNode[] {
    return getAllLeafNodes(node);
}

export default function PracticeSession({ practice, initialProgress }: PracticeSessionProps) {
    const t = useTranslations("Practice");
    const commonT = useTranslations("Common");
    const [game, setGame] = useState(new Chess());
    const [currentNode, setCurrentNode] = useState<PracticeNode>(practice.tree);
    const [targetLine, setTargetLine] = useState<PracticeNode | null>(null);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [nodePath, setNodePath] = useState<string[]>([practice.tree.id]);
    const [sessionCompletedIds, setSessionCompletedIds] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<{ type: "incorrect" | "complete" | "note" | null; message: string }>({ type: null, message: "" });
    const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});
    const [showCoachHints, setShowCoachHints] = useState(false);
    const [hintsMessage, setHintsMessage] = useState("");

    const handleMove = (move: { from: string; to: string; promotion?: string }) => {
        const { from, to, promotion = 'q' } = move;
        setOptionSquares({});
        if (!isStudentTurn() || feedback.type === 'complete') return false;
        if (from === to) return false;

        const uciMove = `${from}${to}`;
        const matchingChild = currentNode.children.find(child => child.move?.startsWith(uciMove));

        if (!matchingChild) {
            setHadWrongMoves(true);
            const childWithNotes = currentNode.children.find(c => c.notes && c.notes.trim() !== "");
            const currentNodeNotes = currentNode.notes && currentNode.notes.trim() !== "" ? currentNode.notes : null;
            const firstChild = currentNode.children[0];

            if (childWithNotes?.notes) {
                setFeedback({ type: "incorrect", message: t("wrongMoveHint", { hint: childWithNotes.notes }) });
            } else if (currentNodeNotes) {
                setFeedback({ type: "incorrect", message: t("wrongMoveHint", { hint: currentNodeNotes }) });
            } else if (firstChild?.move) {
                const f = firstChild.move.slice(0, 2);
                const tStr = firstChild.move.slice(2, 4);
                setFeedback({ type: "incorrect", message: t("wrongMoveTryMoving", { from: f, to: tStr }) });
            } else {
                setFeedback({ type: "incorrect", message: t("wrongMoveTryAgain") });
            }
            return false;
        }

        const gameResult = new Chess(game.fen());
        try {
            const finalPromotion = matchingChild.move && matchingChild.move[4] as "q" | "r" | "b" | "n" | undefined;
            const moveResult = gameResult.move({ from, to, promotion: finalPromotion || promotion });

            if (moveResult) {
                const newHistory = [...moveHistory, moveResult.san];
                const newPath = [...nodePath, matchingChild.id];
                setGame(new Chess(gameResult.fen()));
                setMoveHistory(newHistory);
                setCurrentNode(matchingChild);
                setNodePath(newPath);
                highlightMove(from, to);

                if (matchingChild.children.length === 0) {
                    handleLineComplete(newPath);
                    return true;
                }

                if (matchingChild.notes && currentLineFirstTime && !hadWrongMoves) {
                    setFeedback({ type: "note", message: `💡 ${matchingChild.notes}` });
                } else {
                    setFeedback({ type: null, message: "" });
                }

                makeOpponentMove(matchingChild, newHistory, newPath);
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    };

    const { onSquareClick, onPieceClick, optionSquares, setOptionSquares, onPieceDrop } = useLegalMoves({
        game,
        onMove: handleMove
    });

    const [hadWrongMoves, setHadWrongMoves] = useState(false);
    const [sessionLinesCompleted, setSessionLinesCompleted] = useState(0);
    const [sessionLinesPerfect, setSessionLinesPerfect] = useState(0);
    const [progressMap, setProgressMap] = useState<Map<string, LineProgress>>(() => {
        const map = new Map<string, LineProgress>();
        const leafNodes = getAllLeafNodes(practice.tree);
        const validNodeIds = new Set(leafNodes.map(node => node.id));
        initialProgress.forEach(p => {
            if (validNodeIds.has(p.nodeId)) {
                map.set(p.nodeId, p);
            }
        });
        return map;
    });

    const [currentLineFirstTime, setCurrentLineFirstTime] = useState(true);
    const allLeafNodes = useMemo(() => getAllLeafNodes(practice.tree), [practice.tree]);

    useEffect(() => {
        setHintsMessage(showCoachHints ? (currentNode.notes || "") : "");
    }, [showCoachHints, currentNode.notes]);

    useEffect(() => {
        startNewLine();
    }, []);



    function getCurrentTurn(fen: string): "WHITE" | "BLACK" {
        return new Chess(fen).turn() === "w" ? "WHITE" : "BLACK";
    }

    function isOpponentTurn(fen: string): boolean {
        return getCurrentTurn(fen) !== practice.playerColor;
    }

    function isStudentTurn(): boolean {
        return !isOpponentTurn(game.fen());
    }

    function highlightMove(from: string, to: string) {
        setHighlightSquares({
            [from]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
            [to]: { backgroundColor: "rgba(255, 255, 0, 0.6)" },
        });
    }

    function getPriorityLines(): { lines: PracticeNode[]; priority: 'unseen' | 'not_perfect' | 'all' } {
        // Priority 1: Unseen lines
        const unseenLines = allLeafNodes.filter(node => !progressMap.has(node.id));
        const unseenNotDoneThisSession = unseenLines.filter(node => !sessionCompletedIds.has(node.id));

        if (unseenNotDoneThisSession.length > 0) {
            unseenNotDoneThisSession.sort((a, b) => {
                if (a.lineNumber === null && b.lineNumber === null) return 0;
                if (a.lineNumber === null) return 1;
                if (b.lineNumber === null) return -1;
                return a.lineNumber - b.lineNumber;
            });
            return { lines: unseenNotDoneThisSession, priority: 'unseen' };
        }

        // Priority 2: Seen but not perfect lines
        const notPerfectLines = allLeafNodes.filter(node => {
            const progress = progressMap.get(node.id);
            return progress && progress.status !== "PERFECT";
        });
        const notPerfectNotDoneThisSession = notPerfectLines.filter(node => !sessionCompletedIds.has(node.id));

        if (notPerfectNotDoneThisSession.length > 0) {
            notPerfectNotDoneThisSession.sort((a, b) => {
                const progressA = progressMap.get(a.id);
                const progressB = progressMap.get(b.id);
                return (progressA?.perfectCount || 0) - (progressB?.perfectCount || 0);
            });
            return { lines: notPerfectNotDoneThisSession, priority: 'not_perfect' };
        }

        // Priority 3: All lines (cycling through perfect lines)
        const perfectNotDoneThisSession = allLeafNodes.filter(node => !sessionCompletedIds.has(node.id));

        if (perfectNotDoneThisSession.length > 0) {
            return { lines: perfectNotDoneThisSession, priority: 'all' };
        }

        // If we reach here, it means EVERY line in the practice has been done THIS SESSION.
        // Reset the session cycle and start over.
        setSessionCompletedIds(new Set());

        // Return unseen again if they exist, or fallback to all
        if (unseenLines.length > 0) return { lines: unseenLines, priority: 'unseen' };
        if (notPerfectLines.length > 0) return { lines: notPerfectLines, priority: 'not_perfect' };
        return { lines: allLeafNodes, priority: 'all' };
    }

    function startNewLine(previousLineSignature?: string) {
        const newGame = new Chess(practice.tree.fen);
        setGame(newGame);
        setCurrentNode(practice.tree);
        setMoveHistory([]);
        setNodePath([practice.tree.id]);
        setFeedback({ type: null, message: "" });
        setHighlightSquares({});
        setHadWrongMoves(false);
        setShowCoachHints(false);
        setHintsMessage("");

        const { lines: priorityLines, priority } = getPriorityLines();
        if (priorityLines.length > 0) {
            // For unseen and not_perfect: pick the first one from the sorted list
            // For 'all' (random mode): pick randomly
            const candidateLine = priority === 'all'
                ? priorityLines[Math.floor(Math.random() * priorityLines.length)]
                : priorityLines[0];

            console.log(`[DEBUG] Selected line for practice (${priority}):`, candidateLine.id, "lineNumber:", candidateLine.lineNumber, "perfectCount:", progressMap.get(candidateLine.id)?.perfectCount || 0);

            setTargetLine(candidateLine);
            const sig = candidateLine.id;
            setCurrentLineFirstTime(!progressMap.has(sig));
        }

        if (isOpponentTurn(practice.tree.fen)) {
            const children = practice.tree.children;
            if (children.length > 0) {
                const childScores = children.map(child => {
                    const leavesThrough = getLeafDescendants(child).filter(leaf => priorityLines.includes(leaf));
                    return { child, score: leavesThrough.length };
                });
                childScores.sort((a, b) => b.score - a.score);

                // If we have a target line, see if any child leads to it
                const targetFirst = childScores.find(s => targetLine && getLeafDescendants(s.child).some(leaf => leaf.id === targetLine.id));
                const selected = targetFirst ? targetFirst.child : childScores[0].child;

                executeOpponentMove(practice.tree, selected, [], [practice.tree.id]);
            }
        }
    }

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
                    if (childNode.notes && currentLineFirstTime) {
                        setFeedback({ type: "note", message: `💡 ${childNode.notes}` });
                    } else {
                        setFeedback({ type: null, message: "" });
                    }
                    if (childNode.children.length === 0) handleLineComplete(newPath);
                }
            } catch (e) { console.error(e); }
        }
    }

    function makeOpponentMove(node: PracticeNode, history: string[], path: string[]) {
        if (node.children.length === 0) {
            handleLineComplete(path);
            return;
        }
        let selectedChild: PracticeNode;
        if (node.children.length > 1) {
            const { lines: priorityLines } = getPriorityLines();
            const childScores = node.children.map(child => {
                const leavesThrough = getLeafDescendants(child).filter(leaf => priorityLines.includes(leaf));
                return { child, score: leavesThrough.length };
            });
            childScores.sort((a, b) => b.score - a.score);

            // Prioritize the target line if it's reachable through one of these children
            const targetFirst = childScores.find(s => targetLine && getLeafDescendants(s.child).some(leaf => leaf.id === targetLine.id));
            selectedChild = targetFirst ? targetFirst.child : childScores[0].child;

            console.log("[DEBUG] Selected opponent move child:", selectedChild.id, "fen:", selectedChild.fen);
        } else {
            selectedChild = node.children[0];
        }
        executeOpponentMove(node, selectedChild, history, path);
    }

    async function handleLineComplete(finalPath: string[]) {
        const nodeId = finalPath[finalPath.length - 1]; // Use the actual leaf node ID
        const leafNode = allLeafNodes.find(n => n.id === nodeId);

        // Determine if coach notes were visible at any point during this line
        const coachNotesVisible = showCoachHints || currentLineFirstTime;

        setSessionLinesCompleted(prev => prev + 1);
        if (!hadWrongMoves && !coachNotesVisible) setSessionLinesPerfect(prev => prev + 1);

        const existingProgress = progressMap.get(nodeId);
        const newProgress: LineProgress = {
            nodeId,
            status: hadWrongMoves ? "COMPLETED" : (coachNotesVisible ? "COMPLETED" : "PERFECT"),
            attempts: (existingProgress?.attempts || 0) + 1,
            perfectCount: (existingProgress?.perfectCount || 0) + (!hadWrongMoves && !coachNotesVisible ? 1 : 0),
        };
        setProgressMap(prev => new Map(prev).set(nodeId, newProgress));
        if (!hadWrongMoves && !coachNotesVisible) {
            setSessionCompletedIds(prev => new Set(prev).add(nodeId));
        }

        const baseMessage = hadWrongMoves ? t("lineCompletedMistakes") : (coachNotesVisible ? t("lineCompletedWithHints") : t("lineCompletedFlawlessly"));
        const finalMessage = leafNode?.notes ? `${baseMessage}\n\n💡 ${leafNode.notes}` : baseMessage;

        setFeedback({
            type: "complete",
            message: finalMessage
        });
        try {
            await saveLineProgress({
                practiceId: practice.id,
                nodeId,
                hadWrongMoves,
                completed: true,
                coachNotesVisible,
            });
        } catch (e) {
            console.error("Failed to save progress:", e);
        }
    }

    function handleRestart() {
        startNewLine(currentNode.id);
    }

    const totalLines = allLeafNodes.length;
    const totalSeen = progressMap.size;
    const neverSeenCount = Math.max(0, totalLines - totalSeen);
    const completedCount = Array.from(progressMap.values()).filter(p => p.status === "COMPLETED").length;
    const perfectCount = Array.from(progressMap.values()).filter(p => p.status === "PERFECT").length;


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="aspect-square w-full max-w-[600px] mx-auto border-4 border-gray-800 rounded-lg overflow-hidden shadow-xl">
                        <Chessboard
                            key={`session-${game.fen()}`}
                            options={{
                                id: "practice-session-board",
                                position: game.fen(),
                                onPieceDrop: onPieceDrop as any,
                                boardOrientation: practice.playerColor.toLowerCase() as "white" | "black",
                                squareStyles: { ...highlightSquares, ...optionSquares },
                                onSquareClick,
                                onPieceClick,
                                arePiecesDraggable: isStudentTurn() && feedback.type !== "complete",
                            } as any}
                        />
                    </div>
                    {feedback.message && (
                        <div className={`p-4 rounded-lg text-center text-lg font-medium ${feedback.type === "incorrect" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
                            feedback.type === "complete" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" :
                                "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}>
                            {feedback.message}
                        </div>
                    )}
                    {hintsMessage && (
                        <div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                            <h4 className="font-medium">{t("coachHints")}</h4>
                            <p className="text-sm whitespace-pre-line">{hintsMessage}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-2">{practice.name}</h2>
                        {practice.description && <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{practice.description}</p>}
                        <div className="text-sm text-gray-500">
                            {t("playingAs")}: <span className="font-medium">{practice.playerColor === "WHITE" ? commonT("white") : commonT("black")}</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="font-medium mb-3">{t("overallProgress")}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>{t("totalLines")}:</span><span className="font-medium">{totalLines}</span></div>
                            <div className="flex justify-between"><span>{t("linesSeen")}:</span><span className="font-medium text-blue-600">{totalSeen} / {totalLines}</span></div>
                            <div className="flex justify-between"><span>{t("perfect")}:</span><span className="font-medium text-green-600">{perfectCount}</span></div>
                            <div className="flex justify-between"><span>{t("completedMistakes")}:</span><span className="font-medium text-yellow-600">{completedCount}</span></div>
                            <div className="flex justify-between"><span>{t("neverSeen")}:</span><span className="font-medium text-gray-500">{neverSeenCount}</span></div>
                        </div>
                        <div className="mt-3">
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300" style={{ width: `${totalLines > 0 ? (totalSeen / totalLines) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="font-medium mb-3">{t("thisSession")}</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>{t("linesCompleted")}:</span><span className="font-medium text-green-600">{sessionLinesCompleted}</span></div>
                            <div className="flex justify-between"><span>{t("perfectNoMistakes")}:</span><span className="font-medium text-blue-600">{sessionLinesPerfect}</span></div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <h3 className="font-medium mb-2">{t("moveHistory")}</h3>
                        <div className="text-sm max-h-[120px] overflow-y-auto">
                            {moveHistory.length === 0 ? <p className="text-gray-500">{t("noMovesYet")}</p> : (
                                <div className="flex flex-wrap gap-1">
                                    {moveHistory.map((move, index) => <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">{index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ""} {move}</span>)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={showCoachHints}
                                onChange={(e) => setShowCoachHints(e.target.checked)}
                                className="form-checkbox"
                            />
                            <span className="text-sm font-medium">{t("showCoachHints")}</span>
                        </label>
                    </div>

                    {feedback.type === "complete" ? (
                        <button
                            onClick={() => {
                                startNewLine();
                            }}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
                        >
                            {t("nextLine")}
                        </button>
                    ) : (
                        <button onClick={handleRestart} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">
                            {t("restartPractice")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
