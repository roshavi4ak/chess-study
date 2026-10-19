# Fresh production build — 19 October 2026

Live site: https://shah.belovezem.com

Build `U-AzrA_sFUECCtROXn6HV` activated at 13:14 UTC, replacing `eJmVQvrSqqeLFuKLBn8K8`. The app is healthy with zero restarts.

The user requested another build and deployment. All saved application sources, translations and regression files matched the current server source before building, and still matched before activation. A fresh build was made from that source; no additional feature patch was applied. Production dependency manifests and versions were retained. No database migration was needed.

Validation:

- All 109 local learning, puzzle and practical-training regressions passed, along with TypeScript, lint and translation checks.
- Server lint, nine regression scripts, the database-enforced read-only review integration, and the production build/TypeScript passed.
- Staging and live HTTPS checks covered 22 public/protected routes, including English/Bulgarian endgames, defense, animal bots, puzzles, reviews and levels. Public routes returned 200; protected routes retained their expected signed-out 307 redirects. Trainer headings and hub links were checked.
- All 27 linked JavaScript/CSS assets and both Stockfish assets returned 200.
- Only the app container was recreated. PostgreSQL's container identity and start time were unchanged. Temporary build and staging containers were removed. No student activity was submitted during verification.

Deployment folder: `/srv/sites/shah.belovezem.com/site-refresh-20261019`. It contains the build source, baseline archive, build/smoke/activation logs, previous/active build IDs, scripts and `release-before` rollback copy.

For rollback, preserve the active release under a unique path, copy `site-refresh-20261019/release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app:

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

Leave PostgreSQL and student progress in place.
