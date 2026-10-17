// Remembers, per browser and child, which card tiers were already celebrated.
// Storage can be unavailable (private mode, blocked site data); then every visit simply counts as "seen nothing yet".
const storageKey = (userId: string) => `chess-study:seen-cards:${userId}`;

export function readSeenCards(userId: string): Set<string> | null {
    try {
        const raw = window.localStorage.getItem(storageKey(userId));
        return raw ? new Set(JSON.parse(raw) as string[]) : null;
    } catch {
        return null;
    }
}

export function markCardsSeen(userId: string, keys: string[]) {
    try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(keys));
    } catch {
        // Nothing to do: the celebration may show again next time.
    }
}
