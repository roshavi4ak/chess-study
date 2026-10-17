import type { BotPolicy } from "./botEngine";

export interface BotProfile {
    id: string;
    avatar: string; // file in /img/avatars
    // Used for the weak bots, for the "mistake" moves of strong bots, and as the fallback when Stockfish is unavailable.
    policy: BotPolicy;
    // Stronger bots ask Stockfish in the browser with a limited skill level and depth.
    stockfish?: { skill: number; depth: number };
    takebacks: boolean;
}

// Weakest first. Beating a bot unlocks the next one. Names and lines live in messages under "Bots.<id>".
export const BOTS: BotProfile[] = [
    { id: "sloth", avatar: "Sloth.png", policy: { randomChance: 1, lookahead: 0, captureWeight: 0, style: "none" }, takebacks: true },
    { id: "penguin", avatar: "Penguin.png", policy: { randomChance: 1, lookahead: 0, captureWeight: 4, style: "captures" }, takebacks: true },
    { id: "koala", avatar: "Koala.png", policy: { randomChance: 0.5, lookahead: 1, captureWeight: 3, style: "none" }, takebacks: true },
    { id: "rabbit", avatar: "Rabbit.png", policy: { randomChance: 0.15, lookahead: 1, captureWeight: 3, style: "pawns" }, takebacks: false },
    { id: "fox", avatar: "Fox.png", policy: { randomChance: 0.25, lookahead: 1, captureWeight: 3, style: "knights" }, stockfish: { skill: 0, depth: 1 }, takebacks: false },
    { id: "bear", avatar: "Bear.png", policy: { randomChance: 0.15, lookahead: 1, captureWeight: 3, style: "none" }, stockfish: { skill: 2, depth: 3 }, takebacks: false },
    { id: "tiger", avatar: "Tiger.png", policy: { randomChance: 0.06, lookahead: 1, captureWeight: 3, style: "checks" }, stockfish: { skill: 6, depth: 6 }, takebacks: false },
    { id: "lion", avatar: "Lion.png", policy: { randomChance: 0, lookahead: 1, captureWeight: 3, style: "none" }, stockfish: { skill: 12, depth: 10 }, takebacks: false },
];

export const botKey = (id: string) => `bot:${id}`;

// A bot is open when it is the first one or the previous one has been beaten.
export function unlockedBots(beatenIds: Set<string>): Set<string> {
    const open = new Set<string>();
    BOTS.forEach((bot, index) => {
        if (index === 0 || beatenIds.has(BOTS[index - 1].id)) open.add(bot.id);
    });
    return open;
}

// Wins needed against one bot for its bronze / silver / gold card.
export const BOT_CARD_WINS = [1, 3, 5];
