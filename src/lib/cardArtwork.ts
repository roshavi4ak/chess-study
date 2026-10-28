import type { MasteryCard } from "./masteryCards";
import { CARD_ACTIVITIES } from "./cardActivities";

const THEME_ART = new Set([
    "mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5", "fork", "pin", "skewer",
    "discoveredAttack", "doubleCheck", "deflection", "interference", "intermezzo", "sacrifice",
    "clearance", "attraction", "zugzwang", "xRayAttack", "promotion", "underPromotion",
    "queenRookEndgame", "queenEndgame", "rookEndgame", "bishopEndgame", "knightEndgame", "pawnEndgame",
    "defensive", "quiet", "trappedPiece", "hangingPiece", "exposedKing", "advancedPawn",
    "capturingDefender", "enPassant", "castling", "kingsideAttack", "queensideAttack",
    "smotheredMate", "backRankMate", "arabianMate", "anastasiaMate", "bodenMate", "doubleBishopMate",
    "dovetailMate", "hookMate", "attackingF2F7", "killBoxMate", "vukovicMate",
]);
const BOTS = new Set(["sloth", "penguin", "koala", "rabbit", "fox", "bear", "tiger", "lion"]);
const WORLDS = new Set(["rook", "bishop", "queen", "king", "knight", "pawn", "capture", "mate"]);
const OPENING_ART: [RegExp, string][] = [
    [/vienna.*counter|защита срещу виен/i, "viennaCounter"],
    [/vienna.*mastery|виенски гамбит.*разширен/i, "viennaMastery"],
    [/vienna game|виенска партия/i, "viennaGame"],
    [/vienna.*gambit|виенски гамбит/i, "viennaGambit"],
    [/alapin|алапин/i, "alapin"],
    [/jobava|джобава/i, "jobava"],
    [/queen.*gambit.*accepted|приет дамски/i, "queensAccepted"],
    [/queen.*gambit.*declined|отказан дамски/i, "queensDeclined"],
    [/king.*indian|староиндийска/i, "kingsIndian"],
    [/king.*gambit|царски гамбит/i, "kingsGambit"],
    [/albin|албин/i, "albin"],
    [/ponziani|понциани/i, "ponziani"],
    [/bishop.*opening|дебют на офицера/i, "bishopsOpening"],
    [/english opening|английско начало/i, "english"],
    [/petrov|петров/i, "petrov"],
    [/scandinavian|скандинавска/i, "scandinavian"],
    [/ruy lopez|испанска/i, "ruyLopez"],
    [/french|френска/i, "french"],
    [/sicilian|сицилианска/i, "sicilian"],
    [/london|лондон/i, "london"],
    [/scotch|шотландска/i, "scotch"],
    [/caro.?kann|каро.?кан/i, "caroKann"],
    [/italian|италианска/i, "italian"],
    [/stafford|стафорд/i, "stafford"],
    [/rousseau|русо/i, "rousseau"],
    [/englund|енглунд/i, "englund"],
    [/danish|датски/i, "danish"],
    [/traxler|тракслер/i, "traxler"],
    [/fried.?liver|пържен/i, "friedLiver"],
];

// Whitelist filenames so new tags, bots and teacher-created practices always have artwork.
export function getCardArtwork(card: MasteryCard): string {
    let artwork = "opening-explorer";
    if (card.kind === "tournament") artwork = "tournament";
    if (card.kind === "activity" && CARD_ACTIVITIES.some(activity => activity.id === card.tag)) artwork = `activity-${card.tag}`;
    if (card.kind === "bot" && card.tag && BOTS.has(card.tag)) artwork = `bot-${card.tag}`;
    if (card.kind === "world" && card.tag && WORLDS.has(card.tag)) artwork = `world-${card.tag}`;
    if (card.kind === "theme" && card.tag) {
        const tag = ({ defensiveMove: "defensive", quietMove: "quiet" } as Record<string, string>)[card.tag] ?? card.tag;
        artwork = THEME_ART.has(tag) ? `theme-${tag}` : "world-knight";
    }
    if (card.kind === "practice") {
        const opening = OPENING_ART.find(([pattern]) => pattern.test(card.name));
        if (opening) artwork = `opening-${opening[1]}`;
        else if (/gambit|гамбит/i.test(card.name)) artwork = "opening-gambit";
        else if (/defen[cs]e|защита/i.test(card.name)) artwork = "opening-guardian";
    }
    return `/img/cards/${artwork}.webp`;
}
