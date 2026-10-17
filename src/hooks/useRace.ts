"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RaceView } from "@/lib/raceState";

const POLL_MS = 1000;

// Polls a race about once a second. `now()` is the server's clock, so countdowns agree on every device.
export function useRace(code: string) {
    const [view, setView] = useState<RaceView | null>(null);
    const [missing, setMissing] = useState(false);
    const [, setTick] = useState(0);
    const offset = useRef(0);

    const refresh = useCallback(async () => {
        try {
            const response = await fetch(`/api/race/${encodeURIComponent(code)}`, { cache: "no-store" });
            if (response.status === 404) {
                setMissing(true);
                return;
            }
            if (!response.ok) return;
            const data = (await response.json()) as RaceView;
            offset.current = new Date(data.serverNow).getTime() - Date.now();
            setView(data);
        } catch {
            // A missed poll is fine; the next one catches up.
        }
    }, [code]);

    useEffect(() => {
        const first = setTimeout(() => void refresh(), 0);
        const poll = setInterval(() => void refresh(), POLL_MS);
        // Re-render a few times a second so clocks move smoothly between polls.
        const tick = setInterval(() => setTick(value => value + 1), 250);
        return () => {
            clearTimeout(first);
            clearInterval(poll);
            clearInterval(tick);
        };
    }, [refresh]);

    // Server time, used for countdowns and the race clock.
    const now = () => Date.now() + offset.current;
    return { view, missing, refresh, now };
}

export function secondsUntil(iso: string | null, now: number) {
    return iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000)) : 0;
}
