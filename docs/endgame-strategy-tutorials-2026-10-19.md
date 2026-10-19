# Endgame strategy tutorials and contextual hints

Implemented 19 October 2026 for all seven endgame challenges at `/[locale]/fun/endgames`.

## Learn, then practise

Each category opens in **Learn the plan / Научи плана**. Students can step through an annotated board lesson, move examples forwards/backwards, hear the explanation with the existing optional device narration, review a common mistake and use a three-point checklist. **Try on my own / Опитай самостоятелно** and the final lesson button open the existing random play-out challenge. Learning before starting does not mark the later attempt as assisted.

The lessons contain 27 original examples across seven categories:

- Queen: create a file/rank fence, approach with the king, recognize stalemate and finish a supported mating net.
- Rook: build a wall, activate the king, understand a quiet waiting move and give the final rank check.
- Pawn promotion: occupy a key square, push a protected pawn, recognize a losing rush and promote safely in the shown position.
- King/pawn teamwork: understand the side to move in direct opposition, go around the king, escort the pawn and guard the promotion square.
- Rook-pawn draw: reach the promotion corner, understand a stalemate defence and recognize a safe pawn capture.
- Two bishops: combine opposite-colour diagonal coverage, add the king and assign the final escape squares to the pieces.
- Bishop/knight: identify matching-colour corners, build a king wall, recognize the sample knight route and coordinate the final mate. The W route is explicitly an illustrative pattern with sample replies; it is not presented as a forced sequence or a complete solution by itself.

The tutorials use separate boards and original short positions, with highlighted strategic squares and the last-move arrow. They do not alter or save a practice result. The old single-move demonstration control is replaced by the structured tutorial. A compact plan checklist is also available in practice.

Reopening the tutorial preserves the current practice position. Computer and hint requests pause/cancel, stale replies are ignored, and practice resumes on the same side to move. Consulting the tutorial during an attempt marks assistance. Reviewing it after a completed result does not alter the saved score or the displayed independence result.

## Hints that explain the position

Endgames now use `EndgameHint` instead of the generic puzzle hint component:

1. Describe the current goal/phase with actual king, pawn or bishop squares. Immediate mate, promotion, a drawable pawn capture and check get specific first-stage messages. Pawn hints mark that pawn's key squares; bishop/knight hints mark corners matching the actual bishop's colour.
2. Identify the piece and explain a verified purpose: approaching the king, building a king wall, occupying a key square, achieving direct opposition across an empty square, pushing a protected pawn, restricting legal king moves, using the promotion corner or completing mate/draw.
3. Reveal the legal tablebase move, its exact board effect and the team's controlled neighbouring squares. Restriction counts come from legal king moves before and after the suggestion. A retreat is not labelled an approach, and a quiet repositioning is not falsely described as reducing escape moves.

For bishop-and-knight endings, a king already in a matching-colour corner gets a finishing-net plan rather than advice to drive it to that same corner. This case was identified during the live hint check and added to the geometric regression.

The advisor response retains the existing `move` field and adds tablebase `category` and `dtm` metadata. A drawn/lost position after a student's mistake is not described as a forced win; the student is offered resistance or a takeback. Geometry alone is not used to claim the position is winning. Blue strategic squares are labelled as goals rather than all being legal immediate moves.

## Validation and sources

**Subsequent safety correction:** the original verification checked endpoints and missed an intermediate drawn position in the bishop/knight king-wall example. The bishop now protects the knight from b3. The replacement proof checks every displayed board and every legal alternative: see [the full safety audit](endgame-tutorial-safety-2026-10-19.md). This supersedes the original endpoint-only assurance below.

All 155 practical-training, puzzle-navigation/submission and learning-upgrade regressions pass, along with lint, TypeScript, production build, fun modes and translation checks. New tests cover every tutorial in both languages, legal examples, accurate terminal outcomes, complete translated content, geometric hint claims, cached outcome metadata, pausing/resuming, late replies, and independence/assistance after tutorial review.

The 27 examples were also checked independently with the [Lichess/Syzygy API](https://github.com/lichess-org/lila-tablebase#http-api). Winning/drawing examples preserve their stated result; the queen stalemate and rushed-pawn examples deliberately demonstrate losing a win or drawing. The recorded positions, moves and tablebase results are in [the verification data](endgame-tutorial-verification-2026-10-19.json).

Strategic references consulted include [Chess.com's bishop/knight guide](https://www.chess.com/terms/bishop-knight-checkmate) for matching-colour corners and piece coordination, and [Lichess piece-mate practice](https://lichess.org/practice/checkmates/piece-checkmates-i/BJy6fEDf). The app's lesson prose and example positions are original and independently move-checked.

No database migration, new dependency, rating change or production student-activity submission is needed. Existing random starting-position pools and Defense detective levels are retained.
