# Personal puzzle challenge points — 20 October 2026

The puzzle leaderboard now rewards difficulty relative to the student's rating before the attempt. Glicko rating changes remain separate and retain their existing behavior.

| Puzzle rating minus student rating | Challenge points |
| --- | ---: |
| Below -400 | 0 |
| -400 through -201 | 5 |
| -200 through +200 | 10 |
| Above +200 | 15 |

Only a correct, unassisted first attempt earns points. Existing retry, hint and review rules remain. No daily competition allowance, assigned queue, weekly rating freeze or additional scoring scheme was introduced. Existing effort and league boards retain their own rules.

## Data and historical conversion

`PuzzleAttempt.points` continues to record the rating change. Separate nullable `challengePoints`, `challengeStudentRating` and `challengePuzzleRating` columns store the new award and its inputs. `challengeBackfilled` identifies converted attempts. The additive SQL is in `scripts/add-puzzle-challenge-scoring.sql`; no database reset or destructive schema synchronization is used.

The user authorized converting attempts from Monday 19 October 2026, 00:00 in Europe/Sofia (`2026-10-18T21:00:00Z`). The week ends at `2026-10-25T22:00:00Z`, accounting for the autumn clock change.

Historical student ratings are reconstructed by subtracting saved rating changes in reverse chronological order, including losses and all later attempts. Historical puzzle ratings were not recorded, so the user explicitly accepted using puzzle ratings at conversion as an approximation. Both inputs are saved with each converted award. Future submissions save the inputs when the attempt is recorded.

`scripts/backfill-puzzle-challenge.cjs` previews by default. `--apply` atomically populates only still-null competition fields, never legacy points or ratings. Repeat runs skip converted attempts. All earlier attempts are considered when identifying whether a puzzle was previously attempted.

Weekly and all-time puzzle totals use stored challenge points. Completed legacy weeks retain the original rating-points winner query, including its zero-score and tie behavior. The former server-side lifetime top-20 limit was removed so the weekly view can include every student. Current-week bounds use the existing Europe/Sofia week helper.

## Validation and deployment

- 74 focused submission, leaderboard, backfill and bilingual component tests passed in the Linux deployment environment.
- Week-boundary, translation-key, lint and production build checks passed.
- Read-only integration checks compare leaderboard totals with database aggregates and compare prior-week awards and historical win counts with the previous implementation.
- Staging checks cover English/Bulgarian home and puzzle pages, practices, levels, cards, fun pages, signed-out leaderboard/profile redirects, and linked JavaScript/CSS assets.
- The Chrome browser connection was unavailable; a signed-in browser session was not exercised. Component tests cover the displayed challenge points separately from rating changes.

Deployment directory: `/srv/sites/shah.belovezem.com/puzzle-challenge-20261020`.

Activated build: `PRzBUbN5_V4zJp0wfEZ5N` (previous: `38lZX_kxJpvqdu3NtRkts`). The conversion populated 169 attempts across eight student-role accounts, including accounts excluded from public rankings. Eighteen first solves earned positive points. The visible leaders immediately after conversion were Андон (85), Екатерина (20), and so_nik_18 (10).

The post-conversion dry run found zero pending rows. Checksums confirmed all existing attempt identities, outcomes, legacy points, student ratings and affected puzzle ratings were unchanged. Historical awards matched the previous implementation after conversion. Live HTTPS page/asset checks passed, the app was healthy, and the PostgreSQL container identity/start time was unchanged.

The directory contains the full pre-change PostgreSQL dump (`database-before.dump`), original changed source files, isolated build source, test/build/smoke logs, preview and applied conversion reports, and rating/legacy-record checksums. Activation briefly stops the app while applying the conversion, then replaces only the app release. PostgreSQL is left running.

For application rollback, preserve the current release, restore `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app with `docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app`. Restore prior source files separately from `source-before-files.tgz`. The added scoring columns can remain: the previous application ignores them. Avoid restoring the entire database over subsequent student activity.
