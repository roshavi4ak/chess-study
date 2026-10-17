# New line-mastery rule — deployed 17 October 2026

Live site: https://shah.belovezem.com

Deployed build `UTJPL075BscL5ZhHURzWG` at `/srv/sites/shah.belovezem.com/release`. Previous build: `xhLYofJ-ZtMHTuyFMROOU`. Activated at 05:30 UTC; the app was healthy with no restarts. No database change.

## What changed

- **Line mastery** (`isLineMastered` in `src/lib/reviewSchedule.ts`): a perfect run adds a step and a run with mistakes takes one away (never below 0); three steps master a line, so three perfect runs in a row, on the same day or not. Once a line has been finished more than 5 times, it also needs at least 80% perfect runs among its last 10. Unfinished (PARTIAL) runs are ignored.
- The rule is used everywhere mastery is shown: the Effort board's "Усвоени линии" (lines that became mastered this week, 5 points each, no cap), the coach's "Who needs help" table, the student profile and the opening cards.
- When a line comes back for review is unchanged: it still uses the per-day review levels.
- The Effort tab shows a green box explaining how to master a line; the card rule, the coach legend and the profile line legend were updated in both languages.

## Build and validation

- Source: the server source plus the 8 changed files (all other server files matched the local copy; the local `package.json`/`package-lock.json` were not uploaded). Built with the Linux modules mounted read-only from `profile-levels-20261017/source/node_modules`.
- On the VPS: lint passed, and the review-schedule (now covering the new rule), level-exercise, fun-mode, translation, leaderboard-week and practice-line checks passed.
- A staging container and then the live site over HTTPS served `/en`, `/bg`, `/bg/levels`, `/bg/puzzles`, `/bg/practices`, `/bg/fun`, `/bg/cards` with 200; `/bg/leaderboard` and coach pages redirect signed-out visitors (307), as before.
- Only the app container was recreated; PostgreSQL's container ID and start time were unchanged.
- Not verified: the signed-in Effort tab itself, because that needs a Lichess sign-in.

## Files and rollback

Deployment folder: `/srv/sites/shah.belovezem.com/mastery-rule-20261017` (`source`, `source-before`, `release-before`, `changed-files.tgz`, `deploy.sh`, `build.log`, `previous-build-id`). The changed files were synchronised into `/srv/sites/shah.belovezem.com/source`.

Rollback: preserve the current release under a new path, copy `mastery-rule-20261017/release-before` to `/srv/sites/shah.belovezem.com/release`, then

```sh
sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app
```
