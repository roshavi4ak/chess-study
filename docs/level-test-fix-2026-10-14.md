# Beginner level tests — 14 October 2026

Live page: https://shah.belovezem.com/bg/levels

Pawn 1 keeps its hanging-piece lesson. Its previous rising puzzle ladder could serve full tactical positions far above the lesson difficulty, and the shared speed-mode board advanced immediately after an answer.

## Changes

- Pawn 1 now has eight authored, one-move hanging-piece exercises. Each starts with four pieces, one legal capture, an undefended target, and no possible recapture. Rook, bishop, knight, queen, and pawn captures reinforce the same beginner idea.
- Piece names are explained as ranks. The existing tactical themes and practice links remain in place.
- Later tests select only their configured themes, with a fixed rating band rather than a rising ladder: ±100 through starting rating 600, ±150 afterwards. Solutions are legally validated and limited to three, five, or nine plies according to rank. A read-only audit confirmed eight eligible exercises for every fixed level and the initial King test. Repeated King tests still increase their target rating.
- Every exercise shows its goal and whose turn it is. Feedback, explanations, retries, move history, and a solution walkthrough stay on the same board. Blue arrows and SAN plus source/destination squares explain the solution. Opponent replies and solution steps require a button press.
- Only the student's Next/Finish button advances the test. The pass threshold remains six of eight solved without mistakes or assistance. Retrying an exercise preserves its first-attempt result; restarting the whole test gives a fresh attempt.
- Result saving can be retried without replaying the completed test. Passing keeps the completed summary on its original level rather than switching it to the newly unlocked level.
- English and Bulgarian text covers the goals, feedback, scoring, and walkthrough controls. Timed puzzle modes retain their existing board behavior.

## Verification

- Full local lint and TypeScript checks passed; level-exercise, fun-mode, and translation regressions passed.
- The level regressions verify capture safety and uniqueness, wrong and illegal moves, retries, assistance scoring, manual opponent replies, every walkthrough step, topic/rating filters, malformed/overlong lines, and translation coverage.
- A temporary local browser fixture exercised all eight Pawn 1 questions: one failed attempt, one solution review, and six clean answers produced 6/8. English multi-move exercises confirmed manual opponent replies and manual walkthrough steps. The fixture was removed and never uploaded.
- Production Linux lint, TypeScript/build, regressions, and the read-only database pool audit passed.
- The staged and live English/Bulgarian levels pages, Capture Island, and learning hub returned HTTP 200.
- Live browser checks confirmed the simple Pawn 1 position, wrong-move feedback, retry, capture explanation, manual Next, solution arrows, and manual playback. The fresh English live tab reported no browser errors. No live test result or student progress was submitted.
- The app and PostgreSQL containers are healthy. No schema change, progress reset, or PostgreSQL restart was performed.
- Screenshots: `level-test-feedback-fixed-2026-10-14.png` and `level-test-solution-fixed-2026-10-14.png`.

## Deployment and rollback

- Build ID: `KuDDMe9VhnD7LhOH4nYP7`; previous build ID: `i--c8VOFRkQ0Q1hw5_xc8`.
- Build source: `/srv/sites/shah.belovezem.com/levels-fix-20261014-083738/source`.
- Active release: `/srv/sites/shah.belovezem.com/release`.
- Previous release: `/srv/sites/shah.belovezem.com/levels-fix-20261014-083738/release-original`.
- Previous source: `/srv/sites/shah.belovezem.com/levels-fix-20261014-083738/source-live-before` (dependencies/build outputs excluded).
- Existing production dependency manifests and versions were preserved. The eleven changed application/message/test files were synchronized to the main production source after activation. The temporary staging container was removed.

For rollback, preserve the active release, restore a copy of `release-original` to the active release path, and recreate only the app with `sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app`. Restore the changed source files from `source-live-before` if continuing development from the old release. Leave the database and student progress in place.
