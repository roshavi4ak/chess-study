# Student profiles, level practice and new puzzles — deployed 17 October 2026

Live site: https://shah.belovezem.com

Deployed build `2Q4qhdvNKkmF6UgOFsPlT` at `/srv/sites/shah.belovezem.com/release`. Previous build: `33CyCF5nq64M_9PRzNprd`. The app was healthy right after activation.

## What changed

- **Levels page:** "Първо се упражни" now practises on the Levels page itself, with exercises like the test's (Pawn 1 gets freshly generated safe-capture positions; every other level uses puzzles of its own topic and difficulty). Every level shows a short description of what it teaches. Finished practice rounds are saved as `LEVEL_PRACTICE` play sessions.
- **Level topics:** Knight 2 is now checkmates given by a knight; Rook 3 is rook endgames (5) plus pawn promotion (3); Queen 3 is queen sacrifices (4) plus removing the defender (4), topped up with queen sacrifices and then any sacrifice when short. Level ids are unchanged, so passed levels stay passed.
- **Student profile** (`/coach/students/[id]`, coaches only): ratings, activity calendar, puzzle-rating chart, homework with progress, suggestions for how to help, levels, every opening practice line with attempts and wrong moves, opening courses viewed, puzzle themes, recent puzzles, fun activities, Lichess games and a full activity timeline. Names link to it from the coach dashboard, "Who needs help", the homework page and (for coaches) the leaderboard.
- **Homework:** new "Pass a level test" homework type; homework can be given directly from a profile, pre-filled from a suggestion.
- **Practice lines** now record the exact number of wrong moves and whether hints were shown.

## Puzzle import

Imported 100,000 Lichess puzzles rated 400–1499 (9,091 per 100-point band), all with popularity ≥ 80 and ≥ 100 plays, none already present. One transaction; total puzzles 190,468 → 290,468 (under 1500: 108,179). Imported names are listed in `~/backups/puzzle-import-20261017-names.txt` on the VPS. Against the live data, every level produced a full 8-puzzle test in 50 of 50 simulated draws.

## Database update

Database backup first: `/srv/sites/shah.belovezem.com/profile-levels-20261017/database-before.dump` (PostgreSQL custom format, ~20 MB, 24 tables of data, checked with `pg_restore --list`). The reviewed `prisma migrate diff` was purely additive and `npx prisma db push --skip-generate` applied it:

- `AssignmentKind` + `LEVEL`, `PlayKind` + `LEVEL_PRACTICE`
- `PracticeAttempt.mistakes INTEGER NOT NULL DEFAULT 0`, `PracticeAttempt.usedHints BOOLEAN NOT NULL DEFAULT false`

Counts were unchanged across the push: 23 users, 290,468 puzzles, 3,440 puzzle attempts, 1,244 practice attempts, 438 line-progress rows, 121 play sessions.

## Build and validation

- Source: the server source plus the 29 changed files (all other server files matched the local copy). Production dependency versions were kept (Next.js 16.3.8, React 19.2.7, Prisma 6.19.0); the local `package.json` was not uploaded.
- Built in a throwaway `websites-shah-node:22` container on the web and database networks, using a writable copy of the Linux `node_modules` (needed to regenerate the Prisma client). Build log: `profile-levels-20261017/build.log`.
- On the VPS: lint passed, and the level-exercise, fun-mode, review-schedule, translation, practice-line and leaderboard-week checks passed. Locally all eight regression scripts, TypeScript and lint passed.
- A staging container served `/en`, `/bg`, `/bg/levels`, `/en/levels`, `/bg/puzzles`, `/bg/practices`, `/bg/fun` with 200 and redirected signed-out visitors away from coach pages (307). The same checks passed on the live site over HTTPS, with CSS and Stockfish assets returning 200.
- Only the app container was recreated; PostgreSQL's container ID and start time were unchanged. Build and staging containers were removed.
- Not verified: signed-in pages (student profile, level practice, homework form), because that needs a coach sign-in through Lichess.

Known, unchanged behaviour: a signed-out visitor on `/levels` sees an empty placeholder and the server logs `Error: Unauthorized` for the level request. The `next-intl` `ENVIRONMENT_FALLBACK` warning also remains.

## Follow-up release (same day)

Build `EmIHuPrnyVlPlHmhzVLsm` (previous `2Q4qhdvNKkmF6UgOFsPlT`), folder `/srv/sites/shah.belovezem.com/practice-links-20261017` with its own `release-before` and `source-before`. No database change.

- Exercises (practice and tests): the opponent's reply now plays automatically 0.35 s after a correct move; the "show the opponent's reply" button is gone.
- Level practice has no end: batches load ahead of time, unseen positions come first, "Stop practising" shows the summary, and every 8 finished exercises are saved as a practice round.
- Coaches can open profiles from every leaderboard tab (effort, leagues, statistics winners and all-time winners), not only the puzzle and opening tables.
- Built with the same Linux modules (mounted read-only from `profile-levels-20261017/source/node_modules`). Lint and the level, fun-mode, translation and leaderboard checks passed on the VPS; staging and live pages returned the expected 200/307.

## Bulgarian puzzle themes (same day)

Build `xhLYofJ-ZtMHTuyFMROOU` (previous `EmIHuPrnyVlPlHmhzVLsm`), folder `/srv/sites/shah.belovezem.com/puzzle-themes-bg-20261017`. No database change.

- The puzzle page lists every theme of the puzzle in the visitor's language: the theme being practised first (green), then skills (blue), then phase/length/source tags (grey); the English tag is kept as a tooltip. Rating, "Lichess puzzle …", "Created by" and "Edit" are translated, as are the puzzle-loading errors and the board's loading text.
- Bulgarian theme names were revised to sentence case and standard terms (e.g. "Вилка", "Открито нападение", "Произвеждане на пешка", "Мат в 1 ход"); the two missing themes (`killBoxMate`, `vukovicMate`) were added. Hand-made spellings such as "middle game" map to the Lichess theme.
- Verified live: `/bg/puzzles/0xHHh` shows only Bulgarian labels.

## Files and rollback

- Deployment folder: `/srv/sites/shah.belovezem.com/profile-levels-20261017` (`source`, `source-before`, `release-before`, `database-before.dump`, `build.log`, `changed-files.tgz`).
- `source/node_modules` (≈ 940 MB) holds the Prisma client generated for the new schema; reuse it for the next build, or delete it if disk space is needed (the disk was 89 % full).

Application rollback: preserve the current release under a new path, copy `profile-levels-20261017/release-before` to `/srv/sites/shah.belovezem.com/release`, then

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

The schema additions are compatible with the previous build, so leave the database as it is. Do not restore the database dump for a code rollback: it would discard student activity since the backup and the puzzle import.
