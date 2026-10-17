# Puzzle-link prefetch fix — deployed 16 October 2026

Live site: https://shah.belovezem.com

Deployed build `33CyCF5nq64M_9PRzNprd` at `/srv/sites/shah.belovezem.com/release`. Previous build: `rNgq1czm_xrBQF05MOlve`. Verified healthy at 17:10 UTC.

Only the five application files for the prefetch/localized-navigation fix were patched against the existing server source: `PuzzleSession.tsx`, `PuzzleSolver.tsx`, the coach dashboard, the puzzle category page, and the puzzle play page. Existing production dependencies were retained: Next.js 16.3.8, React / React DOM 19.2.7, and Prisma 6.19.0. Local dependency manifests were not uploaded over the production manifests.

## Validation

- Linux lint passed. The production build passed using the established default Turbopack build, including its TypeScript check.
- Before release, all 14 new component regression tests and the seven existing regression scripts passed locally, along with lint and TypeScript checks.
- Staged browser checks rendered 1,000 history links in both English and Bulgarian, including horizontal scrolling, with zero background requests for those history targets. A tag containing spaces, symbols, and Cyrillic text was preserved exactly.
- The staged 50-category list made its expected tags API request and zero tagged-puzzle prefetch requests.
- The authenticated live coach dashboard rendered 100 puzzle links to 88 distinct targets, all with `/bg/` prefixes, and made zero automatic puzzle-detail requests during observation.
- A temporary 1,000-entry history in the live browser likewise produced zero history-target requests, including after scrolling. The test history was removed and the test tabs were closed. No puzzle results were submitted.
- Public English/Bulgarian home, category, and sample puzzle pages returned HTTP 200 with no redirects. Checked JavaScript/CSS assets returned HTTP 200; the live browser reported no console errors.

Only the app container was recreated. PostgreSQL's container ID and start time were unchanged, and both containers remained healthy. No database migrations, imports, result submissions, or firewall configuration changes were performed. Temporary build/staging containers and the localhost SSH tunnel were removed.

## Release files and rollback

- Build source and build log: `/srv/sites/shah.belovezem.com/puzzle-prefetch-20261016/source` and `build.log`.
- Linux dependencies were mounted read-only from `/srv/sites/shah.belovezem.com/friendly-pawns-20261014-091405/source/node_modules`; the build used `npm run build` with the existing runtime environment and web/database networks.
- Previous release: `/srv/sites/shah.belovezem.com/puzzle-prefetch-20261016/release-before`.
- Previous source: `/srv/sites/shah.belovezem.com/puzzle-prefetch-20261016/source-before`.
- The five patched files were synchronized to `/srv/sites/shah.belovezem.com/source` after successful activation.

For an application rollback, preserve the current release under a unique path, restore a copy of `release-before` to the active release path, and recreate only the app:

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

Restore the five source files separately if needed. Leave the database and firewall unchanged.
