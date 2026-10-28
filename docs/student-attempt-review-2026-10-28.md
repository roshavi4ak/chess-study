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

## VPS deployment

Activated on 28 October 2026 at **21:00:38 UTC / 23:00:38 Europe/Kiev**.

- Application commit: `38b153b02ab86583e7b65facfb963b88a6fe8721` (preceded by `089a36094bbee398508b7a19327895bae4cda423`, recording the existing deployed source).
- Build: `txrbHKqhRoSl0ewN73cvb`, replacing `eev4TvHrg7itVurP22ByO`.
- All **260 VPS tests** passed: 114 review/puzzle/learning/notation checks, 39 Chessnut checks and 107 practical-training checks. The 1,439 translation-key checks, targeted ESLint, full TypeScript check and production build passed.
- The three nullable columns were added in a transaction. Schema comparison verified that existing columns were unchanged and none were removed. A database-enforced read-only transaction verified reads through the generated Prisma client.
- Staging and live HTTPS checks passed for 26 English/Bulgarian pages, four protected-route redirects, both unauthenticated submission methods, 29 linked JavaScript/CSS assets and both engine assets.
- Signed-in browser verification confirmed 150 clickable timeline entries, puzzle review, opening-line review and the combined puzzle mistake panel. Both review boards rendered 64 squares; solution navigation worked and the opening review had no browser console errors. No student activity was submitted during verification.
- All 924 deployed source files matched the committed archive. The app is healthy with zero restarts; PostgreSQL's container identity and start time remained unchanged.

The first activation automatically restored the previous application when a smoke fixture could not be copied into the read-only production container. The verification was changed to pass that fixture entirely through stdin, then activation and all live checks passed.

Deployment artifacts and logs: `/srv/sites/shah.belovezem.com/attempt-review-20261028`.

## Backup retention and rollback

Exactly one website backup remains: `/srv/sites/shah.belovezem.com/backups/20261028-attempt-review`.

It contains the previous release, previous source archive, a PostgreSQL custom-format dump, checksums and a manifest. Dump contents were checked with `pg_restore --list`, and archive checksums were verified before old backups were deleted. Six older backups, the two older deployment trees and duplicate retired source/release copies were removed. The active source, active release and current build artifacts remain in place.

For an application rollback, preserve the active release, restore a copy of `release-before` from the retained backup to `/srv/sites/shah.belovezem.com/release`, and recreate only the app service with `/opt/websites/compose.shah.yml`. Restore source from `source-before.tgz` separately if needed. Leave the additive database columns and all subsequent student activity in place; do not restore the database dump for an application-only rollback.
