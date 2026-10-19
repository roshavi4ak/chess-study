# Defense levels and varied endgames — 19 October 2026

## Defense detective

The existing twenty introductory positions are **Level 1**. A selector exposes Levels 1–10 without artificial locks. Levels 2–10 draw five random positions per round from the existing uploaded `Puzzle` records tagged `defensiveMove`. A read-only inventory found 23,216 such puzzles.

| Level | Puzzle rating band | Minimum student moves in stored solution |
| --- | --- | --- |
| 1 | Authored introductory attacks | 1 |
| 2 | 400–899 | 1 |
| 3 | 900–1099 | 1 |
| 4 | 1100–1299 | 1 |
| 5 | 1300–1499 | 2 |
| 6 | 1500–1749 | 2 |
| 7 | 1750–1949 | 2 |
| 8 | 1950–2099 | 3 |
| 9 | 2100–2249 | 3 |
| 10 | 2250–2599 | 3 |

The server validates the full legal solution, normalizes moves to UCI, and requires the selected rating band, topic and minimum length. It does not fill a difficult level with easier puzzles if loading fails. Recent positions are excluded from subsequent rounds during the visit. The upper bound of the rating band is a selection limit; the imported collection currently ends below it.

Students watch the opponent's move and defend on the full board, oriented to their side. The higher levels have no candidate buttons. Correct stored moves play the opponent's continuation automatically and require the student's next defense. The puzzle name/rating stays visible; topic labels appear after solving to avoid revealing the motif beforehand.

Alternative legal moves receive two Stockfish searches at depth 14: one after the stored defense, one after the student's move. The comparison uses the opponent's perspective, a 60-centipawn tolerance, and mate scores. An alternative preserving the evaluation passes the position; it does not have to follow the stored continuation. The UI describes this as an engine-depth assessment, not a mathematical proof. Weaker moves show the actual legal engine variation on a separate board. Engine failures leave the board unchanged and offer another attempt; they do not count as mistakes. Hints/mistakes mark assisted practice.

Completed rounds save through the existing `MINIGAME` action with keys `defense:level:1` through `defense:level:10`, plus level, position IDs and independent count. Best stars appear per level. No puzzle attempts, ratings or database schema are changed. The original introductory `defense:round` history remains intact.

## Endgame variety and new mates

All seven categories choose a random starting arrangement on entry, selection and restart. Immediate repeated starts are avoided. The demonstrations remain fixed teaching examples on a separate board.

There are forty independently verified seeds for each category: queen mate, rook mate, pawn promotion, king/pawn teamwork, saving a rook-pawn draw, **two-bishop mate**, and **bishop-and-knight mate**. Non-pawn endings can use all eight board symmetries; pawn endings only reflect across files to preserve pawn direction. Kings are nonadjacent, Black has not left its own king in check, no starting position is terminal, and two bishops occupy opposite-colored squares.

Both White-pawn categories enforce a strictly smaller king-move distance from our king to the pawn than from the opposing king. Every winning seed is additionally a tablebase win, so distance alone is not used as evidence that promotion is possible. The rook-pawn drawing challenge is intentionally selected from drawn positions with the opponent's pawn.

`scripts/generate-endgame-starts.cjs` produced the 280 seeds in `src/lib/endgameStarts.json`, using the [official Lichess tablebase API](https://github.com/lichess-org/lila-tablebase#http-api). It is an offline, resumable content tool and does not touch the database. It backs off when rate limited. Each seed records its category and distance to mate when available.

The live endgame move/hint advisor uses best-first Syzygy moves, which is especially important for bishop-and-knight technique and fifty-move-rule accuracy. The server validates small legal positions, shares identical in-flight requests, serializes upstream calls, caches at most 512 replies, bounds the queue, and observes a rate-limit cooldown. Network failures expose retry/takeback controls. The browser cancels stale replies and times out an advisor request after twenty seconds. The interface credits Lichess/Syzygy.

Both languages are included. Existing unrated activity saving and assistance distinctions are retained. No migration or dependency upgrade is required.

## Verification

- 138 passing tests cover the new functionality and existing puzzle/learning regressions. These include 45 real uploaded defensive-puzzle fixtures across Levels 2–10, all 280 endgame seeds, randomized supported pawn positions, alternate-move scoring, full upper-level continuations in English/Bulgarian, stale loads/replies, advisor caching and worker cancellation.
- Local production build, TypeScript, lint, fun-mode and translation checks passed.
- Mobile browser checks use a 390-pixel viewport. Deployment checks additionally query every advanced level twice in a read-only transaction and verify that the second five-position round excludes the first.

The larger levels are selected by puzzle difficulty and solution length. Classroom observation is still needed to tune those bands for this club's students; stored ratings do not establish a student's age or skill mastery.
