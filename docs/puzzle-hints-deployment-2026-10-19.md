# Puzzle hints and Lichess analysis — deployed 19 October 2026

Live site: https://shah.belovezem.com

Build `YT8G2WJpPfM7A0-Tc7UsT` activated at 08:31 UTC. Previous build: `uRU7n72m7KNYQPzYw1Kms`. The app is healthy with zero restarts; PostgreSQL's container ID and start time are unchanged.

## Changes

- Every valid player position offers a next-move hint, including puzzles without written notes. Clicking Hint or making three mistakes in the same position displays the expected move in SAN and a green arrow.
- Hints record an unsolved attempt with zero points and leave both ratings unchanged. A penalty already recorded for an earlier mistake remains. Assisted completion uses a separate message and yellow session marker.
- Completed puzzles offer the existing Lichess analysis control, opening the final position with the player's orientation.
- Reset replays the initial opponent move and cancels pending move/feedback timers while preserving the attempt's scoring eligibility.
- English and Bulgarian labels are included.

## Build and verification

Only four production files were replaced: `PuzzleSolver.tsx`, the puzzle submission API route, and the two translation files. The new submission regression script was also copied. Their server baselines matched local HEAD before patching. The server's production dependency manifests and Linux modules were retained; Next.js 16.3.8 built successfully, including TypeScript validation.

- Local checks: all 30 puzzle component/API regressions passed, along with TypeScript, scoped lint, translation keys and whitespace checks.
- Server checks: lint plus seven regression scripts passed (puzzle submissions, practice lines, review schedule, level exercises, fun modes, translation keys and leaderboard weeks).
- Both staging and live HTTPS returned 200 for English/Bulgarian home, puzzle category and sample puzzle pages, plus Bulgarian practices, levels, cards and fun pages. The leaderboard and coach profile retained their expected signed-out 307 redirects.
- All 12 linked JavaScript/CSS assets returned 200. Sample puzzle responses include the new hint and assisted-completion translations.
- Build and staging containers were removed. Only the application service was recreated. No database migration, import or live puzzle-result submission ran.

Live browser interaction with a signed-in student's puzzle was not exercised during deployment; the interaction and scoring paths were covered by the component/API regression tests.

## Release and rollback

Deployment folder: `/srv/sites/shah.belovezem.com/puzzle-hints-20261019`. It contains the isolated build source, changed-file archive, build and smoke-test logs, deployment/activation scripts, prior source-file archive, previous build ID and `release-before` backup. The changed files were synchronized into `/srv/sites/shah.belovezem.com/source` after activation.

For application rollback, preserve the active `/srv/sites/shah.belovezem.com/release` under a new unique path, restore a copy of `puzzle-hints-20261019/release-before` to that active release path, and recreate only the app:

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

Restore the previous production source files separately from `source-before-files.tgz` if needed. Leave PostgreSQL and student progress in place.
