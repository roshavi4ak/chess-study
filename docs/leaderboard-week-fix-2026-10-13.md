# Leaderboard previous-week correction — deployed 13 October 2026

Live page: https://shah.belovezem.com/bg/leaderboard

The Statistics / Last Week view queried a hardcoded 19–25 January 2026 period and separately displayed those same hardcoded dates. It now calculates the previous completed Monday–Sunday week in `Europe/Sofia`. The database query uses an inclusive local Monday and exclusive following Monday; the server returns the display dates alongside the winners, so the label and queried period stay together. Each boundary is converted independently to account for daylight-saving changes.

On 13 October the live page displays `Седмица: 05.10.2026 - 11.10.2026`. The authenticated browser showed puzzle winners Андон (230), Martin (84), and Мелиса (77), and practice winners Екатерина (27), Мелиса (13), and Андон (1).

Changes are limited to the weekly-period helper, weekly statistics date selection, server-to-client date-range props, and the displayed label. Ranking rules, the current-week leaderboard, and all-time statistics are unchanged. No database writes, migrations, imports, or PostgreSQL restarts were performed.

Validation:

- `node scripts/test-leaderboard-weeks.cjs` passed locally and in the Linux build environment. It covers the October reporting week, both sides of local Monday midnight, automatic next-week rollover, spring/autumn daylight-saving transitions, year boundaries, and matching query/display ranges.
- The production build and TypeScript check passed with the existing production dependencies: Next.js 16.3.8 / React 19.2.7.
- Staged Bulgarian and English homepages returned HTTP 200; the unauthenticated leaderboard returned the expected HTTP 307 login redirect.
- The live authenticated Statistics view displayed the corrected week and updated winners. Screenshot: `leaderboard-week-fix-2026-10-13.jpg`.
- Live homepage returned HTTP 200; `shah-app-1` and PostgreSQL were healthy.
- The new helper and regression script have no lint errors or warnings. The existing page/component still have their previous lint diagnostics (10 errors and 8 warnings total), verified against HEAD with no new diagnostics.

Deployment:

- New build ID: `d-sC6q8usAgwf5wnr-pEo`.
- Previous build ID: `gmCQHmhr3MV3SAtOPkPIH`.
- Active release: `/srv/sites/shah.belovezem.com/release`.
- Build source: `/srv/sites/shah.belovezem.com/weekly-statistics-20261013/source`.
- Previous live release: `/srv/sites/shah.belovezem.com/weekly-statistics-20261013/release-live-before`.
- The isolated build started from the last deployed source. Only the three existing changed files and the two new files were transferred/applied. These files were then synchronized to `/srv/sites/shah.belovezem.com/source` after successful deployment.
- A temporary staging container was checked and removed. Only the app service was recreated with `docker compose -f compose.shah.yml up -d --no-deps --force-recreate app` from `/opt/websites`.

For rollback, preserve the current active release, restore `release-live-before` to the active release path, and recreate only the app service with the same compose command. Restore the previous source versions too if continuing development from `/srv/sites/shah.belovezem.com/source`.
