# Original closing notes and hint repair — 8 October 2026

All **694 closing notes across the 29 live practices** now use the original commentary in Bulgarian, as requested by the user. The previous repair's generated move recaps were superseded. Closing notes preserve the original teaching, evaluations, win percentages, brief praise, and tone. No move recap or next-player sentence is appended.

## Original sources and translations

**679 endings** were recovered from the downloaded opening files in `openings`. They contain 662 distinct English texts, all translated into Bulgarian. Where no matching downloadable text was available, **15 endings** retain the original Bulgarian text captured before these repairs: 13 Stafford endings and two endings in the older Vienna course.

Each note is associated with its exact live node ID, line, move path, and final FEN. Downloaded notes are selected by exact FEN; a unique match of board, side to move, castling rights, and en passant state is used where source move counters differ. Every complete path is replayed legally. Ambiguous source matches stop preparation.

The user's Vienna example, after `1.e4 e5 2.Nc3 Nf6 3.f4 exf4 4.e5 Ng8 5.Nf3 d6 6.d4 dxe5 7.Qe2 Nc6 8.Bxf4`, now closes with:

> Браво! Свръзката срещу черния цар е толкова силна, че въпреки пешката по-малко компютърът ни дава предимство от +1 точка.

This restores the original lesson about the pin against the black king. The English source's evaluation is preserved; it is not a newly calculated engine score.

The source-to-translation record is `openings/bulgarian/original-closing-notes.json`, including source text, translation, provenance method, and original-text SHA-256. The English text index and Bulgarian translations are `original-closing-texts.json` and `original-closing-translations.json`. The 15 recovered Bulgarian originals are saved separately in `original-bulgarian-closing-notes.json`, so future preparation does not depend on a private database snapshot.

## Hint behavior retained

Wrong-move feedback previously used the next node's note, exposing a closing message before the final move. Both wrong-move feedback and the coach-guidance checkbox now use the current position. The hint explicitly names every legal saved continuation in SAN. For the Traxler screenshot it begins **„Изиграйте Nxc4.“**. Terminal notes are never used as hints, and the guidance panel is hidden on completion.

## Verification and live update

- All 694 endings match their original Bulgarian text or reviewed English-to-Bulgarian translation. All 13,332 path transitions were replayed, including shared prefixes.
- The 26 prepared courses passed their legal-path, FEN, note association, and Bulgarian-language validators. The twenty-course batch also passed its existing 610 tactical checks on intermediate notes.
- Hint regression checks passed for 5,044 nonterminal positions, all 694 final-move parents, the exact Nxc4 screenshot, multiple continuations, missing notes, invalid child positions, and knight promotion.
- The production transaction changed only `PracticeNode.notes`, with exact previous-note, FEN, move, terminal-node, and practice-ID checks. No courses or nodes were recreated.
- A fresh live snapshot confirmed exactly 694 changed notes across all 5,738 nodes. All other practice and node fields matched. Student progress remained at 449 records and attempts at 1,076 between the before/after snapshots.

The receipt is `openings/bulgarian/original-closing-restore-receipt.json`. Fresh before/after snapshots and the guarded production patch are in the ignored `backups` directory. The earlier full VPS backup is `/srv/sites/shah.belovezem.com/hint-repair-20261008`.

The original-note restoration required no frontend rebuild or database migration. The deployed current-position hint fix remains active. Verification establishes source fidelity and legal position association; it does not claim a new engine analysis or an authenticated browser walkthrough of every line.

## Maintaining the restored notes

```powershell
node scripts/prepare-original-closing-notes.cjs
node scripts/sync-reviewed-opening-endings.cjs
node scripts/prepare-bulgarian-openings.cjs validate
node scripts/validate-next20-openings.cjs
node scripts/prepare-original-closing-notes.cjs --check
node scripts/audit-opening-endings.cjs
node scripts/test-practice-hints.cjs
```

The first command builds the required `endpoint-notes.json` from the originals and their translations. Synchronization updates local notes without regenerating node IDs. The final audit checks the latest restoration snapshot by default; pass another snapshot path to check a later live capture.

`audit-opening-endings.cjs` is now read-only. The old clarity-repair entry point also only checks the original-note data. Neither regenerates move recaps or overwrites the endpoint map with old text. New live text repairs require a fresh snapshot and a new guarded notes-only transaction; do not rerun dated production patches against subsequently edited notes.
