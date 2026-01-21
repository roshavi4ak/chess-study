import { useState } from "react";
import { Chess, Square } from "chess.js";

interface UseLegalMovesProps {
    game: Chess;
    onMove?: (move: { from: string; to: string; promotion?: string }) => boolean | Promise<boolean>;
    boardOrientation?: "white" | "black";
}

export function useLegalMoves({ game, onMove, boardOrientation = "white" }: UseLegalMovesProps) {
    const [moveFrom, setMoveFrom] = useState<Square | null>(null);
    const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});

    function getMoveOptions(square: Square) {
        const moves = game.moves({
            square,
            verbose: true,
        });

        if (moves.length === 0) {
            setOptionSquares({});
            return false;
        }

        const newSquares: Record<string, React.CSSProperties> = {};
        moves.map((move) => {
            const targetPiece = game.get(move.to);
            const sourcePiece = game.get(square);
            const isCapture = targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;

            newSquares[move.to] = {
                background: isCapture
                    ? "radial-gradient(circle, rgba(255, 0, 0, 0.4) 85%, transparent 85%)"
                    : "radial-gradient(circle, rgba(0, 0, 0, 0.3) 25%, transparent 25%)",
                borderRadius: "50%",
            };
            return move;
        });
        newSquares[square] = {
            background: "rgba(255, 255, 0, 0.4)",
        };
        setOptionSquares(newSquares);
        return true;
    }

    async function onSquareClick(args: any) {
        const square = typeof args === 'string' ? args : args?.square;
        console.log("onSquareClick triggered for:", square);
        if (!square) return;

        const sq = square as Square;

        // If clicking same square, deselect
        if (moveFrom === sq) {
            setMoveFrom(null);
            setOptionSquares({});
            return;
        }

        // Helper to attempt move
        const attemptMove = async (source: Square, target: Square) => {
            const piece = game.get(source);
            const isPromotion =
                piece?.type === "p" &&
                ((source[1] === "7" && target[1] === "8") ||
                    (source[1] === "2" && target[1] === "1"));

            if (onMove) {
                const result = await onMove({
                    from: source,
                    to: target,
                    promotion: isPromotion ? "q" : undefined,
                });

                // If move was successful, clear state. 
                // If not (e.g. wrong move in puzzle), we still clear dots but keep moveFrom null?
                // Actually, handleMove in PuzzleSolver handles piece state, let's just clear.
            }

            setMoveFrom(null);
            setOptionSquares({});
        };

        // If we have a piece selected, try to move
        if (moveFrom) {
            // Check if clicked square is a valid available move for the selected piece
            // We can check if the square is in our optionSquares (except the self-highlight)
            // But better: check against legal moves
            const moves = game.moves({
                square: moveFrom,
                verbose: true
            });

            const foundMove = moves.find((m) => m.to === sq);

            if (foundMove) {
                await attemptMove(moveFrom, sq);
                return;
            }

            // If we clicked a different piece of our own color, select it instead
            const piece = game.get(sq);
            if (piece && piece.color === (game.turn())) {
                // proceed to select
            } else {
                // Clicked empty or opponent piece that wasn't a valid capture
                setMoveFrom(null);
                setOptionSquares({});
                return;
            }
        }

        // Select piece if it's ours (check turn or just component orientation/interactive logic?)
        // Usually we only show moves for the player whose turn it is
        const piece = game.get(sq);
        // Also check if it's the correct turn? 
        // For analysis/puzzles, we might want to see legal moves even if it's not "our" turn in a networked game?
        // But game.moves() respects the turn. 
        if (piece && piece.color === game.turn()) {
            setMoveFrom(sq);
            getMoveOptions(sq);
        } else {
            // If we clicked something else, clear
            setMoveFrom(null);
            setOptionSquares({});
        }
    }

    async function onPieceDrop(args: any) {
        // Handle both (source, target) and ({ sourceSquare, targetSquare })
        let source: Square;
        let target: Square;

        if (typeof args === 'object' && 'sourceSquare' in args) {
            source = args.sourceSquare;
            target = args.targetSquare;
        } else {
            // Fallback for direct calls if any
            source = arguments[0];
            target = arguments[1];
        }

        setMoveFrom(null);
        setOptionSquares({});
        if (onMove && source && target) {
            if (source === target) return false; // Same-square guard

            // Check if the move is legal
            const moves = game.moves({
                square: source,
                verbose: true
            });
            const foundMove = moves.find((m) => m.to === target);
            if (!foundMove) return false; // Illegal move, snap back

            // Check for promotion
            const piece = game.get(source);
            const isPromotion =
                piece?.type === "p" &&
                ((source[1] === "7" && target[1] === "8") ||
                    (source[1] === "2" && target[1] === "1")); // Simple promotion check

            // Improved onMove callback handling: use try/catch for robustness
            try {
                return await onMove({
                    from: source,
                    to: target,
                    promotion: isPromotion ? "q" : undefined
                });
            } catch (error) {
                console.error("Error during onMove callback:", error);
                return false; // Indicate move failure
            }
        }
        return true;
    }

    function onPieceClick(args: any) {
        // react-chessboard passes an object { piece, square }
        onSquareClick(args);
    }

    return {
        onSquareClick,
        onPieceClick,
        onPieceDrop,
        optionSquares,
        setOptionSquares, // Allow manual override/clear if needed
        moveFrom
    };
}
