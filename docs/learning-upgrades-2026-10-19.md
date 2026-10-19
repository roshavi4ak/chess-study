# Interactive lessons, progressive help and puzzle review

Implemented and deployed on 19 October 2026. See the [production deployment and verification record](learning-upgrades-deployment-2026-10-19.md).

## Student experience

- **Levels:** five short board lessons cover safe captures, checkmate, forks, pins and noticing a threat. Students watch an example, tap its important squares, solve a different position, then continue to the existing level practice. Lessons appear on the relevant Pawn, Knight and Bishop levels. Replay resets the lesson fully. Optional read-aloud uses an installed voice matching English or Bulgarian; captions remain available when the device has no matching voice.
- **Puzzle and level boards:** help has three stages: a factual conceptual clue, the relevant piece/source square, then the move/arrow. Legacy written answer notes appear only at the final stage. Every stage counts as assistance. Three ordinary puzzle mistakes offer the first clue rather than automatically revealing the answer. Resetting does not restore independent-solve eligibility.
- **Explore my move:** after a legal alternative, a separate board can play the move and a legal computer reply. It describes observed checks, captures and mate, rather than asserting that every alternative loses. Each exploration owns and cancels its engine worker. A six-second timeout or unavailable engine leaves the analysis link usable. The exercise board itself is not changed.
- **Try these again:** `/bg/puzzles/review` and `/en/puzzles/review`, linked from the puzzle categories and the daily mission. At most three due positions alternate with up to two unseen examples of a related skill. The whole session is unrated, including unseen examples. Saved results feed the existing coach statistics and mission history.

## Scheduling and progress

The queue is derived from existing `PuzzleAttempt` rows. No schema migration, backfill or import is required.

- Only puzzles with a recorded failure/assisted attempt enter review. First return is the next Sofia calendar day.
- Independent successes on due days expand intervals through 1, 3, 7, 14 and 30 days. Early retries do not postpone a review or increase memory credit.
- Any failed/assisted attempt wins over successes on the same day. A revealed answer followed by an immediate retry is not evidence of delayed recall.
- The daily selection uses history before today and stays stable after results or reloads. A recorded attempt today finishes that selected item for today's workload; a failure still schedules it for another day.
- Database-backed level practice/tests now record their puzzle outcomes without rating changes. The original puzzle id is retained independently of the practice component's per-round display id. Generated beginner capture positions have no stored puzzle id and continue to use the existing level-round history instead of entering the individual puzzle queue.
- Review continuation waits for saving. Failed saves offer a retry and keep the student on the position. Level exercises use the same rule. Normal rated puzzles retain their existing first-attempt scoring, and existing retry/assistance protections remain in place.

Lessons are replayable teaching content; completing the mini-lesson itself does not award a new level, card, certificate or persistent completion badge. Existing practice and test flows continue to track those outcomes.

## Verification

- Production `next build`, including TypeScript validation, passed.
- Scoped ESLint and English/Bulgarian literal translation checks passed.
- Regression coverage includes legal lesson examples, fresh challenges, pin/fork/mate properties, supported alternate answers, clue properties, legal consequence replies, scheduling and day boundaries, user-isolated review queries, unrated submission and failed-save retry, component flows in both languages, and engine failure/cancellation.
- Existing level-exercise, review/mission/homework/mastery, practice-hint, practice-line, fun-mode and leaderboard checks passed.
- Browser checked with the real chessboard and real browser engine at 390 px in Bulgarian using a temporary local preview: fork demonstration, target selection, fresh challenge, progression to practice, and alternative-move reply. No horizontal overflow. The temporary preview was removed before the production build.
- No live student attempts, production database writes or deployment were performed. Authenticated integration was checked with mocked persistence; real production session behavior remains a deployment smoke-test task.

## Main files

- `src/lib/microLessons.ts`, `src/components/MicroLesson.tsx`, `src/components/ReadAloud.tsx`
- `src/lib/puzzleLearning.ts`, `src/components/ProgressiveHint.tsx`, `src/components/MoveConsequence.tsx`
- `src/lib/puzzleReview.ts`, `src/lib/puzzleReviewService.ts`, `src/components/PuzzleReviewSession.tsx`, `src/app/[locale]/puzzles/review/page.tsx`
- `src/hooks/useLearningAttempt.ts`, existing puzzle/level boards, mission loader/card and submission route
- `scripts/test-learning-upgrades.cjs`, expanded puzzle navigation/submission regressions

## Deployment notes

Deploy the new sources and translations together, using the project's existing production build/release workflow and production dependency versions. No database command is needed. Check a signed-in student's Levels page, the review link and an assisted/unassisted review on a controlled test account. Confirm zero rating change for review and correct mission progress after returning to the dashboard. Verify the worker asset is served. Code rollback can leave the database in place: the added attempts use the existing schema.
