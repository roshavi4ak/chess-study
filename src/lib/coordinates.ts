export const COORDINATES_SECONDS = 30;
const FILES = "abcdefgh";

export function randomSquare(previous?: string, random = Math.random): string {
    // Never the same square twice in a row.
    for (;;) {
        const square = `${FILES[Math.floor(random() * 8)]}${1 + Math.floor(random() * 8)}`;
        if (square !== previous) return square;
    }
}
