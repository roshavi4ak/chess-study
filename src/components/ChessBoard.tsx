import { useState, useEffect, useRef } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useLegalMoves } from "@/hooks/useLegalMoves";

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
    const [mounted, setMounted] = useState(false);

    // We need a stateful game for the hook, or we can pass the ref's current?
    // The hook takes 'game'. If we pass gameRef.current, it won't trigger re-renders when game changes unless we force it.
    // However, ChessBoard component here seems to rely on 'fen' prop changes to update gameRef.
    // Let's create a state wrapper for the game to ensure hook reactivity, 
    // OR just rely on the fact that this component remounts or updates when fen changes.
    // The existing code re-instantiated Chess on useEffect([fen]).

    // Better approach: Synchronize state with prop.
    const [game, setGame] = useState(new Chess(fen === "start" ? undefined : fen));

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        try {
            const newGame = new Chess(fen === "start" ? undefined : fen);
            gameRef.current = newGame;
            setGame(newGame);
            console.log("ChessBoard: Updated from FEN:", fen);
        } catch (e) {
            console.error("ChessBoard: Invalid FEN:", fen, e);
        }
    }, [fen]);

    const { onSquareClick, onPieceClick, optionSquares, setOptionSquares, onPieceDrop } = useLegalMoves({
        game,
        onMove: onMove ? (move) => {
            // Adapt the hook's onMove to the props onMove
            return onMove(move);
        } : undefined,
        boardOrientation: orientation
    });

    const handlePieceDrop = (source: string, target: string, piece: string) => {
        if (!interactive) return false;
        return onPieceDrop({ sourceSquare: source as Square, targetSquare: target as Square });
    };

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
                    onPieceDrop: handlePieceDrop,
                    onSquareClick: (args: any) => {
                        if (interactive) onSquareClick(args);
                    },
                    onPieceClick: (args: any) => {
                        if (interactive) onPieceClick(args);
                    }
                } as any}
            />
            {/* Debug overlay to verify FEN updates */}
            <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] p-1 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                FEN: {fen}
            </div>
        </div>
    );
}
