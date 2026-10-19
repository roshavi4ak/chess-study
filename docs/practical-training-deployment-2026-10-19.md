# Practical training deployment — 19 October 2026

Live site: https://shah.belovezem.com/bg/fun

Build `eJmVQvrSqqeLFuKLBn8K8` activated at **12:58:28 UTC**, replacing `5Ag6g3vSFokHs2SlqgdpP`.

Roadmap items 6, 7 and 8 are available:

- [Endgame play-outs](https://shah.belovezem.com/bg/fun/endgames): five goals, demonstrations, hints, takebacks and mirrored positions against Stockfish.
- [Animal bots](https://shah.belovezem.com/bg/play/bots): the default **Учи, докато играеш** switch enables threat identification, immediate tactical feedback, hints, retries and development/castling goals.
- [Defense detective](https://shah.belovezem.com/bg/fun/defense): twenty authored positions presented in five-position rounds, with alternative safe responses and demonstrations of mistaken candidates.

Both Bulgarian and English routes are live. All three activities are linked prominently from **Играй и учи / Play and learn**. See [implementation details](practical-training-2026-10-19.md).

## Checks and scope

Local validation included 109 passing regressions, lint, TypeScript, translation keys, fun modes and the production build. After a translator-variable rename, the nine component regressions, translation check and scoped lint passed again. Mobile browser checks covered real engine play/hints, defense retry and bot teaching.

On the VPS, lint, the new practical-training rules and eight existing regression scripts passed. The review integration transaction was explicitly read-only. The production build and TypeScript passed using the server's existing dependency versions. Component-test development dependencies were unavailable in that production module tree, so those tests ran locally.

Isolated staging and live HTTPS checks passed for both languages' new routes and existing public/protected routes. Both new hub links and translated page headings were asserted. All 27 linked JavaScript/CSS assets and the two Stockfish assets returned 200. The app container is running with zero restarts. PostgreSQL's identity and start time were unchanged. No database migration or production student-activity submission was performed.

A final signed-out live browser check at 390 pixels confirmed all three hub links, all five endgame selectors, the defense board and the enabled teaching switch. Stockfish answered the student's `Kh5` with `Kg7` in the queen endgame without an engine error. These screens had no horizontal overflow.

The first staging attempt stopped at the translation checker because it treated identically named translators in separate functions as a shared binding. Renaming the outer translator fixed the false positives. This happened before activation; the old app stayed live throughout validation.

Seventeen feature files were overlaid. `package.json`, the lockfile and production dependency versions were retained. Existing source checksums and the previous build ID were verified before activation, and production source was synchronized afterward.

## Recovery

Deployment directory: `/srv/sites/shah.belovezem.com/practical-training-20261019`. It contains the patch, lists of five existing and twelve new source files, baseline archive/checksums, initial and successful build logs, smoke logs, activation record and `release-before`.

For rollback, preserve the active release under a unique path, restore a copy of `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service with `/opt/websites/compose.shah.yml`. Restore the five old source files from `server-baseline.tgz`; remove only the twelve newly introduced paths listed in `new-files.txt` if also reverting source. Leave the database running.
