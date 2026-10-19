# Learning upgrades — deployed 19 October 2026

Live site: https://shah.belovezem.com

Build `84_-TJL0466VajzAfLUVN` activated at 11:56 UTC, replacing `YT8G2WJpPfM7A0-Tc7UsT`. The app is healthy with zero restarts. Only the app service was recreated; PostgreSQL's container ID and start time are unchanged.

## Included changes

The current workspace's 24 changed/new source, translation and regression files were packaged together. They add interactive micro-lessons, progressive hints, alternative-move exploration, optional read-aloud, a spaced puzzle-review queue, review links in daily missions, and unrated tracking for database-backed level exercises. See [the implementation record](learning-upgrades-2026-10-19.md).

The build started from the existing server source. All 165 unchanged source/schema files checked matched the workspace, and the 24 packaged files still matched the workspace before activation. Production dependency manifests were retained: Next.js 16.3.8, React/React DOM 19.2.7 and Prisma 6.19.0. No schema migration, import or backfill was needed.

## Verification

- Locally, all 69 learning/puzzle component and API regressions passed, along with TypeScript, lint, translation keys and whitespace checks.
- On the VPS, lint and eight regression scripts passed: learning upgrades, puzzle submissions, practice lines, review schedule, level exercises, fun modes, translation keys and leaderboard weeks. The production build and its TypeScript validation passed.
- The real review service ran against an existing student's history inside a database-enforced read-only transaction. It loaded three due reviews and two unseen related examples without recording attempts or changing ratings.
- Both staging and the public HTTPS site returned 200 for English/Bulgarian home, puzzle categories, sample puzzles, review pages and levels, plus Bulgarian practices, cards and fun. Signed-out review pages displayed their translated sign-in message; leaderboard and coach routes retained their expected 307 redirects.
- All 23 linked JavaScript/CSS assets returned 200, as did `/stockfish.js` and `/stockfish.wasm`.
- The changed files were synchronized into the server source and compared with the build snapshot. Build and staging containers were removed.

No live puzzle results or level exercises were submitted during deployment. Signed-in browser persistence and mission completion were covered by mocked component/API regressions and the read-only review integration, rather than by writing student activity to production.

## Release files and rollback

Deployment folder: `/srv/sites/shah.belovezem.com/learning-upgrades-20261019`. It contains the changed-file manifest/archive, source snapshot, `server-baseline.tgz`, `release-before`, build and smoke logs, activation scripts, and previous/active build IDs.

For rollback, preserve the active `/srv/sites/shah.belovezem.com/release` under a unique path, restore a copy of `learning-upgrades-20261019/release-before` to the active release path, then recreate only the app:

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

Restore prior source files from `server-baseline.tgz` separately if needed. Leave the database and student activity in place.
