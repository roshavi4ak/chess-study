# Schedule-aware practice line picker — deployed 17 October 2026

Live site: https://shah.belovezem.com

Deployed build `uRU7n72m7KNYQPzYw1Kms` (commit `576e825`) at `/srv/sites/shah.belovezem.com/release`. Previous build: `UTJPL075BscL5ZhHURzWG`. Activated at 06:56 UTC; the app was healthy with no restarts. No database change.

## What changed

The next line in opening practice (`pickNextLine` in `src/lib/practiceLines.ts`) is chosen in this order:

1. Lines with mistakes today, after 2 other lines.
2. Lines played perfectly today but not mastered yet, after 4 other lines, so students reach mastery (three perfect runs in a row) sooner.
3. New lines, by line number (never with "Упражнявай вече видени линии" on).
4. Lines due for review, the most overdue first (days since the last run ÷ the line's review interval).
5. Other lines still being learned, then mastered lines, at random weighted toward the ones closest to their review day.

A line played today waits its turn; only when every line is waiting does the one played longest ago come back. Today's runs are loaded from `PracticeAttempt` (`getPracticeAttempts`), so the spacing survives a page reload. When the student leaves the target line's branch, the opponent steers toward the best-ranked line in that branch. "Повтори линията" still repeats the line immediately, and due-review mode still serves the due lines first.

## Build and validation

- Source: the server source plus the 5 changed files. Before the upload, the server copies of those 5 files matched the local pre-change commit exactly. Built with the Linux modules mounted read-only from `profile-levels-20261017/source/node_modules`.
- On the VPS: lint passed, and the practice-line (rewritten for the new picker), review-schedule, level-exercise, fun-mode, translation and leaderboard-week checks passed. Locally the TypeScript check, lint and production build passed.
- A staging container and then the live site over HTTPS served `/en`, `/bg`, `/bg/levels`, `/bg/puzzles`, `/bg/practices`, `/bg/fun` (and `/bg/cards` on staging) with 200; `/bg/leaderboard` and coach pages redirect signed-out visitors (307), as before.
- Only the app container was recreated; PostgreSQL's container ID and start time were unchanged.
- Not verified: the signed-in practice page itself, because that needs a Lichess sign-in.

## Files and rollback

Deployment folder: `/srv/sites/shah.belovezem.com/practice-picker-20261017` (`source`, `release-before`, `source-before-files.tgz` with the server's previous copies of the 5 files, `changed-files.tgz`, `deploy.sh`, `build.log`, `previous-build-id`). The changed files were extracted into `/srv/sites/shah.belovezem.com/source`; its `src` folder is now owned by `root:root` throughout.

Rollback: preserve the current release under a new path, copy `practice-picker-20261017/release-before` to `/srv/sites/shah.belovezem.com/release`, then

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```

The disk was 93 % full before this deployment; older deployment folders' `source` and `release-before` copies can be removed if space is needed.
