import { useMemo, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Chess } from "chess.js";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { Chessboard } from "react-chessboard";
import { useLegalMoves } from "@/hooks/useLegalMoves";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

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
    const t = useTranslations("Common");
    const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
    const game = useMemo(() => {
        try {
            return new Chess(fen === "start" ? undefined : fen);
        } catch (error) {
            console.error("ChessBoard: Invalid FEN:", fen, error);
            return new Chess();
        }
    }, [fen]);

    const { onSquareClick, onPieceClick, optionSquares, onPieceDrop } = useLegalMoves({
        game,
        onMove: onMove ? (move) => {
            // Adapt the hook's onMove to the props onMove
            return onMove(move);
        } : undefined,
        boardOrientation: orientation
    });

    const handlePieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
        if (interactive) void onPieceDrop({ sourceSquare, targetSquare });
        // Position is controlled by the parent after onMove completes.
        return false;
    };

    if (!mounted) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 aspect-square">
                <p className="text-gray-500">{t("loadingBoard")}</p>
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
                    onSquareClick: (args) => {
                        if (interactive) onSquareClick(args);
                    },
                    onPieceClick: (args) => {
                        if (interactive) onPieceClick(args);
                    }
                }}
            />
            {/* Debug overlay to verify FEN updates */}
            <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] p-1 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                FEN: {fen}
            </div>
        </div>
    );
}
