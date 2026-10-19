"use client";

import { useState, useEffect, useRef } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { CheckCircle, XCircle, RotateCcw, Lightbulb, ArrowRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LichessAnalysisLink from "@/components/LichessAnalysisLink";
import ProgressiveHint from "@/components/ProgressiveHint";
import MoveConsequence from "@/components/MoveConsequence";

function playSolutionMove(game: Chess, move: string) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
        ? game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
        : game.move(move);
}

interface PuzzleSolverProps {
    id: string;
    fen: string;
    solution: string; // Space separated UCI or SAN moves, starting with the opponent's move
    hints?: string[]; // Array of hints corresponding to moves
    name: string; // Current puzzle name
    onSolve?: (result: "success" | "mistake" | "hint") => void;
    tag?: string;
    reviewMode?: boolean;
    onContinue?: () => void;
}

export default function PuzzleSolver(props: PuzzleSolverProps) {
    return <PuzzleSolverContent key={JSON.stringify([props.id, props.fen, props.solution])} {...props} />;
}

function PuzzleSolverContent({ id, fen, solution, hints = [], name, onSolve, tag, reviewMode = false, onContinue }: PuzzleSolverProps) {
    const t = useTranslations("PuzzleSolver");
    const tHelp = useTranslations("LearningHelp");
    const [game, setGame] = useState(new Chess(fen));
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");
    const [message, setMessage] = useState("");
    const [hintStage, setHintStage] = useState(0);
    const [wrongPosition, setWrongPosition] = useState<{ fen: string; move: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const pendingResult = useRef<{ success: boolean; assisted: boolean } | null>(null);
    const [mistakeMade, setMistakeMade] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [restartCount, setRestartCount] = useState(0);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [ratingChange, setRatingChange] = useState<{ oldRating: number, newRating: number, change: number } | null>(null);
    const submitted = useRef(false);
    const inputLocked = useRef(true);
    const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();
    const orientation = new Chess(fen).turn() === "w" ? "black" : "white";

    const { onSquareClick, onPieceClick, onPieceDrop, optionSquares, setOptionSquares } = useLegalMoves({
        game,
        onMove: ({ from, to, promotion }) => {
            const result = handleMove(from, to, promotion);
            return result;
        }
    });

    // Parse solution moves (handle both UCI and SAN, but we expect UCI from Lichess DB)
    const solutionMoves = solution.split(" ").filter(m => m.trim() !== "");

    useEffect(() => {
        const newGame = new Chess(fen);
        const initialMoves = solution.split(" ").filter(move => move.trim() !== "");
        // Lichess puzzles start with the opponent's move (the first move in the solution)
        // We need to play this move immediately to set up the board for the player
        if (initialMoves.length > 0) {
            const timer = setTimeout(() => {
                try {
                    const firstMove = initialMoves[0];
                    const moveResult = playSolutionMove(newGame, firstMove);

                    if (moveResult) {
                        setGame(new Chess(newGame.fen()));
                        setCurrentMoveIndex(1); // Player needs to solve from index 1
                        setLastMove({ from: moveResult.from, to: moveResult.to });
                        inputLocked.current = false;
                    }
                } catch (e) {
                    console.error("Failed to play initial move:", e);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [fen, solution, restartCount]);

    useEffect(() => () => {
        if (moveTimer.current) clearTimeout(moveTimer.current);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    }, []);

    function completePuzzle() {
        inputLocked.current = true;
        setStatus("correct");
        setMessage(t(hintUsed ? "puzzleCompletedWithHint" : "puzzleSolved"));
        onSolve?.(hintUsed ? "hint" : mistakeMade ? "mistake" : "success");
        void submitResult(!mistakeMade && !hintUsed, hintUsed);
    }

    function handleMove(sourceSquare: string, targetSquare: string, promotion?: string): boolean {
        if (!targetSquare || status !== "playing" || inputLocked.current) return false;
        if (sourceSquare === targetSquare) return false;

        try {
            // Create a temp game to validate the move
            const tempGame = new Chess(game.fen());

            // Check for promotion if not supplied
            if (!promotion) {
                const piece = game.get(sourceSquare as Square);
                const isPromotion =
                    piece?.type === 'p' &&
                    ((piece.color === 'w' && targetSquare[1] === '8') ||
                        (piece.color === 'b' && targetSquare[1] === '1'));
                if (isPromotion) promotion = 'q';
            }

            // Attempt the move
            const move = tempGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: promotion || undefined
            });

            if (!move) return false; // Illegal move

            const expectedMove = solutionMoves[currentMoveIndex];
            const moveUci = move.from + move.to + (move.promotion || "");

            let isCorrect = false;
            if (expectedMove === moveUci) {
                isCorrect = true;
            } else if (expectedMove === move.san) {
                isCorrect = true;
            }

            if (!isCorrect) {
                // Wrong move!
                setStatus("wrong");
                setMessage(t("incorrectMove"));
                setMistakeMade(true);
                setWrongPosition({ fen: game.fen(), move: moveUci });
                inputLocked.current = true;
                setMistakeCount(mistakeCount + 1);
                if (mistakeCount + 1 >= 3 && hintStage === 0) handleHint();
                feedbackTimer.current = setTimeout(() => {
                    setStatus("playing");
                    setMessage("");
                    inputLocked.current = false;
                }, 1000);
                submitResult(false);
                return false; // Snap back
            }

            // Correct move!
            game.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: promotion || undefined
            });
            const newGame = new Chess(game.fen());
            setGame(newGame);
            const newMoveIndex = currentMoveIndex + 1;
            setCurrentMoveIndex(newMoveIndex);
            setMessage("");
            setHintStage(0);
            setWrongPosition(null);
            setMistakeCount(0);
            inputLocked.current = true;

            // Check if puzzle solved by this move
            if (newMoveIndex >= solutionMoves.length) {
                completePuzzle();
                return true;
            }

            // Auto-play opponent's move
            moveTimer.current = setTimeout(() => {
                const nextMove = solutionMoves[newMoveIndex];
                if (nextMove) {
                    try {
                        const oppMoveResult = playSolutionMove(game, nextMove);

                        if (oppMoveResult) {
                            setGame(new Chess(game.fen()));
                            setCurrentMoveIndex(prev => prev + 1);
                            setLastMove({ from: oppMoveResult.from, to: oppMoveResult.to });
                            inputLocked.current = false;

                            // Check if puzzle solved after opponent's move
                            if (newMoveIndex + 1 >= solutionMoves.length) {
                                completePuzzle();
                            }
                        }
                    } catch (e) {
                        console.error("Error playing opponent move:", e);
                    }
                }
            }, 200);

            return true;

        } catch (e) {
            console.error(e);
            return false;
        }
    }

    function resetPuzzle() {
        if (moveTimer.current) clearTimeout(moveTimer.current);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        inputLocked.current = true;
        setGame(new Chess(fen));
        setCurrentMoveIndex(0);
        setStatus("playing");
        setMessage("");
        setHintStage(0);
        setWrongPosition(null);
        setLastMove(null);
        setOptionSquares({});
        setMistakeCount(0);
        setRestartCount(count => count + 1);
        // We don't reset mistakeMade, hintUsed, or submitted to prevent cheating/retrying for points
    }

    function handleHint() {
        setHintStage(stage => Math.min(3, stage + 1));
        setHintUsed(true);
        // Record assistance immediately so leaving or resetting cannot earn points later.
        void submitResult(false, true);
    }

    async function submitResult(success: boolean, assisted = hintUsed) {
        if (submitted.current) return;
        submitted.current = true;
        pendingResult.current = { success, assisted };
        setSaving(true);
        setSaveError(false);
        try {
            console.log("Submitting puzzle result:", { puzzleId: id, success });
            
            const res = await fetch('/api/puzzles/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ puzzleId: id, success, ...(assisted ? { hintUsed: true } : {}), ...(reviewMode ? { review: true } : {}) })
            });
            
            console.log("Response status:", res.status);
            
            if (res.ok) {
                const data = await res.json();
                console.log("Response data:", data);
                setRatingChange(data);
            } else {
                const errorText = await res.text();
                console.error("Error response:", errorText);
                submitted.current = false;
                setSaveError(true);
            }
        } catch (e) { 
            console.error("Error submitting result:", e); 
            submitted.current = false;
            setSaveError(true);
        } finally {
            setSaving(false);
        }
    }

    async function handleNextPuzzle() {
        try {
            const query = new URLSearchParams({ exclude: name });
            if (tag) query.set("tag", tag);
            const res = await fetch(`/api/puzzles/next?${query}`);
            const data = await res.json();
            if (data.puzzleName) {
                router.push({ pathname: `/puzzles/${data.puzzleName}`, query: tag ? { tag } : undefined });
            } else {
                alert(t("noMorePuzzles"));
            }
        } catch (error) {
            console.error("Failed to fetch next puzzle", error);
        }
    }

    const currentHint = hints[currentMoveIndex];
    let nextMove = null;
    if (currentMoveIndex % 2 === 1 && status !== "correct" && solutionMoves[currentMoveIndex]) {
        try {
            nextMove = playSolutionMove(new Chess(game.fen()), solutionMoves[currentMoveIndex]);
        } catch {
            // Only show instructions that are legal in the current position.
        }
    }
    const hintArrows = hintStage >= 3 && nextMove
        ? [{ startSquare: nextMove.from, endSquare: nextMove.to, color: "rgba(34, 197, 94, 0.85)" }]
        : [];

    // Build square styles for highlighting opponent's last move
    const squareStyles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
        squareStyles[lastMove.from] = { backgroundColor: 'rgba(170, 162, 0, 0.6)' };
        squareStyles[lastMove.to] = { backgroundColor: 'rgba(206, 210, 107, 0.4)' };
    }
    if (hintStage >= 2 && nextMove) squareStyles[nextMove.from] = { backgroundColor: "rgba(250,204,21,.65)" };

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-[600px] aspect-square relative">
                <Chessboard
                    key={`puzzle-solver-${game.fen()}`}
                    options={{
                        id: "puzzle-solver",
                        position: game.fen(),
                        onPieceDrop: (args) => { void onPieceDrop(args); return false; },
                        onSquareClick: onSquareClick,
                        onPieceClick: onPieceClick,
                        boardOrientation: orientation,
                        arrows: hintArrows,
                        allowDragging: status === "playing" && currentMoveIndex % 2 === 1,
                        animationDurationInMs: 200,
                        squareStyles: { ...squareStyles, ...optionSquares },
                    }}
                />

                {/* Overlay for Wrong Move */}
                {status === "wrong" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <XCircle className="w-32 h-32 text-red-600 opacity-50 animate-pulse" />
                    </div>
                )}
            </div>

            <div className="text-center min-h-[80px] space-y-2 w-full max-w-[600px]">
                {status === "correct" ? (
                    <div className={`flex flex-col items-center justify-center ${hintUsed ? "text-yellow-600" : "text-green-600"}`}>
                        <div className="flex items-center space-x-2">
                            {hintUsed ? <Lightbulb className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
                            <span className="text-2xl font-bold">{message}</span>
                        </div>
                        {ratingChange && !reviewMode && (
                            <div className="flex flex-col items-center">
                                <span className={`text-xl font-bold ${ratingChange.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {ratingChange.change >= 0 ? '+' : ''}{ratingChange.change}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {t("rating")}: {ratingChange.newRating}
                                </span>
                            </div>
                        )}
                        <button
                            onClick={onContinue ?? handleNextPuzzle}
                            disabled={reviewMode && (saving || saveError)}
                            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-full text-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            {t("nextPuzzle")} <ArrowRight className="w-5 h-5" />
                        </button>
                        <div className="mt-3 text-gray-700 dark:text-gray-200">
                            <LichessAnalysisLink fen={game.fen()} orientation={orientation} />
                        </div>
                    </div>
                ) : (
                    <>
                        {status === "wrong" && (
                            <div className="flex items-center justify-center text-red-600 space-x-2">
                                <XCircle className="w-6 h-6" />
                                <span className="text-xl font-bold">{message}</span>
                            </div>
                        )}
                        {status === "wrong" && ratingChange && !reviewMode && (
                            <div className="flex flex-col items-center mt-2">
                                <span className={`text-lg font-bold ${ratingChange.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {ratingChange.change >= 0 ? '+' : ''}{ratingChange.change}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {t("rating")}: {ratingChange.newRating}
                                </span>
                            </div>
                        )}
                        {status === "playing" && (
                            <div className="text-gray-500 text-lg">
                                {currentMoveIndex === 0 ? t("yourTurn") : t("keepGoing")}
                            </div>
                        )}

                        {/* Hint Display */}
                        {nextMove && <ProgressiveHint fen={game.fen()} move={solutionMoves[currentMoveIndex]} stage={hintStage} note={currentHint} />}
                        {wrongPosition && <MoveConsequence key={`${wrongPosition.fen}-${wrongPosition.move}`} {...wrongPosition} />}
                    </>
                )}
            </div>

            <div className="flex gap-4">
                {status !== "correct" && (
                    <>
                        <button
                            onClick={resetPuzzle}
                            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>{t("reset")}</span>
                        </button>

                        {nextMove && hintStage < 3 && (
                            <button
                                onClick={handleHint}
                                disabled={status !== "playing"}
                                className="flex items-center space-x-2 px-4 py-2 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 rounded-md transition-colors disabled:opacity-50"
                            >
                                <Lightbulb className="w-4 h-4" />
                                <span>{hintStage === 0 ? t("showHint") : tHelp("moreHelp")}</span>
                            </button>
                        )}
                    </>
                )}
            </div>
            {saveError && <div role="alert" className="text-center space-y-2"><p>{tHelp("saveError")}</p><button type="button" disabled={saving} className="underline" onClick={() => { const pending = pendingResult.current; if (pending) void submitResult(pending.success, pending.assisted); }}>{tHelp("retrySave")}</button></div>}
            {reviewMode && saving && <p role="status">{tHelp("saving")}</p>}
        </div>
    );
}
