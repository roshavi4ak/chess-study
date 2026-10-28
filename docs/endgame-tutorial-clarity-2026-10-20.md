# Bishop and knight tutorial clarity

The reported screenshot has Bb3 protecting Nf7 along b3–c4–d5–e6–f7, so ...Kxf7 is illegal. The remaining teaching problem was an unexplained change of position between the first two steps, with no visible protection or turn indicator.

- Keep the same position through the corner, king support and first knight-route steps. Continue the second half of the route from its actual endpoint.
- Show green protection arrows and square outlines, calculated from the displayed board. Explain both protected knights and the unprotected but distant knight on e5.
- Show the side to move, and explain each ply of the knight route in English and Bulgarian.
- Mark transitions as the same position or a new example. The final mate is explicitly separate and now retains a light-squared bishop, mating on a8.
- Tutorials remain read-only and do not record student attempts.

Validation: TypeScript; ESLint; component regressions for both languages; legal-move and hanging-piece tests; refreshed tablebase proof for all 27 examples and 76 displayed boards. The proof checks every legal alternative, not just the authored line.

Deployment uses an isolated build, a staged smoke test and an application-only restart with a guarded rollback. Existing puzzle-difficulty and leaderboard work is preserved; no database migration is needed.
