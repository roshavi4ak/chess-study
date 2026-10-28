"use client";

import { useState } from "react";
import { useChessnutBoard } from "./useChessnutBoard";
import type { BoardMove, PhysicalCandidate } from "@/lib/chessnut";

interface Options {
    fen: string;
    canMove: boolean;
    onMove(move: BoardMove): boolean | Promise<boolean>;
    expectedMoves?: string[];
    candidates?: PhysicalCandidate[];
    hintMove?: string;
    completion?: string | number;
    syncMove?: string;
    guideSquares?: string[];
    onLift?(square: string): boolean;
    active?: boolean;
}

/** Follow engine moves and exercise resets while requiring stable physical placement before continuing. */
export function useActivityChessnut(options: Options) {
    const [epoch, setEpoch] = useState(0);
    const board = useChessnutBoard({ ...options, epoch, synchronize: true, expectedMoves: options.expectedMoves ?? [], onReply() {} });
    return { ...board, ready: !board.enabled || (options.active !== false && board.synchronized), reset: () => setEpoch(value => value + 1) };
}
