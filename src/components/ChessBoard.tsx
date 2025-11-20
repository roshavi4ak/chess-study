"use client";

import { Chess, Square } from "chess.js";
import { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";

interface ChessBoardProps {
    fen?: string;
    onMove?: (move: { from: string; to: string; promotion?: string }) => boolean;
    orientation?: "white" | "black";
    interactive?: boolean;
}

export default function ChessBoard({
    fen = "start",
    onMove,
    orientation = "white",
    interactive = true,
}: ChessBoardProps) {
    const gameRef = useRef(new Chess(fen === "start" ? undefined : fen));
    const [moveFrom, setMoveFrom] = useState<Square | null>(null);
    const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        try {
            const newGame = new Chess(fen === "start" ? undefined : fen);
            gameRef.current = newGame;
            setMoveFrom(null);
            setOptionSquares({});
            console.log("ChessBoard: Updated from FEN:", fen);
        } catch (e) {
            console.error("ChessBoard: Invalid FEN:", fen, e);
        }
    }, [fen]);

    function onPieceDrop({ sourceSquare, targetSquare, piece }: any) {
        console.log(`onPieceDrop: ${sourceSquare} -> ${targetSquare}`);

        if (!interactive || !targetSquare) {
            console.warn("Drag blocked or invalid target");
            return false;
        }

        if (!onMove) return false;

        // Check for promotion
        let isPromotion = false;
        try {
            const pieceObj = gameRef.current.get(sourceSquare as Square);
            isPromotion = (pieceObj?.type === 'p') &&
                ((sourceSquare[1] === '7' && targetSquare[1] === '8') ||
                    (sourceSquare[1] === '2' && targetSquare[1] === '1'));
        } catch (e) {
            console.error("Error checking promotion:", e);
        }

        const moveConfig: any = {
            from: sourceSquare,
            to: targetSquare,
        };

        if (isPromotion) {
            moveConfig.promotion = 'q';
        }

        const result = onMove(moveConfig);

        if (result) {
            return true;
        } else {
            return false;
        }
    }

    function onSquareClick({ square }: any) {
        if (!interactive) return;
        const sq = square as Square;

        // If clicking same square, deselect
        if (moveFrom === sq) {
            setMoveFrom(null);
            setOptionSquares({});
            return;
        }

        // If we have a piece selected, try to move
        if (moveFrom && onMove) {
            const piece = gameRef.current.get(moveFrom);
            const isPromotion = (piece?.type === 'p') &&
                ((moveFrom[1] === '7' && sq[1] === '8') ||
                    (moveFrom[1] === '2' && sq[1] === '1'));

            const moveConfig: any = {
                from: moveFrom,
                to: sq,
            };

            if (isPromotion) {
                moveConfig.promotion = 'q';
            }

            const result = onMove(moveConfig);

            if (result) {
                setMoveFrom(null);
                setOptionSquares({});
            } else {
                setMoveFrom(null);
                setOptionSquares({});
            }
            return;
        }

        // Select piece if it's ours
        const piece = gameRef.current.get(sq);
        if (piece && piece.color === (orientation === "white" ? "w" : "b")) {
            setMoveFrom(sq);

            // Get legal moves
            const moves = gameRef.current.moves({
                square: sq,
                verbose: true,
            });

            const newSquares: Record<string, React.CSSProperties> = {};
            moves.forEach((move) => {
                const targetPiece = gameRef.current.get(move.to);
                newSquares[move.to] = {
                    background:
                        targetPiece && targetPiece.color !== piece.color
                            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
                            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
                    borderRadius: "50%",
                };
            });
            newSquares[sq] = {
                background: "rgba(255, 255, 0, 0.4)",
            };
            setOptionSquares(newSquares);
        } else {
            setMoveFrom(null);
            setOptionSquares({});
        }
    }

    if (!mounted) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 aspect-square">
                <p className="text-gray-500">Loading chessboard...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[600px] aspect-square relative">
            <Chessboard
                key={fen}
                options={{
                    position: fen,
                    boardOrientation: orientation,
                    canDragPiece: () => interactive,
                    squareStyles: optionSquares,
                    animationDurationInMs: 200,
                    onPieceDrop: onPieceDrop,
                    onSquareClick: onSquareClick
                }}
            />
            {/* Debug overlay to verify FEN updates */}
            <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] p-1 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                FEN: {fen}
            </div>
        </div>
    );
}
