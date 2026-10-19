# Practical training: roadmap items 6, 7 and 8

Implemented 19 October 2026. Deployment status and release details are in the companion deployment record.

## Student access

The existing **Play and learn / Играй и учи** page (`/en/fun`, `/bg/fun`) now has prominent endgame and defense tiles beside the animal bots.

- `/[locale]/fun/endgames`: five play-out challenges covering queen mate, rook mate, promotion, opposition and saving a draw. Each includes a separate demonstration, progressive hints, takebacks, restart and a mirrored starting position. Stockfish plays the defender. Completion checks the actual result; stalemate does not pass a checkmate challenge.
- `/[locale]/play/bots`: **Learn while playing / Учи, докато играеш** is selected by default and can be switched off. Support includes identifying an attacked piece, immediate material/mate warnings, a separate board showing the consequence, a chance to retry or play the chosen move anyway, hints, specific praise, development and castling goals, and takebacks. This is available with the existing animal opponents and their existing strengths.
- `/[locale]/fun/defense`: twenty authored positions, in untimed five-position rounds. Students watch the opponent move, identify the threatened piece and choose or play a safe response. Alternative legal safe answers are accepted. A mistaken candidate can be explored on a separate board before retrying.

Both languages are included. These activities are unrated. Signed-in completions use the existing activity records (`MINIGAME` with endgame/defense keys, and `BOT_GAME` with teaching metadata). Completed training contributes to existing activity summaries. Signed-out visitors can practise and are told to sign in to save. This does not add a new skill-mastery model or migrate the database.

## Implementation limits

Teaching feedback checks legal immediate captures, legal recaptures, material gained on the student's move, and mate in one. It handles pins and equal trades, but is not a complete tactical or strategic assessment. Students can override a warning. Endgame hints use the engine; bot teaching hints use the verified legal rules. Defense exercises are curated for one clear immediate threat.

The engine helper owns each worker, performs the UCI readiness handshake, validates replies and cancels requests on restart, unmount or game completion. Copying a game preserves its move history for repetition and draw detection. Engine failures expose retry/takeback controls.

All five starting endgames were independently checked with the [Lichess tablebase API](https://tablebase.lichess.ovh/standard): the four winning challenges are winning for White, and the drawing challenge is drawn. The app does not call that external service at runtime.

## Verification

- 109 passing tests across practical-training rules/components and the existing puzzle navigation, submission and learning-upgrade regressions. Coverage includes all twenty defense fixtures, alternative defenses, stalemate/promotion outcomes, equal trades, engine cancellation, stale hints, bot warning overrides and saving completed rounds.
- ESLint, TypeScript, production build, fun-mode and translation checks passed locally.
- Browser checks at a 390-pixel viewport exercised real Stockfish replies and hints, a mistaken defense followed by a safe response, and animal-bot teaching. No horizontal overflow was observed. Urgent bot prompts appear above the board on phones.
- Persistence behavior is covered with mocked action boundaries in component tests. Live smoke checks do not submit student activity; a real authenticated classroom pilot remains useful for assessing whether children understand and enjoy the prompts.

Production deployment overlays only the seventeen feature files. It retains the server's production dependency versions; the local package script change is not deployed. Existing ratings, bot awards and database services retain their current behavior.
