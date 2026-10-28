# Student attempt review

Puzzle pages show all failed student attempts at the current school, including repeated wrong moves and attempts by several students. The review board can show each mistake's position, the move played, and the expected move, with chess move numbers. Activity reviews require a coach account and verify that the attempt belongs to the requested student. Coach accounts are excluded from the student mistake list.

The student profile timeline and recent puzzles open a read-only review of the specific attempt. Practice line rows open their latest attempt. Level tests/practice, streaks and notation rounds now retain exercise review data. Activities without saved move history explicitly say so. Legacy puzzle and practice attempts retain their original results; their actual moves cannot be reconstructed from the old pass/fail results and counters.

Puzzle mistakes after the first submission update the same attempt, without additional rating changes, challenge awards or activity counts. Saves are serialized so errors made while the initial request is pending are retained. This also works when a hint precedes the first mistake in a level exercise.

Any legal checkmate on the final student move is accepted in puzzles, level exercises and opening practice. Opening practice requires a terminal available branch, records credit for that line, and saves the actual final move for replay. Non-mating substitutions remain incorrect.

## Database update

Apply the additive script before deploying the application:

```powershell
npx prisma db execute --file scripts/add-attempt-move-errors.sql
npx prisma generate
```

This adds nullable `PuzzleAttempt.moveErrors`, `PracticeAttempt.moveErrors`, and `PracticeAttempt.finalMove`. It does not backfill, delete or change past results. The SQL is safe to run again.

This release is based on the deployed source. It excludes the separate unfinished multi-club migration in the original workspace.

## Verification

- `npm run test:attempt-review`: covers move validation, repeated mistakes, delayed saves, assistance, coach authorization, attempt ownership, timeline links, bilingual review controls and alternative mates (including opening practice and recorded final moves).
- The 23 attempt-review tests and all 91 puzzle navigation/submission, learning, notation, practice selection and review scheduling tests pass locally.
- ESLint passes for changed application files and regression tests.
- The isolated release contains no backup source copies; production compilation runs its full TypeScript check.
- The additional practical-training and Chessnut UI/activity suites pass: 137 tests.
- The navigation fixture supplies the board reset boundary required by the current micro-lessons, so the full navigation suite passes.
