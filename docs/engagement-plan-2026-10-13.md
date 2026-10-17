# Fun and engagement plan — 13 October 2026

Follow-up to `learning-loop-plan-2026-10-13.md` (review queue, missions, homework, cards, effort board). This plan adds the play-and-explore side: things children choose to do because they are fun, which still teach chess. Ideas come from a survey of ChessKid, Chess.com, Lichess, Duolingo Chess, DragonBox/Magnus Kingdom, Story Time Chess, Chessable and BadukPop (Go).

## Status — implemented and deployed 14 October 2026

Deployment and rollback record: [website-deployment-2026-10-14.md](website-deployment-2026-10-14.md).

All seven phases are built. Entry point: navbar "Играй и учи / Play & learn" (`/fun`).

| Phase | Where | Notes |
|---|---|---|
| A | `/fun/streak`, `/fun/coordinates`, practice arrows, `/certificates` | Unrated streak uses a separate `QuickPuzzleBoard` instead of changing `PuzzleSolver`. Certificates were built last, once there were achievements to certify. |
| B | `/play/bots` | 8 animals. Sloth–Rabbit use a fast built-in move picker (checked by `scripts/bot-ladder.cjs`); Fox–Lion use Stockfish in the browser with a limited Skill Level and depth plus "mistake" moves, falling back to the built-in picker. A depth-2+ JavaScript search was tried first and was far too slow on chess.js. |
| C | `/race`, `/race/new`, `/race/[code]`, `/race/[code]/screen` | Coach races (projector + 4-digit code) and child duels. Polling about once a second via `/api/race/[code]`; answers are checked on the server. |
| D | `/games`, `/games/[world]` | 8 worlds × 6 levels: rook, bishop, queen, king, knight, pawn (incl. pawn wars), Capture Island (guarded squares), Checkmate Castle (mate puzzles). Every board level is solved by a breadth-first search for its star rating and "show me" hint; `scripts/test-fun-modes.cjs` checks all are solvable in ≤ 8 moves. |
| E | `/levels`, dashboard row, coach start-level column, "why?" questions in practice | 15 levels Pawn 1 → Queen 3, then an open-ended King level. "Why?" questions live in their own table keyed by the line's last node (added/edited by coaches right after playing the line), so the practice editors were not changed. |
| F | Leaderboard "Leagues" tab (`/leaderboard?tab=leagues`), dashboard row | Wood → Diamond, groups of ≤ 10, top 3 move up, no relegation. Last week is processed lazily on the first league view after Monday; the very first view after deploying promotes last week's top 3 per group. |
| G | `/tournaments` | Coaches paste a Lichess arena/Swiss link; results are read from Lichess's public API after it ends and stored for club members only. Creating tournaments from the site would need a new Lichess permission and was left out. |

Shared pieces: `PlaySession` (every finished fun activity; counts as an active day and up to 20 effort points a week), new card families (animals, worlds, tournaments) on `/cards`, and `scripts/test-translation-keys.cjs` for missing translations.

Decisions taken without asking (change any time): worlds sized for 4–6-year-olds too; one bot ladder of Sloth, Penguin, Koala, Rabbit, Fox, Bear, Tiger, Lion with cards only (no avatar locking); tournaments work with or without a Lichess team; fun sessions worth 2 effort points (max 20/week).

### Deploy order (covers both plans)

1. Back up the database.
2. `npx prisma db push` — adds `Assignment`, `LeaderboardExclusion`, `PlaySession`, `PuzzleRace`, `PuzzleRaceEntry`, `PracticeQuestion`, `LeagueMembership`, `LeagueWeek`, `ClubTournament`, their enums, and the nullable column `User.startLevel`. No existing data changes.
3. Deploy the code.

If step 2 is skipped, existing pages keep working and the new features degrade quietly (no saving of fun results, empty leagues/tournaments pages with a short note), except races, which need their tables.

### Checks

`node scripts/test-fun-modes.cjs`, `node scripts/bot-ladder.cjs`, `node scripts/test-review-schedule.cjs`, `node scripts/test-translation-keys.cjs`, `npx tsc --noEmit`, `npx next build`. Browser-checked locally without a database: a rook world level (3 stars, next level unlocked), a game against the Sloth (bot replies, take-back), Stockfish with Skill Level in the browser, coordinates scoring in Bulgarian, the hub and Capture Island at phone width.

## Guardrails (apply to every phase)

- **Free and unlimited.** No energy, tickets, timers that block play, loot boxes or paid unlocks (BadukPop's early ticket system was criticised for exactly this).
- **Help early, never punish.** Hints appear before a child gets stuck, not after (a criticism of Magnus Kingdom). Mistakes in games cost nothing.
- **Fun modes are unrated.** Streaks, races, duels, coordinates, mini-games and bots never change the puzzle rating (Lichess Racer is unrated too). They do count as activity for missions, the effort board and the weekly goal.
- **Never take things away.** Existing avatars stay free; unlocks only add (bot cards, frames, certificates). Leagues have no relegation.
- **Kid safety.** No chat or free text between children. Bot dialogue is fixed text written by us. Only first names/nicknames appear on shared screens.
- **Bulgarian first.** Every string in `messages/bg.json` and `messages/en.json`; short sentences; works on a phone and on the club projector.
- **Same engineering habits as before.** Pure rules in `src/lib/*.ts` with checks in `scripts/test-*.cjs`; new tables added with `prisma db push` (no shadow database); every feature keeps working, or hides itself politely, if its table is missing.

## Shared foundation (built in Phase A, reused everywhere)

1. **`PlaySession` table** — one row per finished fun activity:
   `id, userId, kind (STREAK | COORDINATES | DUEL | RACE | MINIGAME | BOT_GAME | LEVEL_TEST), key (e.g. bot id, mini-game id, race id), score Int, won Boolean?, details Json?, createdAt`, indexed by `(userId, kind)`.
   Personal bests, bot wins, mini-game stars and level passes are all read from it.
2. **Activity counts it.** `buildDailyMission`'s active-day rule becomes: ≥1 completed line, ≥3 puzzle attempts, **or ≥1 PlaySession**. The effort board (`src/lib/effortBoard.ts`) adds a small capped bonus (e.g. 2 points per session, max 20/week) so fun play helps but cannot outweigh review.
3. **Unrated puzzle solving.** `PuzzleSolver` currently posts to `/api/puzzles/submit` itself (`src/components/PuzzleSolver.tsx:242`). Add a `rated?: boolean` prop (default `true`); when `false` it only calls `onSolve`. Streaks, races and level tests use `rated={false}`.
4. **"Fun" hub page** `/[locale]/fun` (navbar "Играй и учи" / "Play & learn") listing the modes as big tiles, with each child's personal bests.
5. **More card families** in `src/lib/masteryCards.ts`: bot cards, mini-game world cards, level badges — same bronze/silver/gold look, same "new card" celebration.

## Phase A — Quick wins (effort: S–M)

Inspired by Lichess Coordinates, Lichess Puzzle Streak, Chess.com Puzzle Rush Survival, Duolingo's hint arrows, Magnus Kingdom's diploma.

1. **Coordinates game** — `/fun/coordinates`. 30 seconds, a square name appears ("e4"), the child clicks it; board orientation white or black. Client-only game; score saved as `PlaySession(kind COORDINATES)`. Shows personal best and the club's best this week (first names only).
2. **Puzzle streak** — `/fun/streak`. Puzzles start ~300 below the child's puzzle rating and climb by ~50 each; no clock; the run ends at the first mistake; one "skip" per run; using a hint ends the run gently ("Great run!"). Puzzle choice reuses `getNextPuzzleName`-style SQL with an increasing target rating and no repeats within a run. Saved as `PlaySession(kind STREAK, score = puzzles solved)`.
3. **Gentler hints in opening practice** — in `PracticeSession.tsx`, after the second wrong move in the same position, draw an arrow for the expected move on the board (react-chessboard arrows) in addition to the text hint. Legal-but-not-in-repertoire moves keep the friendly "in this opening we play …" message. No change to PERFECT/COMPLETED rules.
4. **Printable certificates** — `/certificates/[id]`: child's name, achievement, date, coach name, print-friendly CSS (A4, no navbar). Offered for gold cards now, and later for beating all bots, finishing a mini-game world and passing a level. Derived from existing data; no table.

Done when: regression checks for streak rating ladder and PlaySession-based personal bests; streak and coordinates playable on a phone; arrows appear only after the second miss; certificate prints on one A4 page.

## Phase B — Animal bots (effort: M)

Inspired by ChessKid's Zoo Crew, Chess.com's character bots (e.g. "Martin, 250"), BadukPop's ladder of funny opponents.

- **Cast:** 8–10 bots taken from the existing animal avatars (`src/lib/avatars.ts`), ordered weakest to strongest, e.g. Sloth → Penguin → Koala → Rabbit → Fox (loves forks) → Bear → Tiger → Lion. Defined in `src/lib/bots.ts`: `id, avatar, strength settings, style, dialogue keys`.
- **Making weak bots weak on purpose.** The local engine (`src/lib/stockfishWorker.ts`, currently unused; its "easy" = depth 5 is far too strong) gets a move policy per bot:
  - weakest bots: mostly random legal moves, with a chance to grab an undefended piece; never see threats;
  - middle bots: engine at depth 1–3 with a set chance of playing a random or second-best move;
  - stronger bots: Stockfish `Skill Level` plus depth limits;
  - a style bias (Fox prefers knight moves and forks, Rook-loving Bear prefers rook moves).
  Bot strength is tuned by letting bots play each other (`scripts/bot-ladder.cjs`) so each step is clearly stronger than the last.
- **Personality:** 4–6 short lines per bot (greeting, capturing, giving check, losing, winning) in Bulgarian and English. Takebacks allowed against the first three bots.
- **Progress:** beating a bot unlocks the next one and gives that animal's **bot card**; beating all of them gives a certificate. Results saved as `PlaySession(kind BOT_GAME, key = bot id, won)`.
- **Where:** new page `/play/bots`; the Play page gets a "Play an animal" tile next to the existing Lichess modes.

Done when: the ladder script shows each bot beating the previous one most of the time; a beginner can beat the first bot; games work offline after load; bot cards appear in the collection.

## Phase C — Puzzle race and duel (effort: M–L)

Inspired by Lichess Puzzle Racer (90 s, same puzzles, combo bar, one skip, unrated, up to 10 racers) and ChessKid Puzzle Duel (2 minutes, head to head).

- **Coach race for the club lesson.** The coach opens `/race/new`, picks a theme and rating range, and gets a 4-digit code on a projector screen `/race/[code]/screen` (big code, joined names, then live progress bars). Children join at `/race` by typing the code (no link copying — a pain point Lichess users reported).
- **Rules:** 90 seconds; everyone gets the same puzzles in the same order; combo bar fills with correct moves and gives a bonus when full, a wrong move empties it; one skip; unrated (`rated={false}`).
- **Duel:** the same machinery with 2 players and 2 minutes, started by either child with a code.
- **Tech:** no websockets needed. Tables `PuzzleRace (id, code, hostId, puzzleIds String[], status, startsAt, endsAt)` and `PuzzleRaceEntry (raceId, userId, score, combo, skipped, updatedAt)`. Devices poll a small route about once a second; each solve posts the new score. Fine for a club of 30–50.
- **After the race:** podium on the projector, every finisher gets a `PlaySession(kind RACE)`; "Rematch" reuses the group with new puzzles.

Done when: a race with 10 browser tabs stays in sync within ~1 s; scores cannot be posted after `endsAt`; a child who joins late joins the next race.

## Phase D — Mini-games for the youngest (ages 4–8) (effort: M–L)

Inspired by Story Time Chess (a character and story per piece, 30+ mini-games) and DragonBox/Magnus Kingdom (pieces are characters, worlds, no fear of losing).

- **Worlds:** one per piece in learning order: Rook, Bishop, Queen, King, Knight, Pawn; then "Capture", "Check" and "Checkmate in 1" worlds.
- **Game types (data-driven, ~8 levels per world):** collect all the apples in the fewest moves; reach the star without stepping on attacked squares; capture all the pawns; "pawn wars" (pawns only, first to the last rank wins). 1–3 stars by move count.
- **Engine:** a small single-piece move generator in `src/lib/miniGames.ts` (positions without kings are not legal chess, so chess.js is not used here); levels in `src/lib/miniGameLevels.ts`. Board via react-chessboard with apples/stars drawn as square overlays.
- **Story:** a two-line intro per world with a character (e.g. "Rook Rosie only walks in straight lines"), in Bulgarian and English. Optional later: recorded Bulgarian narration for children who cannot read yet.
- **Fearless:** no losing, unlimited retries, a hint button that shows a path after 2 failed tries.
- **Rewards:** stars per level, a world card per world, certificate for finishing all worlds. Saved as `PlaySession(kind MINIGAME, key = level id, score = stars)`.

Done when: move-generator checks pass for every piece; every level is solvable within its star limits (checked by a script that brute-forces each level); playable with a finger on a tablet.

## Phase E — Levels from Pawn to King, and "why?" questions (effort: L)

Inspired by ChessKid Levels (intro video, test questions, stars; guardians can set the start level) and the Chessable caveat that move drilling does not teach ideas.

- **Curriculum** in `src/lib/curriculum.ts`: Pawn 1–3, Knight 1–3, Bishop 1–3, Rook 1–3, Queen 1–3, King (open-ended). Each level = a short lesson (text + diagram, or a link to an existing opening/practice/mini-game world) and a test (e.g. 8 unrated puzzles from a set of themes and a rating band; pass with 6). Mostly tactics, checkmates and endgames for beginners; openings appear only from Bishop level up.
- **Start level:** coaches can set a child's start level on the coach dashboard (new `User.startLevel` column). Passing a level saves `PlaySession(kind LEVEL_TEST, key = level id, won = true)`; the child's level is the first not-yet-passed one.
- **Dashboard and mission:** the current level shows on the dashboard; the daily mission can suggest "Try the Knight 2 test" when the review queue is empty.
- **"Why?" questions** in opening practice: coaches add an optional multiple-choice question to a line in the practice editor (new `PracticeNode.question Json?`: prompt, 2–4 options, correct index). It is asked after the line is completed, once per day; a right answer earns a star; wrong answers just show the explanation.
- **Adventure map later:** the original "chess adventure map" becomes a visual skin over this curriculum once it exists.

Done when: every level's test has enough puzzles in its band (checked by a script against the database); a coach can set a start level; questions appear in practice and are editable in the practice editor.

## Phase F — Weekly leagues (effort: M)

Inspired by Chess.com's Players League (weekly divisions, promotion, no demotion).

- **Tiers:** Wood → Stone → Bronze → Silver → Gold → Diamond. Groups of 8–10 children of the same tier (club sizes are small, so one or two groups per tier).
- **Score:** the week's effort points from `src/lib/effortBoard.ts` — showing up, mastering lines and playing count; rating does not.
- **Weekly change:** the top 3 of each group move up; nobody moves down; children inactive for 2 weeks are simply not placed that week (no "last place" shame). Processed lazily and idempotently on the first leaderboard visit after Monday 00:00 Sofia (no cron), recorded in `LeagueWeek (weekStart unique, processedAt)`; memberships in `LeagueMembership (userId, tier)`.
- **Where:** a "My league" card on the dashboard (group table with the child highlighted), a "Leagues" tab on the leaderboard, and a celebration + card on promotion.
- Respects the hidden-accounts list from `/leaderboard/settings`.

Done when: promotion is checked by a regression script across week boundaries (including daylight-saving weeks, reusing `scripts/test-leaderboard-weeks.cjs` cases); running the weekly step twice changes nothing.

## Phase G — Club tournaments through Lichess (effort: S–M)

Inspired by ChessKid's coach-run club tournaments and its weekly site-wide events.

- **Simple path first:** the coach creates an arena or Swiss on Lichess (restricted to the club's Lichess team) and pastes its link on `/tournaments`. The site shows upcoming tournaments with a "Join on Lichess" button and, afterwards, the standings from Lichess's public tournament results API mapped to our students by `lichessId`.
- **Why not create tournaments from the site:** the current Lichess login only asks for `preference:read email:read challenge:write bot:play board:play` (`src/auth.ts:36`); creating tournaments needs an extra `tournament:write` permission. That could later be requested only from coaches through a separate "connect for tournaments" button, without changing every child's login.
- **Rewards:** taking part gives a "Tournament player" card (bronze/silver/gold for 1/5/15 tournaments) and counts as an active day.
- Table: `ClubTournament (id, lichessUrl, lichessId, name, startsAt, createdBy)`; results cached after the event finishes.

Done when: a pasted Lichess link shows the right start time and, after the event, the right standings for club members.

## Order and dependencies

| Order | Phase | Effort | Needs | New tables / columns |
|---|---|---|---|---|
| 1 | A — Quick wins | S–M | — | `PlaySession` |
| 2 | B — Animal bots | M | A (PlaySession, cards) | — |
| 3 | C — Puzzle race and duel | M–L | A (unrated solver) | `PuzzleRace`, `PuzzleRaceEntry` |
| 4 | D — Mini-games | M–L | A | — |
| 5 | E — Levels and "why?" questions | L | A, D (lessons can point to worlds) | `User.startLevel`, `PracticeNode.question` |
| 6 | F — Leagues | M | effort board (done) | `LeagueMembership`, `LeagueWeek` |
| 7 | G — Club tournaments | S–M | — | `ClubTournament` |

B, C and D are independent after A and can be done in any order; F and G can be done at any time. Each phase is deployable on its own: back up, `npx prisma db push`, deploy.

## Decisions needed from the coach before building

1. **Ages:** are there children aged 4–6? If not, Phase D can be smaller (fewer, harder worlds).
2. **Club devices:** do children use phones, tablets or computers in lessons, and is there a projector? (Affects Phase C screens.)
3. **Bot cast:** which animals, and in what order? Should beating a bot unlock anything besides its card (e.g. an avatar frame)?
4. **Lichess team:** does the club have a Lichess team for Phase G tournaments?
5. **Effort bonus:** is 2 points per fun session (max 20 a week) the right weight next to 10 per active day?
