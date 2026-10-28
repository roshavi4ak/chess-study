"use client";

import { useRef, useState } from "react";
import type { MoveError } from "@/lib/attemptMoves";

// Level exercises share puzzle review history, without changing puzzle ratings.
// Generated capture exercises have no database puzzle id and keep their normal level history.
export function useLearningAttempt(puzzleId?: string) {
    const result = useRef<{ success: boolean; hintUsed: boolean } | null>(null);
    const busy = useRef(false);
    const saved = useRef(false);
    const attemptId = useRef<string | null>(null);
    const errors = useRef<MoveError[]>([]);
    const savedErrorCount = useRef(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    async function save() {
        if (!puzzleId || !result.current || busy.current || (saved.current && (errors.current?.length ?? 0) === savedErrorCount.current)) return;
        busy.current = true;
        setSaving(true);
        setError(false);
        try {
            const snapshot = [...errors.current];
            const response = await fetch("/api/puzzles/submit", { method: attemptId.current ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(attemptId.current ? { attemptId: attemptId.current, moveErrors: snapshot } : { puzzleId, ...result.current, review: true, moveErrors: snapshot }), keepalive: true });
            if (!response.ok) throw new Error("Could not save learning attempt");
            const data = await response.json();
            attemptId.current = data.attemptId ?? null;
            savedErrorCount.current = snapshot?.length ?? 0;
            saved.current = true;
        } catch { setError(true); return; }
        finally { busy.current = false; setSaving(false); }
        if (saved.current && (errors.current?.length ?? 0) > savedErrorCount.current) void save();
    }
    function record(success: boolean, hintUsed = false, moveErrors?: MoveError[]) {
        if (!puzzleId) return;
        if (moveErrors) errors.current = moveErrors;
        if (!result.current) result.current = { success, hintUsed };
        void save();
    }
    return { record, retry: save, saving, error };
}
