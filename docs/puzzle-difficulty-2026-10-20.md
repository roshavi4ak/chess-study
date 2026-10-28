# Puzzle rating controls

Normal automatic puzzle selection now uses the student's latest database rating and a bounded relative range. Defaults are **rating through rating +300**, with a preferred target at **rating +100**. Selection uses new, unattempted puzzles; neither exhausted topics nor narrowly populated topics silently widen the range or return retries. Client-supplied ratings and user IDs are ignored.

Coaches configure each student's minimum/maximum offsets, preferred target and permission to choose a target under **Coach → student profile → Puzzles**. Students use **Puzzle difficulty** on the puzzles page or current puzzle screen. Presets target their own rating, +100 or +300; a numeric preference is also allowed inside the coach's limits. Limits follow rating changes automatically. Offsets are whole numbers between −600 and +1000; a preferred target must lie within the configured limits.

Settings affect the next selected puzzle and preserve the current board. Shared/history URLs, deliberate unrated review, curriculum exercises, streak ladders and Defense detective retain their separate purposes. An empty automatic band displays its actual rating bounds and offers another topic or settings instead of silently issuing an easier puzzle.

Permissions are checked on the server. Student payloads can change only their own preferred target, never limits or another user's settings. Saving locks the user row and re-reads its policy, preventing an older student request from overwriting newly changed coach limits. Coaches can manage student accounts through the existing coaching role model.

The leaderboard labels the count as successful attempts and explains that this includes repeat solves. Competition points still follow the existing independent first-solve rules; this feature does not recalculate historical scores or change the scoring thresholds.

## Persistence and checks

`User.puzzleDifficulty` is a nullable JSONB column. Null uses the defaults. `scripts/add-puzzle-difficulty.sql` adds only that column, with no backfill, reset or modification to ratings or attempt scores. Malformed stored settings fall back to the bounded defaults.

All 227 local regressions passed, including action permissions, stale coach changes, SQL bounds, malicious request overrides, empty ranges, both languages' settings controls and puzzle navigation. Lint and TypeScript checks passed.

## Deployment

Build `-vZ5CjK3blWwX_-u2Cwfe` activated at **2026-10-20T09:26:34Z**, replacing `PRzBUbN5_V4zJp0wfEZ5N`. Deployment directory: `/srv/sites/shah.belovezem.com/puzzle-difficulty-20261020`.

All 227 Linux tests and lint passed. Database-enforced read-only integration checked 16 student/topic selections for hard bounds, prior-attempt exclusion, current-puzzle exclusion and empty topics, alongside existing review and Defense Levels 2–10 checks. Production build/TypeScript, staging and live smoke checks passed for 26 routes, 29 linked JavaScript/CSS assets, both engine assets and the training APIs. Both puzzle-selection APIs reject client rating/user overrides and retain the bounded defaults on empty topics.

Signed-in browser checks verified the coach's own puzzle controls and a student's profile controls, including default rating limits and the +100 target. Changing the preferred-target draft updated the displayed target correctly. A 390-pixel viewport showed the expanded controls without horizontal overflow. No settings were saved and no student results were submitted during browser checks.

A full PostgreSQL dump was saved before applying the additive column SQL. Source checksums and the previous active build were guarded; only the app container was recreated. PostgreSQL's identity/start time remained unchanged and the app was running with zero restarts. No historical score backfill was rerun.

The deployment directory retains the tested source, original changed files, database dump, migration, test/build/integration/staging/live logs and `release-before` for recovery. To roll back the application, preserve the active release under a unique path, restore a copy of `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service with `/opt/websites/compose.shah.yml`. Existing code ignores the nullable column, so it can remain. Avoid restoring the entire database over later student activity.
