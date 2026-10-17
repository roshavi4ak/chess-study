export function getLichessAnalysisUrl(fen: string, orientation: "white" | "black" = "white"): string {
    return `https://lichess.org/analysis/standard/${fen.replaceAll(" ", "_")}?color=${orientation}`;
}
