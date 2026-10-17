// Reading club tournaments from Lichess's public API (no login needed).

export type TournamentKind = "ARENA" | "SWISS";

// https://lichess.org/tournament/<id> or https://lichess.org/swiss/<id> (any language prefix or extra path).
export function parseTournamentUrl(url: string): { kind: TournamentKind; lichessId: string } | null {
    const match = url.trim().match(/lichess\.org\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(tournament|swiss)\/([A-Za-z0-9]{8})(?:[/?#]|$)/);
    if (!match) return null;
    return { kind: match[1] === "swiss" ? "SWISS" : "ARENA", lichessId: match[2] };
}

export const tournamentUrl = (kind: TournamentKind, lichessId: string) =>
    `https://lichess.org/${kind === "SWISS" ? "swiss" : "tournament"}/${lichessId}`;

export interface TournamentInfo {
    name: string;
    startsAt: Date;
    finishesAt: Date | null;
    finished: boolean;
}

// Arena: { fullName, startsAt, minutes, isFinished }. Swiss: { name, startsAt, status }.
export function parseTournamentInfo(kind: TournamentKind, json: Record<string, unknown>): TournamentInfo {
    const startsAt = new Date(String(json.startsAt));
    if (kind === "ARENA") {
        const minutes = Number(json.minutes);
        return {
            name: String(json.fullName ?? json.name ?? "Arena"),
            startsAt,
            finishesAt: Number.isFinite(minutes) ? new Date(startsAt.getTime() + minutes * 60000) : null,
            finished: json.isFinished === true,
        };
    }
    return { name: String(json.name ?? "Swiss"), startsAt, finishesAt: null, finished: json.status === "finished" };
}

export interface TournamentResult {
    lichessId: string;
    rank: number;
    score: number;
}

// Results come as one JSON object per line; arena uses "score", Swiss "points".
export function parseResults(ndjson: string): TournamentResult[] {
    return ndjson.split("\n").filter(line => line.trim()).map(line => {
        const row = JSON.parse(line) as { rank: number; score?: number; points?: number; username: string };
        return { lichessId: row.username.toLowerCase(), rank: row.rank, score: Number(row.score ?? row.points ?? 0) };
    });
}

const FETCH_TIMEOUT_MS = 10000;

async function lichess(path: string) {
    const response = await fetch(`https://lichess.org${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) throw new Error(`Lichess answered ${response.status}`);
    return response;
}

export async function fetchTournamentInfo(kind: TournamentKind, lichessId: string) {
    const response = await lichess(`/api/${kind === "SWISS" ? "swiss" : "tournament"}/${lichessId}`);
    return parseTournamentInfo(kind, await response.json());
}

// Club tournaments are small; 500 rows is plenty.
export async function fetchTournamentResults(kind: TournamentKind, lichessId: string) {
    const response = await lichess(`/api/${kind === "SWISS" ? "swiss" : "tournament"}/${lichessId}/results?nb=500`);
    return parseResults(await response.text());
}
