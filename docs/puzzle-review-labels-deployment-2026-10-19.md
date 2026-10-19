# Puzzle review names and topics — deployed 19 October 2026

Live site: https://shah.belovezem.com/bg/puzzles/review

Build `5Ag6g3vSFokHs2SlqgdpP` activated at 12:22:45 UTC, replacing `84_-TJL0466VajzAfLUVN`.

The current puzzle's name and translated topic badges now appear above the review board. Skills are listed before phase/length/source labels, with the same translation and coloring rules as the regular puzzle page. The header changes for each familiar or fresh position. Existing server data already supplied the tags; no database, scoring or scheduling changes were required.

Only `src/components/PuzzleReviewSession.tsx` and the existing navigation regression file were deployed. The regression now checks name/topic replacement when continuing to a fresh puzzle, removes stale labels and deduplicates tags while retaining save/retry and unrated behavior. Local TypeScript, scoped lint, targeted component/theme regressions and translation checks passed.

Production dependencies were retained. VPS lint, eight regression scripts, read-only review integration, production build/TypeScript, staging and live HTTPS checks passed. All 23 linked JavaScript/CSS assets and both engine assets returned 200. The app is running with zero restarts; PostgreSQL's container identity/start time were unchanged. No puzzle results were submitted during verification. The existing signed-in browser session showed today's reviews already completed, so the new metadata display was verified through the component regression rather than by creating student activity.

Deployment folder: `/srv/sites/shah.belovezem.com/review-labels-20261019`. It holds source snapshots, the two-file patch, `server-baseline.tgz`, build/smoke/activation logs and `release-before`. Production source files were checked against their captured checksums before activation and synchronized afterward. An initial copied build script referenced a renamed test filename; this was corrected before staging, without changing the live app.

For rollback, preserve the current release under a unique path, restore a copy of this deployment's `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service using `/opt/websites/compose.shah.yml`. Restore the two source files from `server-baseline.tgz` separately if needed. Leave the database in place.
