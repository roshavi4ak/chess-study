import { isSkillTag } from "./dailyMission";

interface CategoryTranslator {
    (key: string): string;
    has(key: string): boolean;
}

// Lichess theme tags are the keys of the "PuzzleCategories" messages. Hand-made puzzles sometimes use other
// spellings ("Fork", "middle game", "exposed king"); those are matched to the Lichess key when one fits.
export function themeLabel(tag: string, t: CategoryTranslator): string {
    const words = tag.trim().split(/\s+/);
    const candidates = [
        tag,
        tag.charAt(0).toLowerCase() + tag.slice(1),
        words.map((word, index) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(""),
        words.join("").toLowerCase(),
    ];
    const key = candidates.find(candidate => candidate && t.has(candidate));
    return key ? t(key) : tag;
}

// The puzzle's own theme first, then the skills it trains, then phase/length/source tags.
export function orderThemes(tags: string[], current?: string): string[] {
    const rank = (tag: string) => tag === current ? 0 : isSkillTag(tag) ? 1 : 2;
    return [...new Set(tags)].sort((a, b) => rank(a) - rank(b));
}
