# Learning loop plan — 13 October 2026

Goal: make each child's daily session personal and short (about 5 minutes), built on spaced review of what they already learned, with the coach in the loop. Rewards come from proven retention, not from clicks.

## Principles

- **Derive, don't store, where possible.** `PracticeAttempt` and `PuzzleAttempt` already hold full history. Review levels, missions, streaks and mastery are computed from that history, so Phase 1 and Phase 3 need no schema change.
- **Day boundaries are Sofia days**, sharing the helpers in `src/lib/leaderboardWeeks.ts`.
- **Kind to kids.** Mistakes lower a line's level gently (−2), never to zero from a high level in one go; hints never cost anything except the "perfect" mark that already exists; the weekly streak is 4 active days out of 7, so a missed day is fine.
- **Pure logic in `src/lib`, checked by `scripts/test-*.cjs`**, matching the existing regression scripts.

## Phase 1 — Review queue and daily mission (no schema change)

Status: implemented 13 October 2026, deployed 14 October 2026. `scripts/test-review-schedule.cjs`, `tsc` and `next build` pass; not yet tried in a browser against real data.

1. `src/lib/reviewSchedule.ts` — per-line review level from attempt history.
   - Level rises by 1 for a PERFECT completion on a new Sofia day (several perfect runs on the same day count once).
   - A completion with mistakes or hints lowers the level by 2 (minimum 0).
   - Next review: last attempt day + `[1, 2, 4, 8, 16, 32]` days by level. A line is due when that day has arrived.
   - Level ≥ 3 (perfect on three separate days) = **mastered**. Phase 3 builds on this.
2. `src/lib/dailyMission.ts` — builds today's mission from the history before today, so it stays stable while the child works through it.
   - **Review task:** up to 5 due lines (lowest level, then most overdue first), grouped by practice. Done when each has a completed attempt today.
   - **New-line task** (only when nothing is due): learn one unseen line in a practice the child has already started.
   - **Puzzle task:** 3 puzzles in the child's weakest theme over the last 30 days (at least 3 attempts and at least 1/3 failed), otherwise 3 puzzles of any theme. Attempts count, not only successes.
   - **Weekly streak:** a day is active with ≥1 completed line or ≥3 puzzle attempts; target 4 of 7 days, Monday–Sunday.
3. `src/app/actions/mission.ts` — `getDailyMission()` and `getDueLineIds(practiceId)` server actions.
4. `src/components/DailyMission.tsx` on the student dashboard: tasks with progress bars, links, and the week's dots.
5. Review mode in the practice session: `/practices/[id]?review=1` serves only that practice's due lines, then shows "Review done" and returns to normal practice.
6. Translations (en/bg) and `scripts/test-review-schedule.cjs`.

## Phase 2 — Coach homework and "who's stuck" (schema: one new table)

Status: implemented 13 October 2026, deployed 14 October 2026; `prisma db push` ran on the VPS after a database backup and review of the additive schema diff. The authenticated coach help dashboard and homework page were verified. See [the deployment record](website-deployment-2026-10-14.md). Without the table, the coach "who needs help" panel shows an error message and the student mission card stays hidden; the rest of the site is unaffected.

- Homework page: `/coach/assignments` (linked from the coach dashboard). Homework is for one student or all students: either "play N different lines of a practice" or "try N puzzles of a theme", with a due day and an optional note. Only work done after the homework was set counts. Coaches can delete only their own homework.
- Children see homework at the top of their mission until the due day passes; overdue homework is shown to coaches only.
- The coach dashboard's new "Who needs help" table lists every student with last active day, active days this week, review backlog, lines mastered (+ this week), weakest theme and homework done, with flags for inactive (5+ days), a big review pile (10+ lines due) and overdue homework. Flagged students sort first.

- `Assignment` model: coach, student (or all students), target (practice / practice lines / puzzle tag), count, due date. Added with `prisma db push` (no shadow database, see `SAFE_DB_OPERATIONS.md`).
- Assignments appear first in the child's daily mission.
- Coach dashboard: per student — due-line backlog, weakest puzzle theme, last active day, lines mastered this week. Highlight children with a growing backlog or no activity for 5+ days.

## Phase 3 — Mastery cards (derived)

Status: implemented 13 October 2026, deployed 14 October 2026; no schema change. Collection page at `/cards` (navbar "Cards"), a summary with tier counts on the dashboard, and a "new card" celebration the first time a tier is seen (remembered per browser and child in `localStorage`; if storage is blocked the celebration can repeat, nothing else breaks). Theme cards count different days with at least one solved puzzle of the theme: bronze 3, silver 5, gold 10. Coach-awarded cards are not built yet.

- A card per practice, earned when every line reaches level ≥ 3; bronze/silver/gold for 50% / 80% / 100% of lines mastered.
- Puzzle-theme cards from a solve rate over recent attempts across different days.
- A collection page; a coach can award a special card by hand (needs a small `AwardedCard` table, can come later).

## Phase 4 — Fairer leaderboard

Status: implemented 13 October 2026, deployed 14 October 2026. A new first (default) "Effort" tab on the leaderboard for the current Sofia week: 10 points per active day, 5 per line mastered this week, 1 per puzzle tried (at most 50). Shows the weekly-goal club (4+ active days), the top 3 puzzle-rating gains, and a table that highlights the viewer; children with no activity this week are not listed. The existing tabs are unchanged.

Leaderboard exclusions are now editable: the hardcoded list moved to a `LeaderboardExclusion` table, edited at `/leaderboard/settings` by the Lichess account `roshavi4ak` only (link shown on the leaderboard for that account). The original three accounts (`mi666ka`, `belozem`, `petar1976`) are filled in automatically the first time the table is read empty; "Show again" only un-hides a row, so they never come back on their own. Before `prisma db push` the leaderboards keep hiding the original three and the settings page explains that the database needs updating. It applies to the current-week/all-time tables and the effort board; the Statistics tab never used it. The Play page's opponent list in `src/app/actions/users.ts` is separate and unchanged.

### Deploy order for phases 2–4

Superseded: see the combined deploy order in `engagement-plan-2026-10-13.md`, which also adds the fun-mode tables.

1. Back up the database.
2. `npx prisma db push` — adds `Assignment`, `AssignmentKind` and `LeaderboardExclusion`; no existing table changes.
3. Deploy the code. Nothing else to run: the hidden-accounts list fills itself in. If step 2 is skipped, the leaderboards still work (original three hidden), and the children's daily mission works without homework, but setting homework, the coach "who needs help" panel and the hidden-accounts editor stay unavailable until it is done.

- A weekly "effort" board next to the rating board: lines mastered + active days + puzzles tried this week, using the existing week ranges.
- Optionally "most improved" (rating gained this week).

## Later

- Real-game links: compare a child's Lichess game moves with their practice tree and suggest the line where they left the prepared moves.
- Curriculum ordering of puzzle themes (prerequisites), then the adventure map as its visual layer.
- Stockfish "win this position" endgame challenges; a "why?" question after an opening line.
