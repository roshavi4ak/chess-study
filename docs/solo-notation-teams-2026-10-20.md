# Solo chess, notation trainer, team challenges and club goals — 20 October 2026

Three additions from the competitor review (`chess-learning-competitor-research-2026-10-19.md`). All are unrated and count as activity like other Play & learn modes.

## Solo chess — `/fun/solo`

- Every move must capture; each piece captures at most twice; the king is never captured; solved when one piece is left (Chess.com's Solo Chess rules; pawns never promote).
- 120 puzzles in `src/lib/soloChessPuzzles.json`: 40 easy (3–4 pieces), 40 medium (5–6), 40 hard (7–8). They are built backwards from the last piece by `scripts/generate-solo-chess.cjs` (seeded, so rerunning gives the same file) and every one is re-solved by the tests.
- A puzzle solved without a hint (`PlaySession` kind `SOLO_CHESS`, score 1) never comes back for that child. Undo and start over are free. A hint finishes the puzzle with score 0 and sends it to the back of the queue; skipped puzzles go to the back too.

## Notation trainer — `/fun/notation`

- "Write the move" (arrow on the board, type the SAN) and "Play the move" (SAN shown, play it), 4 levels each: simple moves, captures, check/mate/castling/promotion, disambiguation. Rounds of 10; stars for 6/8/10 right (`PlaySession` kind `NOTATION`, key `notation:<write|play>-<level>`).
- English piece letters only (K Q R B N, O-O). Accepted leniently: 0-0, `e8Q`, spaces, and Cyrillic look-alike letters typed on a Bulgarian keyboard (К, В, О, а, с, е, х). A missing or wrong `+`/`#` counts as right with a reminder; a missing `x` or disambiguation does not.
- The site now uses English piece letters everywhere: the 26 Bulgarian texts that wrote moves with Ц/Д/Т/О/К (endgame tutorials and the "why?" question placeholder in `messages/bg.json`) were switched to K/Q/R/B/N, including promotions such as `e8=Q`. Coach-written notes stored in the database were not checked.
- Positions come from short random games, or small random endgames for promotion and mate questions, so every question is legal.

## Team challenges and club goals — `/coach/teams`, `/challenges`

- Coaches create a challenge (name, measure, optional theme/opening, period, total or average per child, 2–6 teams). Teams can be split evenly by puzzle rating, randomly, copied from an earlier challenge, or set child by child; afterwards children can be moved, added or removed, and points can be added by hand.
- Club goals: title, measure, target and period; coaches can add progress by hand.
- Measures (`GOAL_METRICS` in `src/lib/clubGoals.ts`): puzzles solved/tried/points, opening lines played/perfect/mastered, active days, Play & learn games, animal wins, solo chess puzzles, notation answers, level tests, tournaments, and "points by hand" only. Periods are inclusive Sofia days; presets for this/next week and this/next month.
- Children see standings, their own team highlighted and only their own contribution; coaches also see each child's number. Running items appear on the dashboard; `/challenges` is large enough for the projector. Finished items stay visible 14 days (60 for coaches). Accounts hidden from the leaderboards do not take part.

## Deployment

1. Back up the database.
2. Run `scripts/add-team-goals-solo-notation.sql` (adds the `SOLO_CHESS` and `NOTATION` play kinds and four new tables; additive and safe to run twice).
3. Deploy the code.

Without step 2 the pages still load: solo chess and notation results are not saved, and Teams & goals shows a short "after the next update" note.

## Checks

`npm run test:club-games` (19 tests), `node scripts/test-translation-keys.cjs`, the existing fun-mode, play-record, learning and practical-training suites, `npx tsc --noEmit`, `npx eslint`, `npx next build`.

Browser-checked against a throwaway PostgreSQL 16 on Docker: the SQL script applied twice, then `prisma migrate diff` against the schema was empty. Solved a solo puzzle on the board (saved, skipped after reload); a write-mode round and a play-mode level 3 move; created a challenge split by rating, added points, moved a child, created a club goal; checked the child's Bulgarian dashboard and `/challenges`, and phone width.
