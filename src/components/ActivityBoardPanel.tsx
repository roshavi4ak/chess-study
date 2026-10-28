"use client";

import ChessnutBoardPanel from "./ChessnutBoardPanel";
import type { useActivityChessnut } from "@/hooks/useActivityChessnut";

export default function ActivityBoardPanel({ board, reply }: { board: ReturnType<typeof useActivityChessnut>; reply?: string }) {
    const formatted = reply ? `${reply.slice(0, 2)} → ${reply.slice(2, 4)}${reply[4] ? ` = ${reply[4].toUpperCase()}` : ""}` : undefined;
    return <ChessnutBoardPanel activity board={board} reply={formatted} onConnect={() => { board.reset(); void board.connect(); }} onScreen={() => board.disconnect(true)} />;
}
