"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { saveLineProgress } from "@/app/actions/progress";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { useTranslations } from "next-intl";
import { formatPracticeHint } from "@/lib/practiceHints";
import { getAllLeafNodes, hasSeenLine, pickNextLine, getAvailableChildren, chooseOpponentChild, type PracticeNode, type LineProgress, type LineAttemptRecord } from "@/lib/practiceLines";
import LichessAnalysisLink from "@/components/LichessAnalysisLink";
import { Link } from "@/i18n/navigation";
import WhyQuestionCard from "@/components/WhyQuestionCard";
import type { WhyQuestion } from "@/app/actions/practiceQuestions";

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
    // Every saved run of this practice's lines; decides which line comes next.
    initialAttempts?: LineAttemptRecord[];
    // Lines due for review today; they are served first, before normal practice continues.
    dueLineIds?: string[];
    // "Why?" questions by the last node of a line, and whether this viewer (a coach) may edit them.
    questions?: Record<string, WhyQuestion>;
    canEditQuestions?: boolean;
}

export default function PracticeSession({ practice, initialProgress, initialAttempts = [], dueLineIds, questions = {}, canEditQuestions = false }: PracticeSessionProps) {
    const t = useTranslations("Practice");
    const commonT = useTranslations("Common");
    const [game, setGame] = useState(() => new Chess(practice.tree.fen));
    const [currentNode, setCurrentNode] = useState<PracticeNode>(practice.tree);
    const [targetLine, setTargetLine] = useState<PracticeNode | null>(null);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [nodePath, setNodePath] = useState<string[]>([practice.tree.id]);
    const [reviewIndex, setReviewIndex] = useState<number | null>(null);
    const [seenOnly, setSeenOnly] = useState(false);
    const [attempts, setAttempts] = useState<LineAttemptRecord[]>(() => initialAttempts.map(attempt => ({ ...attempt, createdAt: new Date(attempt.createdAt) })));
    const [feedback, setFeedback] = useState<{ type: "incorrect" | "complete" | "note" | null; message: string }>({ type: null, message: "" });
    const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});
    const [showCoachHints, setShowCoachHints] = useState(false);
    // Wrong tries in the current position; from the second one an arrow shows the expected move.
    const [wrongAt, setWrongAt] = useState<{ nodeId: string; count: number } | null>(null);
    const [sessionLinesCompleted, setSessionLinesCompleted] = useState(0);
    const [sessionLinesPerfect, setSessionLinesPerfect] = useState(0);
    const [currentLineFirstTime, setCurrentLineFirstTime] = useState(true);
    const [dueRemaining, setDueRemaining] = useState<Set<string>>(() => new Set(dueLineIds));
    const [questionMap, setQuestionMap] = useState<Record<string, WhyQuestion>>(questions);
    // Wrong moves in the current attempt of a line.
    const wrongMoves = useRef(0);
    const usedCoachHints = useRef(false);
    // Browsing or replaying an attempt must never save its completion twice.
    const attemptCompleted = useRef(false);
    const allLeafNodes = useMemo(() => getAllLeafNodes(practice.tree), [practice.tree]);
    const nodesById = useMemo(() => {
        const nodes = new Map<string, PracticeNode>();
        function visit(node: PracticeNode) {
            nodes.set(node.id, node);
            node.children.forEach(visit);
        }
        visit(practice.tree);
        return nodes;
    }, [practice.tree]);
    const [progressMap, setProgressMap] = useState<Map<string, LineProgress>>(() => {
        const validIds = new Set(getAllLeafNodes(practice.tree).map(node => node.id));
        return new Map(initialProgress.filter(p => validIds.has(p.nodeId) && hasSeenLine(p)).map(p => [p.nodeId, p]));
    });
    const seenIds = new Set([...progressMap.values()].filter(hasSeenLine).map(p => p.nodeId));
    const displayedIndex = reviewIndex ?? nodePath.length - 1;
    const displayedNode = nodesById.get(nodePath[displayedIndex]) ?? currentNode;
    const displayedGame = useMemo(() => new Chess(displayedNode.fen), [displayedNode.fen]);
    const reviewing = reviewIndex !== null;
    const hintNode = { ...displayedNode, children: getAvailableChildren(displayedNode, seenOnly ? seenIds : null) };
    const hintsMessage = showCoachHints && (reviewing || feedback.type !== "complete")
        ? formatPracticeHint(hintNode, moves => t("expectedMoveHint", { moves })) : "";
    const displayedFeedback = reviewing
        ? { type: "note", message: (currentLineFirstTime || showCoachHints) && displayedNode.notes ? `💡 ${displayedNode.notes}` : "" }
        : feedback;
    const displayedHighlights = reviewing && displayedNode.move ? {
        [displayedNode.move.slice(0, 2)]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
        [displayedNode.move.slice(2, 4)]: { backgroundColor: "rgba(255, 255, 0, 0.6)" },
    } : reviewing ? {} : highlightSquares;
    const hintArrows = !reviewing && feedback.type !== "complete" && wrongAt?.nodeId === currentNode.id && wrongAt.count >= 2
        ? getAvailableChildren(currentNode, seenOnly ? seenIds : null)
            .filter(child => child.move)
            .map(child => ({ startSquare: child.move!.slice(0, 2), endSquare: child.move!.slice(2, 4), color: "rgba(34, 197, 94, 0.85)" }))
        : [];

    const handleMove = (move: { from: string; to: string; promotion?: string }) => {
        const { from, to, promotion = "q" } = move;
        setOptionSquares({});
        if (reviewing || isOpponentTurn(game.fen()) || feedback.type === "complete" || from === to) return false;
        const matchingChild = getAvailableChildren(currentNode, seenOnly ? seenIds : null)
            .find(child => child.move?.startsWith(`${from}${to}`));
        if (!matchingChild) {
            wrongMoves.current += 1;
            setWrongAt(previous => ({ nodeId: currentNode.id, count: previous?.nodeId === currentNode.id ? previous.count + 1 : 1 }));
            const hint = formatPracticeHint({ ...currentNode, children: getAvailableChildren(currentNode, seenOnly ? seenIds : null) }, moves => t("expectedMoveHint", { moves }));
            setFeedback({ type: "incorrect", message: hint ? t("wrongMoveHint", { hint }) : t("wrongMoveTryAgain") });
            return false;
        }
        const gameResult = new Chess(game.fen());
        try {
            const moveResult = gameResult.move({ from, to, promotion: matchingChild.move?.[4] || promotion });
            if (!moveResult) return false;
            const newHistory = [...moveHistory, moveResult.san];
            const newPath = [...nodePath, matchingChild.id];
            setGame(gameResult);
            setMoveHistory(newHistory);
            setCurrentNode(matchingChild);
            setNodePath(newPath);
            highlightMove(from, to);
            if (!matchingChild.children.length) {
                void handleLineComplete(newPath);
            } else {
                setFeedback({ type: matchingChild.notes && currentLineFirstTime ? "note" : null, message: matchingChild.notes && currentLineFirstTime ? `💡 ${matchingChild.notes}` : "" });
                const selected = selectOpponentReply(matchingChild, targetLine?.id ?? null, seenOnly);
                if (selected) executeOpponentMove(matchingChild, selected, newHistory, newPath, currentLineFirstTime);
            }
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    };

    const { onSquareClick, onPieceClick, optionSquares, setOptionSquares, onPieceDrop } = useLegalMoves({ game: displayedGame, onMove: handleMove });

    useEffect(() => {
        startNewLine();
        // Initialize once; subsequent lines start only through the practice controls.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function isOpponentTurn(fen: string): boolean {
        return (new Chess(fen).turn() === "w" ? "WHITE" : "BLACK") !== practice.playerColor;
    }

    function highlightMove(from: string, to: string) {
        setHighlightSquares({
            [from]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
            [to]: { backgroundColor: "rgba(255, 255, 0, 0.6)" },
        });
    }

    function pickLine(leaves: PracticeNode[], onlySeen: boolean) {
        return pickNextLine(leaves, { seenIds, attempts, seenOnly: onlySeen, now: new Date() });
    }

    function selectOpponentReply(node: PracticeNode, targetId: string | null, onlySeen: boolean) {
        const target = targetId && (!onlySeen || seenIds.has(targetId)) ? targetId : null;
        return chooseOpponentChild(node, target, pickLine(getAllLeafNodes(node), onlySeen)?.id ?? null);
    }

    function startNewLine(onlySeen = seenOnly, repeatLine?: PracticeNode) {
        const dueLeaves = allLeafNodes.filter(node => dueRemaining.has(node.id));
        const candidate = repeatLine ?? (dueLeaves.length ? pickLine(dueLeaves, false) : pickLine(allLeafNodes, onlySeen));
        if (!candidate) return;
        const firstTime = !hasSeenLine(progressMap.get(candidate.id));
        setGame(new Chess(practice.tree.fen));
        setCurrentNode(practice.tree);
        setMoveHistory([]);
        setNodePath([practice.tree.id]);
        setReviewIndex(null);
        setOptionSquares({});
        setFeedback({ type: null, message: "" });
        setHighlightSquares({});
        setWrongAt(null);
        wrongMoves.current = 0;
        usedCoachHints.current = firstTime;
        attemptCompleted.current = false;
        setShowCoachHints(false);
        setTargetLine(candidate);
        setCurrentLineFirstTime(firstTime);
        if (!practice.tree.children.length) {
            void handleLineComplete([practice.tree.id]);
        } else if (isOpponentTurn(practice.tree.fen)) {
            const child = selectOpponentReply(practice.tree, candidate.id, onlySeen);
            if (child) executeOpponentMove(practice.tree, child, [], [practice.tree.id], firstTime);
        }
    }

    function executeOpponentMove(parent: PracticeNode, child: PracticeNode, history: string[], path: string[], firstTime: boolean) {
        if (!child.move) return;
        const gameCopy = new Chess(parent.fen);
        try {
            const move = gameCopy.move({ from: child.move.slice(0, 2), to: child.move.slice(2, 4), promotion: child.move[4] });
            if (!move) return;
            const newPath = [...path, child.id];
            setGame(gameCopy);
            setMoveHistory([...history, move.san]);
            setCurrentNode(child);
            setNodePath(newPath);
            highlightMove(move.from, move.to);
            setFeedback({ type: child.notes && firstTime ? "note" : null, message: child.notes && firstTime ? `💡 ${child.notes}` : "" });
            if (!child.children.length) void handleLineComplete(newPath);
        } catch (error) { console.error(error); }
    }

    async function handleLineComplete(finalPath: string[]) {
        const nodeId = finalPath[finalPath.length - 1];
        const leafNode = nodesById.get(nodeId);
        const coachNotesVisible = usedCoachHints.current;
        const mistakes = wrongMoves.current;
        const wrong = mistakes > 0;
        const perfect = !wrong && !coachNotesVisible;
        const baseMessage = wrong ? t("lineCompletedMistakes") : coachNotesVisible ? t("lineCompletedWithHints") : t("lineCompletedFlawlessly");
        setFeedback({ type: "complete", message: leafNode?.notes ? `${baseMessage}\n\n💡 ${leafNode.notes}` : baseMessage });
        if (attemptCompleted.current) return;
        attemptCompleted.current = true;
        setSessionLinesCompleted(prev => prev + 1);
        if (perfect) setSessionLinesPerfect(prev => prev + 1);
        setProgressMap(prev => {
            const existing = prev.get(nodeId);
            return new Map(prev).set(nodeId, {
                nodeId,
                status: perfect ? "PERFECT" : "COMPLETED",
                attempts: (existing?.attempts ?? 0) + 1,
                perfectCount: (existing?.perfectCount ?? 0) + (perfect ? 1 : 0),
            });
        });
        setAttempts(prev => [...prev, { nodeId, status: perfect ? "PERFECT" : "COMPLETED", createdAt: new Date() }]);
        setDueRemaining(prev => {
            if (!prev.has(nodeId)) return prev;
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
        });
        try {
            await saveLineProgress({ practiceId: practice.id, nodeId, hadWrongMoves: wrong, mistakes, completed: true, coachNotesVisible });
        } catch (error) { console.error("Failed to save progress:", error); }
    }

    function navigateTo(index: number) {
        setReviewIndex(index === nodePath.length - 1 ? null : index);
        setOptionSquares({});
    }

    function replayFromHere() {
        if (!reviewing || isOpponentTurn(displayedNode.fen)) return;
        setGame(new Chess(displayedNode.fen));
        setCurrentNode(displayedNode);
        setNodePath(nodePath.slice(0, displayedIndex + 1));
        setMoveHistory(moveHistory.slice(0, displayedIndex));
        setReviewIndex(null);
        setOptionSquares({});
        setHighlightSquares(displayedHighlights);
        setFeedback({ type: null, message: "" });
    }

    function handleRestart() {
        // Repeat the actual line just played, even if it diverged from the initial target.
        const leaf = currentNode.children.length === 0 ? currentNode : targetLine;
        if (leaf) startNewLine(seenOnly, leaf);
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
                            key={`session-${displayedNode.fen}`}
                            options={{
                                id: "practice-session-board",
                                position: displayedNode.fen,
                                onPieceDrop: (args) => { void onPieceDrop(args); return false; },
                                boardOrientation: practice.playerColor.toLowerCase() as "white" | "black",
                                squareStyles: { ...displayedHighlights, ...optionSquares },
                                arrows: hintArrows,
                                onSquareClick: reviewing || feedback.type === "complete" ? undefined : onSquareClick,
                                onPieceClick: reviewing || feedback.type === "complete" ? undefined : onPieceClick,
                                allowDragging: !reviewing && !isOpponentTurn(game.fen()) && feedback.type !== "complete",
                            }}
                        />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button onClick={() => navigateTo(displayedIndex - 1)} disabled={displayedIndex === 0} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            {t("previousMove")}
                        </button>
                        <button onClick={() => navigateTo(displayedIndex + 1)} disabled={displayedIndex === nodePath.length - 1} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            {t("forwardMove")}
                        </button>
                        <LichessAnalysisLink fen={displayedNode.fen} orientation={practice.playerColor.toLowerCase() as "white" | "black"} onOpen={() => { usedCoachHints.current = true; }} />
                    </div>
                    {reviewing && (
                        <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-center space-y-2">
                            <p className="text-sm">{t("reviewingMoves")}</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <button onClick={() => navigateTo(nodePath.length - 1)} className="px-3 py-2 rounded-lg bg-blue-600 text-white">{t("returnToCurrent")}</button>
                                <button onClick={replayFromHere} disabled={isOpponentTurn(displayedNode.fen)} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">{t("replayFromHere")}</button>
                            </div>
                            {isOpponentTurn(displayedNode.fen) && <p className="text-sm text-gray-500">{t("replayStudentTurn")}</p>}
                        </div>
                    )}
                    {displayedFeedback.message && (
                        <div className={`p-4 rounded-lg text-center text-lg font-medium whitespace-pre-line ${displayedFeedback.type === "incorrect" ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" :
                            displayedFeedback.type === "complete" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" :
                                "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                            }`}>
                            {displayedFeedback.message}
                        </div>
                    )}
                    {!reviewing && feedback.type === "complete" && currentNode.children.length === 0 && (questionMap[currentNode.id] || canEditQuestions) && (
                        <WhyQuestionCard
                            key={`${currentNode.id}-${sessionLinesCompleted}`}
                            nodeId={currentNode.id}
                            question={questionMap[currentNode.id]}
                            canEdit={canEditQuestions}
                            onSaved={saved => setQuestionMap(previous => {
                                const next = { ...previous };
                                if (saved) next[currentNode.id] = saved;
                                else delete next[currentNode.id];
                                return next;
                            })}
                        />
                    )}
                    {hintsMessage && (
                        <div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                            <h4 className="font-medium">{t("coachHints")}</h4>
                            <p className="text-sm whitespace-pre-line">{hintsMessage}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {!!dueLineIds?.length && (
                        <div className={`p-4 rounded-lg shadow ${dueRemaining.size ? "bg-amber-50 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100" : "bg-green-50 dark:bg-green-900/40 text-green-900 dark:text-green-100"}`}>
                            <h3 className="font-bold">{dueRemaining.size ? t("dueReviewTitle") : t("dueReviewDone")}</h3>
                            <p className="text-sm mt-1">{dueRemaining.size ? t("dueLinesLeft", { count: dueRemaining.size }) : t("dueReviewDoneDescription")}</p>
                            {!dueRemaining.size && (
                                <Link href="/dashboard" className="inline-block mt-2 text-sm font-medium underline">{t("backToMission")}</Link>
                            )}
                        </div>
                    )}
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
                                    {moveHistory.map((move, index) => {
                                        const before = new Chess(nodesById.get(nodePath[index])!.fen);
                                        return <button key={index} onClick={() => navigateTo(index + 1)} aria-current={displayedIndex === index + 1 ? "step" : undefined} className={`px-2 py-1 rounded text-xs ${displayedIndex === index + 1 ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700"}`}>{before.moveNumber()}{before.turn() === "w" ? "." : "..."} {move}</button>;
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={showCoachHints}
                                onChange={(e) => {
                                    setShowCoachHints(e.target.checked);
                                    if (e.target.checked) usedCoachHints.current = true;
                                }}
                                className="form-checkbox"
                            />
                            <span className="text-sm font-medium">{t("showCoachHints")}</span>
                        </label>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-2">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={seenOnly} disabled={totalSeen === 0} onChange={(e) => {
                                setSeenOnly(e.target.checked);
                                startNewLine(e.target.checked);
                            }} />
                            <span className="text-sm font-medium">{t("practiceSeenLines")}</span>
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{totalSeen === 0 ? t("noSeenLines") : seenOnly ? t("seenLinesModeDescription") : t("practiceSeenLinesDescription")}</p>
                    </div>

                    {feedback.type === "complete" ? (
                        <div className="space-y-2">
                            <button onClick={() => startNewLine()} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700">
                                {dueRemaining.size ? t("nextDueLine") : seenOnly ? t("nextSeenLine") : t("nextLine")}
                            </button>
                            <button onClick={handleRestart} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">{t("repeatLine")}</button>
                        </div>
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
