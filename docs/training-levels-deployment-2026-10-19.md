# Defense levels and randomized endgames deployment

Activated **19 October 2026 at 13:44:40 UTC** on https://shah.belovezem.com.

Build `gibwkxv4JZ4uwB0os6Oib` replaces `U-AzrA_sFUECCtROXn6HV`. The nineteen-file patch retains all other production source and dependency changes. The nine existing touched files were compared against captured baselines and rechecked by checksum immediately before activation; the previous build ID was also guarded.

Live entry points:

- [Defense detective](https://shah.belovezem.com/bg/fun/defense): Levels 1–10; the upper nine levels use the uploaded defensive-puzzle collection, with longer solutions at higher ratings.
- [Endgame challenges](https://shah.belovezem.com/bg/fun/endgames): seven categories, including two-bishop and bishop-and-knight mates, with random tablebase-verified arrangements.

Both English and Bulgarian routes are available through the existing Play & learn hub. See [implementation details](training-levels-2026-10-19.md) for selection bands, assistance rules, randomization and advisor behavior.

## Validation

Local lint, TypeScript, production build, translation and fun-mode checks passed. All **138** practical-training, learning-upgrade and puzzle regressions passed. The generated content contains forty verified starts per category, 280 total, with strictly closer supporting White kings in both White-pawn categories.

VPS lint, practical-training rules, eight existing regression scripts, production build/TypeScript and read-only review integration passed. A transaction explicitly set to READ ONLY loaded two five-position rounds at every level from 2 through 10; all nine levels returned five fresh positions excluding the first round. No production student activity was written.

Staging initially could not reach the external tablebase service because it used only the internal database network. Its container was given the existing external network as well; the app's production configuration already uses both networks. Restaging then passed without application or production-network changes.

Staging and live HTTPS checks covered both languages' pages, public/protected routes, the new defense API at Levels 2/6/10, invalid-level/FEN rejection, an actual tablebase reply, all 27 linked JavaScript/CSS assets and both Stockfish files. PostgreSQL's container identity/start time were unchanged. The new app is running with zero restarts. No migration or dependency replacement was performed.

A signed-out mobile browser at 390 pixels loaded a real Level 10 puzzle rated 2250 with six student replies. The entire eleven-ply defensive solution was played on the live board and accepted. Three consecutive promotion arrangements differed; our king's distances to the pawn were 1, 1 and 2, versus the opposing king's 5, 4 and 4. Both new mating categories rendered correctly. The bishop-and-knight hint and defender reply worked locally, and the live two-bishop hint returned a valid move. No horizontal overflow was observed. The screenshot of Level 10 was visually checked. Only one defense position was completed; no round or production student result was submitted.

## Recovery

Deployment directory: `/srv/sites/shah.belovezem.com/training-levels-20261019`. It retains the patch, nine-file source baseline/checksums, ten-new-file list, source snapshot, integration/build/staging/live logs, activation record and `release-before`.

For rollback, preserve the current release under a unique path, restore a copy of this directory's `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service with `/opt/websites/compose.shah.yml`. Restore the nine existing source files from `server-baseline.tgz` separately; remove only the ten newly introduced paths from `new-files.txt` if also reverting source. Leave the database running.
