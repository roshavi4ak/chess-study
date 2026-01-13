"use client";

import { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { useLegalMoves } from "@/hooks/useLegalMoves";
import { CheckCircle, XCircle, RotateCcw, Lightbulb, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface PuzzleSolverProps {
    id: string;
    fen: string;
    solution: string; // Space separated SAN moves
    hints?: string[]; // Array of hints corresponding to moves
    name: string; // Current puzzle name
    onSolve?: (result: "success" | "mistake" | "hint") => void;
    tag?: string;
}

export default function PuzzleSolver({ id, fen, solution, hints = [], name, onSolve, tag }: PuzzleSolverProps) {
    const t = useTranslations("PuzzleSolver");
    const [game, setGame] = useState(new Chess(fen));
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [status, setStatus] = useState<"playing" | "correct" | "wrong">("playing");
    const [message, setMessage] = useState("");
    const [showHint, setShowHint] = useState(false);
    const [mistakeMade, setMistakeMade] = useState(false);
    const [hintUsed, setHintUsed] = useState(false);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [ratingChange, setRatingChange] = useState<{ oldRating: number, newRating: number, change: number } | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const router = useRouter();

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
        // Reset state when puzzle changes
        const newGame = new Chess(fen);
        setGame(newGame);
        setCurrentMoveIndex(0);
        setStatus("playing");
        setMessage("");
        setShowHint(false);
        setMistakeMade(false);
        setHintUsed(false);
        setSubmitted(false);
        setRatingChange(null);

        // Lichess puzzles start with the opponent's move (the first move in the solution)
        // We need to play this move immediately to set up the board for the player
        if (solutionMoves.length > 0) {
            setTimeout(() => {
                try {
                    const firstMove = solutionMoves[0];
                    let moveResult;
                    if (firstMove.length === 4 || firstMove.length === 5) {
                        moveResult = newGame.move({
                            from: firstMove.substring(0, 2),
                            to: firstMove.substring(2, 4),
                            promotion: firstMove.length === 5 ? firstMove[4] : undefined,
                        });
                    } else {
                        moveResult = newGame.move(firstMove);
                    }

                    if (moveResult) {
                        setGame(new Chess(newGame.fen()));
                        setCurrentMoveIndex(1); // Player needs to solve from index 1
                        setLastMove({ from: moveResult.from, to: moveResult.to });
                    }
                } catch (e) {
                    console.error("Failed to play initial move:", e);
                }
            }, 500);
        }
    }, [fen, solution]); // Re-run when puzzle changes

    function handleMove(sourceSquare: string, targetSquare: string, promotion?: string): boolean {
        if (!targetSquare || status !== "playing") return false;
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
                setTimeout(() => {
                    setStatus("playing");
                    setMessage("");
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
            setShowHint(false); // Hide hint after correct move

            // Check if puzzle solved by this move
            if (newMoveIndex >= solutionMoves.length) {
                setStatus("correct");
                setMessage(t("puzzleSolved"));
                if (onSolve) {
                    if (mistakeMade) onSolve("mistake");
                    else if (hintUsed) onSolve("hint");
                    else onSolve("success");
                }

                if (!mistakeMade && !hintUsed) {
                    submitResult(true);
                } else {
                    submitResult(false);
                }
                return true;
            }

            // Auto-play opponent's move
            setTimeout(() => {
                const nextMove = solutionMoves[newMoveIndex];
                if (nextMove) {
                    try {
                        let oppMoveResult;
                        if (nextMove.length === 4 || nextMove.length === 5) {
                            oppMoveResult = game.move({
                                from: nextMove.substring(0, 2),
                                to: nextMove.substring(2, 4),
                                promotion: nextMove.length === 5 ? nextMove[4] : undefined,
                            });
                        } else {
                            oppMoveResult = game.move(nextMove);
                        }

                        if (oppMoveResult) {
                            setGame(new Chess(game.fen()));
                            setCurrentMoveIndex(prev => prev + 1);
                            setLastMove({ from: oppMoveResult.from, to: oppMoveResult.to });

                            // Check if puzzle solved after opponent's move
                            if (newMoveIndex + 1 >= solutionMoves.length) {
                                setStatus("correct");
                                setMessage(t("puzzleSolved"));
                                if (onSolve) {
                                    if (mistakeMade) onSolve("mistake");
                                    else if (hintUsed) onSolve("hint");
                                    else onSolve("success");
                                }

                                if (!mistakeMade && !hintUsed) {
                                    submitResult(true);
                                } else {
                                    submitResult(false);
                                }
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
        setGame(new Chess(fen));
        setCurrentMoveIndex(0);
        setStatus("playing");
        setMessage("");
        setShowHint(false);
        // We don't reset mistakeMade, hintUsed, or submitted to prevent cheating/retrying for points
    }

    function handleHint() {
        setShowHint(true);
        setHintUsed(true);
    }

    async function submitResult(success: boolean) {
        if (submitted) return;
        setSubmitted(true);
        try {
            // Pass generic puzzleId
            const res = await fetch('/api/puzzles/submit', {
                method: 'POST',
                body: JSON.stringify({ puzzleId: id, success })
            });
            if (res.ok) {
                const data = await res.json();
                setRatingChange(data);
            }
        } catch (e) { console.error(e); }
    }

    async function handleNextPuzzle() {
        try {
            const res = await fetch(`/api/puzzles/next?exclude=${name}${tag ? `&tag=${tag}` : ''}`);
            const data = await res.json();
            if (data.name) {
                router.push(`/puzzles/${data.name}${tag ? `?tag=${tag}` : ''}`);
            } else {
                alert(t("noMorePuzzles"));
            }
        } catch (error) {
            console.error("Failed to fetch next puzzle", error);
        }
    }

    const currentHint = hints[currentMoveIndex];

    // Build square styles for highlighting opponent's last move
    const squareStyles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
        squareStyles[lastMove.from] = { backgroundColor: 'rgba(170, 162, 0, 0.6)' };
        squareStyles[lastMove.to] = { backgroundColor: 'rgba(206, 210, 107, 0.4)' };
    }

    return (
        <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-[600px] aspect-square relative">
                <Chessboard
                    key={`puzzle-solver-${game.fen()}`}
                    options={{
                        id: "puzzle-solver",
                        position: game.fen(),
                        onPieceDrop: onPieceDrop as any,
                        onSquareClick: onSquareClick,
                        onPieceClick: onPieceClick,
                        boardOrientation: new Chess(fen).turn() === 'w' ? 'black' : 'white',
                        animationDurationInMs: 200,
                        squareStyles: { ...squareStyles, ...optionSquares },
                    } as any}
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
                    <div className="flex flex-col items-center justify-center text-green-600 animate-bounce">
                        <div className="flex items-center space-x-2">
                            <CheckCircle className="w-8 h-8" />
                            <span className="text-2xl font-bold">{message}</span>
                        </div>
                        {ratingChange && (
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
                            onClick={handleNextPuzzle}
                            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-full text-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            {t("nextPuzzle")} <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <>
                        {status === "wrong" && (
                            <div className="flex items-center justify-center text-red-600 space-x-2">
                                <XCircle className="w-6 h-6" />
                                <span className="text-xl font-bold">{message}</span>
                            </div>
                        )}
                        {status === "wrong" && ratingChange && (
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
                        {showHint && currentHint && (
                            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm animate-in fade-in slide-in-from-top-2">
                                💡 <strong>{t("hint")}:</strong> {currentHint}
                            </div>
                        )}
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

                        {currentHint && !showHint && (
                            <button
                                onClick={handleHint}
                                className="flex items-center space-x-2 px-4 py-2 text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 rounded-md transition-colors"
                            >
                                <Lightbulb className="w-4 h-4" />
                                <span>{t("showHint")}</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
