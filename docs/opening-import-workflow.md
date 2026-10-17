# Opening practice import procedure

Investigated and verified on 1 October 2026, using the local repository and a read-only connection to the live Hetzner VPS.

## Last successful addition

At the start of this investigation, the latest practice in the live database was **Италианска Игра (Italian Game)**, created on **28 January 2026**. It contains **22 lines, 256 nodes, and 149 Bulgarian coach notes**. Its creator is the existing coach account with Lichess ID `roshavi4ak`.

Commit `4a9b105` (28 January 2026) contains the Italian Game source, translated JSON, generated practice trees, and the Italian Game import script. The conversion scripts were introduced in `bed2acb`, also on 28 January 2026. PowerShell history additionally records use of `npx tsx scripts/import_practice_tree.ts` for the earlier generic import.

At the start of this investigation, the live database contained these three practices:

| Practice | Student side | Lines | Nodes | Nonempty notes | Notes containing Bulgarian Cyrillic |
| --- | --- | ---: | ---: | ---: | ---: |
| Italian Game | White | 22 | 256 | 149 | 149 |
| Stafford Gambit | Black | 13 | 115 | 70 | 70 |
| Vienna Gambit | White | 14 | 104 | 63 | 63 |

The counts and titles match the supplied screenshot. Language counts are a Cyrillic-content check; the existing Italian Game JSON also contains the Bulgarian text directly.

## Recovered pipeline

### 1. Extract the complete saved opening data

The working extraction script is `parse-opening-data.js`. The similarly named `.ts` file is a demonstration with hardcoded sample data, not the file-import CLI.

From the project root, an example extraction is:

```powershell
node .\parse-opening-data.js '.\openings\scotch game.js'
```

This produces `openings/scotch game.json`, containing an `opening` object with:

- `lines`: PGN move sequences.
- `lineNames`: names keyed by the corresponding PGN sequence.
- `playerSide`: `w` or `b`, determining which side the student plays.
- `sharedOpeningPgn` and `sharedOpeningFen`: the common opening prefix.
- `descriptions` and `shortDescriptions`: coach notes keyed by full FEN positions.

The script expects the embedded `__sveltekit_...resolve(...)` data payload. It uses `eval`, so it should only be used on inspected literal data. For this investigation, the source payloads were extracted with a static TypeScript syntax-tree reader instead of evaluating saved website code.

Many `.html` files are saved variation lists or rendered pages without this complete payload. Some files with a `.js` extension are also rendered HTML. Those need a different extraction approach and original coach notes or newly authored notes.

### 2. Prepare a separate Bulgarian version

The Italian Game originals show that translation happened between extraction and conversion:

```text
openings/italian game.js                       English source
openings/italian-game-opening.json             Bulgarian position notes
openings/italian-game-opening-practice.json    Bulgarian practice tree
```

No dedicated translation script was found. Neither the parser nor the converter translates text.

For new practices, translate or adapt all nonempty `descriptions` and `shortDescriptions`, give the practice a Bulgarian title and description, and translate variation names that can appear as fallback notes. Preserve FEN keys, PGN strings, and the PGN keys in `lineNames` exactly.

For terminal positions, the user's requirement is to use the **original closing commentary**, translated faithfully into Bulgarian. Preserve its meaning and tone rather than substituting an automatically generated move recap. Keep the original source text beside the translation and verify its exact endpoint association.

Notes describe the position identified by their FEN key, often explaining the student's next move. Preserve that association rather than attaching every note to the move it mentions. Empty notes on intermediate positions are normal.

The existing Italian Game has Bulgarian descriptions but English variation names. Its generated tree retained all 149 Bulgarian descriptions without needing English fallback notes. New imports should also localize fallback names.

### 3. Convert the translated opening into a practice tree

Use `convert-opening-to-practice.ts` with `tsx`.

The converter scans its **current working directory** for filenames ending in `-opening.json` or `-attack.json`. It does not accept an explicit input-file argument. Rename a prepared copy accordingly, such as `scotch-game-opening.json`.

Run it in an isolated staging directory containing only the intended prepared inputs, using the absolute path to the script:

```powershell
tsx 'C:\Users\rosha\StudioProjects\chess-study\convert-opening-to-practice.ts'
```

For example, `scotch-game-opening.json` becomes `scotch-game-opening-practice.json`. Running the converter directly in the repository or the whole `openings` directory would regenerate every matching file there, including existing work.

The output is a nested tree with `id`, `fen`, `move` (UCI), `notes`, `lineNumber`, and `children`. Shared move prefixes are merged. The root remains the initial chess position so students also play the opening moves. Note lookup prefers `descriptions[fen]`, then `shortDescriptions[fen]`, then a variation name at the end of a line if no note exists.

### 4. Validate the prepared tree

Before an import:

- Replay every PGN and every parent-to-child UCI move with `chess.js`.
- Check every generated FEN against the replayed position.
- Confirm every intended variation reaches its expected numbered endpoint.
- Confirm all source annotations are retained and all displayed coach notes are Bulgarian.
- Check that line numbers belong to terminal nodes and that the student side is correct.

The old converter logs parsing or move failures and can continue, so its final success message alone is insufficient validation.

### 5. Import the practice and nodes into PostgreSQL

The previous Italian Game importer is `scripts/import-italian-game-practice.ts`. It reads `openings/italian-game-opening-practice.json`, creates one `Practice`, then recursively inserts `PracticeNode` records. Database node IDs replace temporary JSON IDs, with parent relationships and sibling order preserved.

`scripts/import_practice_tree.ts` performs the same basic operation, with hardcoded settings for Fried Liver Attack. Its configurable constants are `USER_ID`, `PRACTICE_NAME`, `PRACTICE_DESCRIPTION`, `PLAYER_COLOR`, and `PRACTICE_TREE_FILE`.

These are scripts for specific old imports, not ready-made generic commands for a new opening. They insert another practice on every run and are not transactional. The Italian importer can also create a placeholder coach or change an account's role. For the next additions, use the existing verified coach account, check for duplicates, and insert the new practice and its nodes in a transaction. Existing practices and student progress should be preserved.

The standalone scripts do not explicitly load `.env`. When using the older scripts locally, `tsx --require dotenv/config ...` loads it; that environment-loading method was verified during this investigation.

The page in the screenshot uses the **Practice / PracticeNode** database models and `/api/practices`. The application also has separate `Opening / OpeningStep` models, which are not the models for these interactive exercises.

## Current hosting and import route

The old InMotion configuration is obsolete. The local `.env` still targets its former `localhost:5433` SSH tunnel, so it must not be used as evidence of the current production database.

Current verified deployment:

- VPS: `138.199.159.126`, SSH user `roshavi4ak`.
- SSH access: the `hetzner-vps-login` skill, using the existing local `hetzner.pem` identity and no SSH agent.
- Source: `/srv/sites/shah.belovezem.com/source`.
- Release: `/srv/sites/shah.belovezem.com/release`.
- Running application container: `shah-app-1`, working directory `/app`.
- PostgreSQL container: `shah-postgres-1`.

The production app already has `DATABASE_URL` and Prisma Client configured. A read-only Prisma transaction inside `shah-app-1` successfully queried the live practices. Credentials do not need to be copied to Windows or printed.

The source copies of the parser, converter, both historical import scripts, and Prisma schema are identical to the local copies after normalizing line endings. The running release has Node.js 22 and Prisma Client 6.19.0, but no resolvable `chess.js` or TypeScript package. Therefore, conversion and chess validation should happen locally, followed by an import of the completed JSON using a plain Node.js script and the configured Prisma Client inside the app container.

Adding practice data requires no schema change, website rebuild, or application redeployment. The practice list queries PostgreSQL when the page loads. After import, verify stored counts and Bulgarian notes, then refresh the practices page and check a sample line.

## Sources checked and next candidates

The 27 complete JavaScript payloads contain 670 PGN variations and 3,422 source descriptions. All are English in their original payloads. They converted in a temporary directory into 5,519 tree nodes; every move, resulting FEN, source annotation, and numbered variation endpoint was checked successfully. This establishes structural validity, not an engine evaluation of every chess recommendation.

Two datasets need line-end cleanup before publication: Ponziani has 19 source variations but 17 terminal paths; Scandinavian Defense has 25 variations but 24 terminal paths. Some short variations are prefixes of longer ones, leaving numbered internal nodes that the session's leaf-based selection will not treat as separate complete lines.

Rebuilding the translated Italian Game reproduced the saved tree exactly after excluding generated IDs.

Suitable next candidates:

| Opening | Student side | Complete lines | Source notes requiring Bulgarian translation | Tree nodes |
| --- | --- | ---: | ---: | ---: |
| Caro-Kann | Black | 28 | 158 | 261 |
| Scotch Game | White | 27 | 144 | 234 |
| French Defense | Black | 26 | 118 | 185 |
| London | White | 28 | 148 | 240 |
| Danish Gambit | White | 15 | 70 | 110 |

Caro-Kann, Scotch Game, and Jobava London were subsequently prepared with Bulgarian notes and imported into the live database on 1 October 2026. The completed import added 81 variations and 699 nodes:

| Practice | Student side | Lines | Nodes | Bulgarian notes |
| --- | --- | ---: | ---: | ---: |
| Защита Каро-Кан (Caro-Kann) | Black | 28 | 261 | 159 |
| Шотландска партия (Scotch Game) | White | 27 | 234 | 144 |
| Система Джобава–Лондон (Jobava-London) | White | 26 | 204 | 127 |

The import reused the existing `roshavi4ak` coach account, checked for duplicate practice names, and inserted all three practices and their nodes in one Prisma transaction. A read-only post-import query confirmed the line counts, node counts, creator, side, and Bulgarian note coverage; it found zero English prose notes. No schema change, website rebuild, or deployment was needed. Existing local staged changes and opening sources were preserved.

## Second completed import: 2 October 2026

London, Fried Liver Attack, and Sicilian Defense were reviewed, corrected, and imported in one transaction. The Bulgarian Fried Liver name is the user's requested **Пържен дроп атака**.

| Practice | Student side | Lines | Nodes | Bulgarian notes |
| --- | --- | ---: | ---: | ---: |
| Лондонска система (London) | White | 28 | 240 | 148 |
| Пържен дроп атака (Fried Liver Attack) | White | 15 | 110 | 70 |
| Сицилианска защита (Sicilian Defense) | Black | 38 | 335 | 206 |

The review corrected piece and pawn identities, capture notation, an incorrect check claim, and Sicilian variation names shifted by a missing source label. The source move sequences and FEN keys were preserved. After import, every stored move, FEN, note, parent/child order, line number, title, description, and side matched the validated local manifest. This import brought the total to nine practices. The existing six practices and their student progress remained present.

The imported batch is `openings/bulgarian/next-practices.json`; `openings/bulgarian/imported-next3.json` records the verified IDs and counts. Do not reimport that batch: duplicate-name checking will reject it.

## Next 20 practices: imported and verified on 2 October 2026

The batch in `openings/bulgarian/next20` contains **20 practices, 483 terminal lines, 3,879 nodes, and 2,430 Bulgarian notes**. All twenty were imported in one transaction after revalidation and duplicate checks. A read-only verification compared every saved practice and node with the local manifest; all titles, descriptions, student sides, creators, moves, FENs, notes, parent relationships, sibling order, roots, and line numbers matched. The fingerprints of all nine existing practices were unchanged, and their student progress and attempt counts did not decrease. The live database now contains **29 practices**. See [the Bulgarian review](../openings/bulgarian/next20/REVIEW.md) for the complete course list and sample explanations; `openings/bulgarian/next20/import-receipt.json` records the verified database IDs and counts.

At import, these courses used newly authored Bulgarian adaptations of the source positions, combining curated opening explanations with generated notes grounded in legal moves, material balance, and board tactics. The original JavaScript sources were retained. On 8 October, all closing notes were replaced with faithful Bulgarian translations of the original commentary; intermediate adaptations remain as prepared. Original evaluation and win-rate claims are now preserved in closing notes as part of the source text.

Ponziani's two redundant prefix lines and Scandinavian Defense's one prefix line were merged into their longer continuations. All original paths and annotation positions remain present, and only terminal nodes receive line numbers. The expanded Vienna Gambit has a distinct title and does not replace the live shorter course.

Albin includes promotion to a knight. The existing `PracticeSession` reads the promotion piece from the saved UCI node before applying a move. Its actual promotion statements were executed against the prepared Albin position with the hook's default queen input; the result was a knight and the exact expected FEN. No player change or deployment is required.

Reproduce this batch from the project root:

```powershell
node scripts/prepare-next20-openings.cjs
Push-Location openings/bulgarian/next20
try {
    npx tsx C:/Users/rosha/StudioProjects/chess-study/convert-opening-to-practice.ts
} finally {
    Pop-Location
}
node scripts/validate-next20-openings.cjs
node scripts/import-bulgarian-practices.cjs openings/bulgarian/next20/practices.json --check
```

The final command checks the import manifest without connecting to or mutating the database. The live importer accepts explicitly selected batches of one to twenty courses, checks the existing coach and duplicate names, and performs the entire insert in one transaction. Conversion and chess validation still run locally. Future authorized imports should stream the selected validated manifest and plain Node importer into the current app container using the Hetzner SSH skill, then compare the saved database trees to that manifest.

`coach-overrides.json` and `catalog.json` hold editable curated text. Generated `.notes.json`, opening JSON, trees, and the combined import manifest are refreshed by preparation/conversion/validation. `inspect-opening-notes.cjs <slug> <first-index> <last-index>` prints the English source, Bulgarian note, and actual course continuations for focused review.

## Hint and completion correction: 8 October 2026

All 694 terminal notes across the 29 live practices now use original closing commentary in Bulgarian: 679 translated from downloaded English sources and 15 recovered from the original Bulgarian backup. The intermediate move-recap repair was superseded at the user's request. Preparation requires endings from `openings/bulgarian/endpoint-notes.json`, built by `scripts/prepare-original-closing-notes.cjs` from the original source-to-translation record. Traxler's 26 closing notes use the same original translations. Edit translations in `original-closing-translations.json`, rebuild the endpoint map, and synchronize local trees with `scripts/sync-reviewed-opening-endings.cjs`; do not replace original commentary with generated summaries.

The frontend was also corrected: wrong-move hints use the current position instead of the next position's note, and explicitly name the legal saved continuation. See [the audit and deployment report](opening-hint-audit-2026-10-08.md). Repairs update existing node notes in place; never reimport a course to correct its text, because recreating node IDs would break the relationship to student progress.
