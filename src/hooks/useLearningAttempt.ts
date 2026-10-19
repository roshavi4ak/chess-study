"use client";

import { useRef, useState } from "react";

// Level exercises share puzzle review history, without changing puzzle ratings.
// Generated capture exercises have no database puzzle id and keep their normal level history.
export function useLearningAttempt(puzzleId?: string) {
    const result = useRef<{ success: boolean; hintUsed: boolean } | null>(null);
    const busy = useRef(false);
    const saved = useRef(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    async function save() {
        if (!puzzleId || !result.current || busy.current || saved.current) return;
        busy.current = true;
        setSaving(true);
        setError(false);
        try {
            const response = await fetch("/api/puzzles/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ puzzleId, ...result.current, review: true }) });
            if (!response.ok) throw new Error("Could not save learning attempt");
            saved.current = true;
        } catch { setError(true); }
        finally { busy.current = false; setSaving(false); }
    }
    function record(success: boolean, hintUsed = false) {
        if (!puzzleId || result.current) return;
        result.current = { success, hintUsed };
        void save();
    }
    return { record, retry: save, saving, error };
}
