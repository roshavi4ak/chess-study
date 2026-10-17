# Capture Island danger and capture fix — 14 October 2026

Live page: https://shah.belovezem.com/bg/games/capture

Two defects caused the reported behavior. The custom chessboard square renderer did not apply `squareStyles`, so danger coloring, legal-move dots, and hint outlines disappeared. The rules checked only fixed guards and ignored capturable black targets, allowing the queen to remain on c5 while the knight on a4 could capture it.

## Corrected behavior

- Red danger squares, legal-move dots, and hint outlines render through the custom square renderer.
- Both fixed guards and remaining capturable black pieces attack. Danger updates after captures; sliding pieces respect rocks and other black pieces, including defending occupied friendly squares. The moving white piece cannot hide danger behind its old square.
- Landing on a guarded square ends the attempt before awarding stars. The attacking black piece moves onto that square and the white piece disappears. The Bulgarian/English message explicitly says the piece was captured, and retry restores the starting board.
- Enforcing defended captures exposed an impossible setup in `pawn-4`: its final bishop defended the intermediate knight. The final piece is now a knight, preserving a solvable sequence of three diagonal pawn captures. All 40 board levels remain solvable in at most eight moves.

## Verification

- Regression tests reproduce `capture-4`: d1–d5 is safe; d5–c5 loses to the knight on a4. They also cover undefended/defended captures, removed attackers, revealed rook rays, rock blocking, pawn attack direction, the final capture, and the guarded king level.
- Local browser verification confirmed visible danger squares, actual knight/bishop captures, retry, and a safe five-move king route earning three stars. The temporary local test page was removed and was never deployed.
- Production Linux lint, TypeScript/build, fun-mode checks, and translation checks passed.
- Live browser verification confirmed c5 is red, the knight captures the queen on c5, and level 6 displays red bishop/knight danger squares and captures a king moved onto f2. No successful live levels or game results were submitted during verification.
- Screenshots: `capture-island-level4-fixed-2026-10-14.png` and `capture-island-level6-fixed-2026-10-14.png`.

## Deployment and rollback

- Build ID: `i--c8VOFRkQ0Q1hw5_xc8`; previous ID: `QtBNrgAYgCDFZkSwiePhs`.
- Build source: `/srv/sites/shah.belovezem.com/capture-fix-20261014-075610/source`.
- Active release: `/srv/sites/shah.belovezem.com/release`.
- Previous release: `/srv/sites/shah.belovezem.com/capture-fix-20261014-075610/release-original` (also copied as `release-live-before`).
- Previous source: `/srv/sites/shah.belovezem.com/capture-fix-20261014-075610/source-live-before`.
- Existing production dependencies were preserved. Only the two mini-game source files, two message files, and regression script were transferred into the build and synchronized to the main production source after activation.
- No schema changes, imports, progress resets, or PostgreSQL restarts were performed. The temporary staging container was removed.

For code rollback, preserve the active release, restore a copy of `release-original` to the active release path, and recreate only the app service using `sudo docker compose -f /opt/websites/compose.shah.yml up -d --no-deps --force-recreate app`. Restore the five previous source files if continuing development from the previous server source. Leave the database and student progress in place.
