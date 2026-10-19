# Endgame strategy tutorials deployment

Initially activated **19 October 2026 at 16:01:35 UTC** on https://shah.belovezem.com. Final refinement activated at **16:07:42 UTC**.

Build `n_R6TEmR06osiw4de2p2_` replaces `gibwkxv4JZ4uwB0os6Oib`.

Final build `qgHNWzG2gJw5_4iiFS0cV` adds recognition of a bishop/knight defender already in a matching-colour corner. This four-file follow-up changes only the phase rule, its bilingual message and the geometric regression. The full 155-test suite passed again, followed by the same VPS build/integration/staging/live checks. Its existing source checksums and previous build ID were guarded; the database remained unchanged and the app was running with zero restarts.

At [Endgame challenges](https://shah.belovezem.com/bg/fun/endgames), every category now opens **Научи плана / Learn the plan**, followed by **Опитай самостоятелно / Try on my own**. Seven strategy tutorials contain 27 annotated board examples, explanations, optional narration, common mistakes and plan checklists. Reopening a tutorial preserves the practice position. The three hint stages now describe actual endgame geometry, piece roles and move effects instead of generic puzzle advice.

See [implementation and sources](endgame-strategy-tutorials-2026-10-19.md) and [tablebase verification of all 27 examples](endgame-tutorial-verification-2026-10-19.json).

## Verification

All **155** local practical-training, learning-upgrade and puzzle regressions passed, including complete tutorials in both languages, outcome metadata, contextual hint rules, pause/resume, stale replies and assistance scoring. Local lint, TypeScript, production build, translation and fun-mode checks passed. All tutorial starts and move sequences are legal; tablebase checks confirm their stated results. The queen's deliberately bad stalemate loses a win; the rushed-pawn example starts drawn and demonstrates safely capturable material, ending with two kings and a draw.

VPS lint, the practical rules and eight existing regression scripts passed, followed by production build/TypeScript and read-only integration checks. The existing review integration still passes. Every advanced Defense detective level supplied two non-repeating five-position rounds in a READ ONLY transaction.

Staging and live HTTPS checks confirmed both languages' tutorial-first rendering and practice buttons, existing public/protected pages, defense endpoints, advisor outcome metadata, all 27 linked JavaScript/CSS assets and both engine files. Eight existing source checksums and the previous build ID were guarded before activation. Four new files were introduced; twelve files total were deployed. Production dependencies were retained. No migration was run. PostgreSQL's container identity/start time were unchanged, and the app was running with zero restarts.

At a 390-pixel viewport, local browser checks stepped through an example, exercised all three hint stages using one real tablebase response, and returned from tutorial review with the board and hint stage preserved. The actual hint explained `Ke4`, why the king approaches, and the controlled squares `d3`, `e3`, `f3`. Live checks confirmed tutorial-first display with no advice request, the bishop/knight tutorial's two blue matching corners, example move controls and independent-practice entry. There was no horizontal overflow. Checks were signed out; no production student activity was submitted.

## Recovery

Deployment directory: `/srv/sites/shah.belovezem.com/endgame-lessons-20261019`. It retains the patch, eight-file baseline/checksums, four-new-file list, source snapshot, integration/build/smoke/activation logs and `release-before`.

For rollback, preserve the active release under a unique path, restore a copy of `release-before` to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service using `/opt/websites/compose.shah.yml`. Restore the eight old source files from `server-baseline.tgz` if also reverting source, and remove only the four new paths listed in `new-files.txt`. Keep the database running.

To revert only the final corner refinement, use the equivalent release/baseline files under `/srv/sites/shah.belovezem.com/endgame-corner-20261019`; that restores the first tutorial release and its four touched source files.
