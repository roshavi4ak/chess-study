# Endgame tutorial safety correction

## Issue and correction

The bishop/knight king-wall example originally used Kc6, Nf7, Bd3 against Ke8. After Kd6, Black could play Kxf7 and draw. The scripted Kf8 reply hid that mistake by returning to a winning position for White. Checking only the example's endpoints missed the intervening draw. The introductory board also showed the same undefended knight.

The bishop is now on b3 in the introductory, king-wall and both knight-route examples. Its b3–c4–d5–e6–f7 diagonal protects the knight on f7, including after Kd6. The king later protects d7, c5 and b7; e5 is safe because the opposing king cannot reach it. Both English and Bulgarian explanations now identify the protection and explicitly warn students to check captures. The wall example highlights b3 and f7 as well as the king's barrier.

## Full collection audit

Audited the moves, board geometry and prose for all seven tutorials. The [Lichess/Syzygy API](https://github.com/lichess-org/lila-tablebase#http-api) verified all 27 examples, all 78 displayed boards (75 distinct FENs), and all 878 legal alternatives at those boards. Every intermediate winning example remains winning against any defending move. Drawing examples preserve a draw against best play. No other unintended change of result or unprotected piece capture was found.

The queen stalemate and rushed pawn examples deliberately demonstrate mistakes and remain clearly labelled. The rushed pawn starts drawn, rather than losing a forced win. Separate diagrams and sample replies illustrate a technique; they are not claimed to be a forced fastest-mate line.

`scripts/verify-endgame-lessons.cjs` regenerates the checked-in proof in `docs/endgame-tutorial-verification-2026-10-19.json`. Unlike the earlier endpoint-only record, the proof covers every intermediate FEN and every legal alternative, from the correct side's perspective. Regenerate it whenever editing lesson positions or moves.

Offline regressions match every proof FEN and legal move list to the current lesson, check its result, and reject a better defending outcome. Additional tests inspect every displayed board for a legal black capture, including White-to-move snapshots; only the deliberately bad pawn push is allowed. Stale or incomplete proof data fails the suite. All 170 practical-training, UI, learning and puzzle tests passed, together with lint.

## Deployment

Deployment directory: `/srv/sites/shah.belovezem.com/endgame-safety-20261019`. Source checksums and the previous active build are guarded before activation. The directory retains the previous release and source baseline for rollback. Production dependency versions are retained. No database migration or student activity submission is needed.

Build `R70QXcBdEECwjKOQO43Vz` activated at 2026-10-19T18:52:59Z, replacing `qgHNWzG2gJw5_4iiFS0cV`. VPS lint, nine regression scripts, production build/TypeScript and read-only review/defense integration checks passed. Staging and live HTTP checks covered both languages, corrected tutorial messages, 27 JavaScript/CSS assets, engine assets and the training APIs. The database container's identity/start time remained unchanged; the app was running with zero restarts.

Live browser verification confirmed Bb3, Nf7 and Kd6 against Ke8 after the example king move. The live advisor returned Kf8 and a loss for Black, rather than a drawable knight capture. No student result was submitted during verification.
