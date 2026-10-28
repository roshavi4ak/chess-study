"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { browserBluetooth, ChessnutConnection } from "@/lib/chessnutBluetooth";

const subscribeSupport = () => () => {};

function useOwnedTransport() {
    const available = useSyncExternalStore<boolean | null>(subscribeSupport, () => !!browserBluetooth(), () => null);
    const [enabled, setEnabled] = useState(false);
    const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
    const [reading, setReading] = useState<{ position: string | null; revision: number }>({ position: null, revision: 0 });
    const [name, setName] = useState("Chessnut Air");
    const [error, setError] = useState<"connect" | "communication" | null>(null);
    const connection = useRef<ChessnutConnection | null>(null);
    const retiring = useRef<ChessnutConnection | null>(null);

    useEffect(() => () => {
        const client = connection.current;
        connection.current = null;
        retiring.current?.dispose();
        void client?.disconnect().catch(() => {});
    }, []);

    async function connect() {
        const bluetooth = browserBluetooth();
        if (!bluetooth) return;
        connection.current?.dispose();
        retiring.current?.dispose();
        setReading(previous => ({ position: null, revision: previous.revision + 1 })); setEnabled(true); setError(null); setStatus("connecting");
        const client = new ChessnutConnection({
            position: value => { if (connection.current === client) setReading(previous => previous.position === value ? previous : { position: value, revision: previous.revision + 1 }); },
            disconnected: () => {
                if (connection.current !== client) return;
                connection.current = null;
                setReading(previous => ({ position: null, revision: previous.revision + 1 })); setStatus("disconnected");
            },
            error: () => {
                if (connection.current !== client) return;
                client.dispose(); connection.current = null;
                setReading(previous => ({ position: null, revision: previous.revision + 1 })); setError("communication"); setStatus("error");
            },
        });
        connection.current = client;
        try {
            const deviceName = await client.connect(bluetooth);
            if (connection.current !== client) return;
            setName(deviceName); setStatus("connected");
        } catch (error) {
            if (connection.current !== client) return;
            const cancelled = error instanceof DOMException && ["NotFoundError", "AbortError"].includes(error.name);
            setStatus(cancelled ? "disconnected" : "error");
            setError(cancelled ? null : "connect");
        }
    }

    function disconnect(screen = false) {
        const client = connection.current;
        connection.current = null;
        retiring.current = client;
        void client?.disconnect().catch(() => {}).finally(() => {
            if (retiring.current === client) retiring.current = null;
        });
        setReading(previous => ({ position: null, revision: previous.revision + 1 })); setStatus("disconnected"); setError(null);
        if (screen) setEnabled(false);
    }
    return { available, enabled, status, position: reading.position, revision: reading.revision, name, error, connection, connect, disconnect };
}

const Context = createContext<ReturnType<typeof useOwnedTransport> | null>(null);

/** Keep one connection while a lesson changes questions; release it when leaving the activity. */
export function ChessnutSession({ children }: { children: React.ReactNode }) {
    const transport = useOwnedTransport();
    return <Context.Provider value={transport}>{children}</Context.Provider>;
}

export function useChessnutTransport() {
    const shared = useContext(Context);
    const local = useOwnedTransport();
    return shared ?? local;
}
