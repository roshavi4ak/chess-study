# Website deployment — 14 October 2026

Live site: https://shah.belovezem.com

Deployed the current application source, translations, public assets, and Prisma schema, including the lint repairs and the learning-loop and engagement features. Production dependencies were retained: Next.js / eslint-config-next 16.3.8, React / React DOM 19.2.7, Prisma 6.19.0. The older local framework versions were not uploaded over the production dependency manifests.

## Release and backups

- Build ID: `QtBNrgAYgCDFZkSwiePhs`.
- Previous build ID: `d-sC6q8usAgwf5wnr-pEo`.
- Active release: `/srv/sites/shah.belovezem.com/release`.
- Build source: `/srv/sites/shah.belovezem.com/website-20261014-065841/source`.
- Previous live release: `/srv/sites/shah.belovezem.com/website-20261014-065841/release-original` (also copied as `release-live-before`).
- Previous source: `/srv/sites/shah.belovezem.com/website-20261014-065841/source-live-before`.
- Database backup: `/srv/sites/shah.belovezem.com/website-20261014-065841/database-before.dump`, PostgreSQL custom format, approximately 13 MB. Its contents were checked with `pg_restore --list`.
- Production source was synchronized to `/srv/sites/shah.belovezem.com/source` after successful activation.

## Database update

Reviewed the live-schema diff, then ran `npx prisma db push --skip-generate` without any reset or data-loss flags. It added nine tables (`Assignment`, `LeaderboardExclusion`, `PlaySession`, `PuzzleRace`, `PuzzleRaceEntry`, `PracticeQuestion`, `LeagueMembership`, `LeagueWeek`, `ClubTournament`), their enums/indexes/foreign keys, and the nullable `User.startLevel` column. No existing tables, columns, indexes, or records were removed.

Before/after counts matched: 23 users, 29 practices, 5,738 practice nodes, 398 line-progress records, 190,468 puzzles, and 3,309 puzzle attempts. The staged release's generated Prisma client successfully queried every new table and `User.startLevel`.

## Validation

- Linux lint passed with zero errors/warnings; the production build and TypeScript check passed.
- Fun-mode, review-schedule, practice-line, leaderboard-week, and translation checks passed on the VPS. Bot-ladder checks also passed locally.
- Staging and live Bulgarian/English homepages and play/learning pages returned HTTP 200; unauthenticated coach homework returned the expected HTTP 307 redirect.
- Live CSS/JavaScript, avatar images, and Stockfish JS/WASM assets returned HTTP 200.
- Browser verification using the existing signed-in session confirmed the learning hub, animal-bot selection, coach progress/help dashboard, and homework page. No homework, level placements, race entries, game results, or puzzle attempts were submitted during verification.
- `shah-app-1` and `shah-postgres-1` are healthy. Only the app service was recreated; PostgreSQL was not restarted. The temporary staging container was removed.

The existing `next-intl` `ENVIRONMENT_FALLBACK` warning about the missing global time zone remains in server logs. It did not prevent the checked pages from rendering, and no browser errors appeared on the verified bot/homework pages. This deployment did not change that configuration.

## Rollback

Preserve the active release under a new unique directory, restore a copy of `release-original` to `/srv/sites/shah.belovezem.com/release`, then recreate only the app with:

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

The schema additions are compatible with the previous application: leave them in place during an application rollback. Do not restore the database backup or restart PostgreSQL for a code rollback, because that would discard subsequent user activity. Restore `source-live-before` separately if development is to continue from the previous server source.
