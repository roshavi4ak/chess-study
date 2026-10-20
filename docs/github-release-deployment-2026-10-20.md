# Full learning release and all-time club records

Site: https://shah.belovezem.com

Application source commit: `2e5009dd12cbe0c2021ada44b46af3d59d61b7a5` (includes feature commit `e64e5b9cbae2f2d8178a3360db7b47dd4e4cc328`).

Build `38lZX_kxJpvqdu3NtRkts` activated on 20 October 2026 at 05:29:56 UTC (08:29:56 Europe/Kiev), replacing `R70QXcBdEECwjKOQO43Vz`. The app is running with zero restarts.

## Contents

Commits include all previously uncommitted learning improvements: interactive micro-lessons, progressive hints, puzzle review with labels, teaching bots, Defense detective Levels 1–10, randomized endgames and corrected strategy tutorials. The newest application change adds all-time club records beside the weekly records in Puzzle Streak and Coordinates, honoring the existing exclusions.

Next.js and eslint-config-next are pinned to 16.3.8; React and react-dom are pinned to 19.2.7, matching the runtime versions already in production. The regenerated lockfile is used by a fresh `npm ci` on the VPS, rather than reusing the older shared dependency directory. Prisma Client generation does not change the database schema.

An older regression relied on an ignored local backup. Its replacement fixture preserves all 29 opening practice trees and 5,738 nodes, including the notes, while removing account/author metadata and remapping database IDs. The regression still checks 5,044 nonterminal positions, 694 parents of terminal nodes, the Traxler capture, underpromotion and invalid saved child positions. A fresh checkout now includes everything needed to run that test.

## Verification

- All 184 local tests passed after aligning dependencies; lint and whitespace checks passed.
- The full 184-test suite and lint passed on Linux with the installed production lockfile, including all-time records and tutorial UI tests.
- Production build and TypeScript passed, followed by database-enforced read-only review and defense integration checks for Levels 2–10.
- Staging and live HTTPS smoke checks passed for 26 routes, including English/Bulgarian streak, coordinates, endgames, defense, puzzles, reviews and bots. Public pages returned 200 and protected pages retained their expected signed-out redirects.
- All 29 linked JavaScript/CSS assets, both engine assets, defense API rounds, invalid-input rejection and a real endgame tablebase response passed.
- The 78 deployed files were checked against their captured source hashes before activation; existing production source hashes and the previous build were guarded too.
- Only the app was recreated. PostgreSQL's container identity/start time remained unchanged. Temporary build/staging containers were removed. No schema migration or production student activity submission was performed.

## Recovery

Deployment directory: `/srv/sites/shah.belovezem.com/github-release-20261019` (started on 19 October; completed after midnight in the user's timezone). It retains the source snapshot, patch, source checksums, source commit, dependency/build/test/integration logs, source baseline and previous release. Source checksums and the previous build ID are guarded before activation.

To roll back, preserve the active release under a unique path, restore a copy of this directory's `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service using `/opt/websites/compose.shah.yml`. Restore touched source files from `server-baseline.tgz` separately; newly introduced paths are listed in `new-files.txt`. Leave PostgreSQL and student progress in place.
