# Friendly pawn blockers — 14 October 2026

Live page: https://shah.belovezem.com/en/games/rook

Replaced the mini-game rock overlays with native white pawn pieces. Friendly pawns remain fixed and block the practising piece as real friendly pieces do. The active piece has a blue outline; only its current square accepts a move or drag. Instructions explain the fixed pawns in English and Bulgarian, including that a knight can jump over them but cannot land on them.

The board data now uses `friendlyPawns`. Two blockers were repositioned to avoid putting stationary pawns on the first or promotion rank: rook-6 b8 became b7, and knight-5 b1 became c3. Level IDs and saved star keys are unchanged. Shortest solutions are recalculated automatically; rook-6 now has a five-move shortest route.

Enemy attack rays stop at a friendly pawn after including its square in the attack map. The practising piece cannot capture its own pawns. Fixed pawns do not move or become capturable targets in these exercises.

## Verification

- Regression checks cover friendly pawn blocking, knight jumps and forbidden landing squares, fixed-pawn source rejection, the active pawn moving when another white pawn is fixed, attack-ray blocking, and valid non-overlapping pawn placements. All 40 board levels remain solvable in at most eight moves.
- Local lint and TypeScript checks passed. The temporary browser fixture was removed; its stale generated Next.js development validator was removed before the final TypeScript check. It was never uploaded.
- Production Linux lint, TypeScript/build, fun-mode regressions, level-exercise regressions, and translation checks passed.
- Staged and live rook, knight, pawn, capture, and level pages returned HTTP 200.
- Live rook-6 shows three white pawn blockers and a blue outline around the rook. Clicking a pawn or a square beyond it leaves the move count at zero. The fixed pawn has dragging disabled; attempting to drag it leaves the board unchanged. Dragging the active rook from e4 to e5 advances the counter once.
- Live knight-5 accepts a1–b3–a5–c4 across the friendly pawns, then refuses c4–b2 onto the friendly pawn. The counter remains at three.
- The same-colour pawn case was verified by regression rather than advancing the live user's locked Pawn world. No completed live game or test result was submitted during verification.
- The app and PostgreSQL containers are healthy. No schema changes, progress resets, or PostgreSQL restart occurred.
- Screenshot: `friendly-pawns-rook-fixed-2026-10-14.png`.

## Deployment and rollback

- Build ID: `rNgq1czm_xrBQF05MOlve`; previous build ID: `KuDDMe9VhnD7LhOH4nYP7`.
- Build source: `/srv/sites/shah.belovezem.com/friendly-pawns-20261014-091405/source`.
- Active release: `/srv/sites/shah.belovezem.com/release`.
- Previous release: `/srv/sites/shah.belovezem.com/friendly-pawns-20261014-091405/release-original`.
- Previous source: `/srv/sites/shah.belovezem.com/friendly-pawns-20261014-091405/source-live-before` (dependencies/build outputs excluded).
- Five application/message/test files were synchronized to the main production source after activation. Existing production dependency manifests were retained, and the temporary staging container was removed.

For rollback, preserve the active release, restore a copy of `release-original` to the active release path, and recreate only the app with `sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app`. Restore the five changed source files from `source-live-before` if continuing development from the older release. Leave student progress and the database in place.
