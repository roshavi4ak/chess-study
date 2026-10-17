import { Chess, type Move, type Square } from "chess.js";

// Move choice for the animal bots. Weak bots never search: they either play a "preference" move
// (random, nudged by what they like) or look one move ahead and avoid leaving pieces hanging.
// Stronger bots use Stockfish in the browser (see src/hooks/useBotMove.ts) and fall back to this.

const VALUES: Record<string, number> = { p: 100, n: 300, b: 310, r: 500, q: 900, k: 0 };

export type BotStyle = "none" | "captures" | "pawns" | "knights" | "checks";

export interface BotPolicy {
    // Chance to play a preference move instead of the bot's best idea (its "mistakes").
    randomChance: number;
    // 0 = preference moves only; 1 = look one move ahead and keep pieces safe.
    lookahead: 0 | 1;
    // How much a preference move likes capturing (0 = blind to captures).
    captureWeight: number;
    style: BotStyle;
}

type Random = () => number;

const uci = (move: Move) => `${move.from}${move.to}${move.promotion ?? ""}`;

function styleBonus(move: Move, style: BotStyle) {
    if (style === "checks" && move.san.includes("+")) return 4;
    if (style === "knights" && move.piece === "n") return 4;
    if (style === "pawns" && move.piece === "p") return 4;
    if (style === "captures" && move.captured) return 3;
    return 0;
}

// Material for the side that just moved, from a quick look at the square it moved to.
function exchangeLoss(game: Chess, move: Move) {
    const enemy = game.turn();
    const square = move.to as Square;
    const attackers = game.attackers(square, enemy);
    if (!attackers.length) return 0;
    const moved = VALUES[move.promotion ?? move.piece];
    const defended = game.attackers(square, enemy === "w" ? "b" : "w").length > 0;
    if (!defended) return moved;
    const cheapest = Math.min(...attackers.map(from => VALUES[game.get(from)!.type] || 1000));
    return Math.max(0, moved - cheapest);
}

// A move a beginner might like: random, nudged by the bot's preferences.
export function preferenceMove(fen: string, policy: BotPolicy, random: Random = Math.random): string | null {
    const moves = new Chess(fen).moves({ verbose: true });
    if (!moves.length) return null;
    let best = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
        const score = random() * 10 + (move.captured ? policy.captureWeight * VALUES[move.captured] / 100 : 0) + styleBonus(move, policy.style);
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    return uci(best);
}

// One move ahead: take free material, mate when possible, don't hang pieces. Ties are broken randomly.
export function safeMove(fen: string, policy: BotPolicy, random: Random = Math.random): string | null {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;
    let best = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
        game.move(move);
        let score = (move.captured ? VALUES[move.captured] : 0) + (move.promotion ? VALUES[move.promotion] - 100 : 0);
        if (game.isCheckmate()) score += 100000;
        else score -= exchangeLoss(game, move);
        game.undo();
        score += styleBonus(move, policy.style) * 5 + random() * 30;
        if (score > bestScore) {
            bestScore = score;
            best = move;
        }
    }
    return uci(best);
}

export function chooseBotMove(fen: string, policy: BotPolicy, random: Random = Math.random): string | null {
    if (policy.lookahead === 0 || random() < policy.randomChance) return preferenceMove(fen, policy, random);
    return safeMove(fen, policy, random);
}

// Material balance from White's side, used to settle unfinished test games.
export function materialBalance(fen: string) {
    let score = 0;
    for (const row of new Chess(fen).board()) {
        for (const piece of row) if (piece) score += (piece.color === "w" ? 1 : -1) * VALUES[piece.type];
    }
    return score;
}
