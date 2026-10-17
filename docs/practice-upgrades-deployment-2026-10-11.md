# Opening practice upgrades — deployed 11 October 2026

Live site: https://shah.belovezem.com

The deployment adds Back/Forward navigation, clickable move history, replay from an earlier student turn, repeat-current-line controls, a Lichess analysis link for the displayed position, and a mode restricted to previously seen lines. Labels are available in English and Bulgarian.

The release was built on the Hetzner VPS with its existing Linux dependencies (Next.js 16.3.8 and React 19.2.7). The older local framework versions were not deployed. Only the changed components, helper modules, translations, and line-selection regression script were transferred. No database migrations or data imports ran.

- New build ID: `gmCQHmhr3MV3SAtOPkPIH`.
- Previous build ID: `ipQ29x8Mw431OCwlZcjjD`.
- Active release: `/srv/sites/shah.belovezem.com/release`.
- Running container: `shah-app-1`, recreated through `/opt/websites/compose.shah.yml`.
- Build source: `/srv/sites/shah.belovezem.com/practice-upgrades-20261011/source`.
- Linux build dependencies were mounted from `/srv/sites/shah.belovezem.com/hint-repair-20261008/source/node_modules`.
- Previous live release retained at `/srv/sites/shah.belovezem.com/practice-upgrades-20261011/release-live-before`.
- The transferred frontend files were also synchronized to `/srv/sites/shah.belovezem.com/source` after successful activation.

Validation passed: line-selection and Lichess FEN regression checks, Linux production build, staged and live HTTP checks for the homepage/practice list/Traxler practice page, container health, and authenticated browser checks of Back, Forward, analysis-position updates, and seen-lines mode switching. The authenticated smoke test did not complete a line or save a practice attempt. Broader local browser tests previously covered both player colors, repeated completions, same-line restart, restricted branches, Bulgarian labels, and phone-width layout.

For rollback, preserve the current release, restore `release-live-before` to the active release path, and recreate only the app service with `docker compose -f compose.shah.yml up -d --no-deps --force-recreate app` from `/opt/websites`. Do not restart PostgreSQL or restore database data for this frontend release.
