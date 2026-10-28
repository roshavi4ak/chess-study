# Solo chess, notation and teams deployment

Production: https://shah.belovezem.com

Activated on 20 October 2026 at 12:14:41 UTC. Build: `HydpnK0ie3GSE_n2euWv5`.

## Database backup and update

Before running `scripts/add-team-goals-solo-notation.sql`, a full PostgreSQL custom-format backup was created and verified by listing the archive and reading/decompressing it with `pg_restore --file=/dev/null` (no restore was applied).

- VPS backup: `/srv/sites/shah.belovezem.com/club-games-20261020/database-before.dump`
- Size: 20,036,056 bytes; permissions: `0600`.
- SHA-256: `926fc80250836c328a3f4e66e90371609df74b6d3ce5077cd09729343525e7a8`
- Backup verification completed at 12:13:48 UTC, before the migration began.
- The requested SQL completed at 12:13:48 UTC with `ON_ERROR_STOP` and bounded lock/statement timeouts. It added the two play kinds and four tables; the table transaction committed.
- A subsequent Prisma schema diff was empty. No other schema synchronization or data backfill was run.

## Verification

- All 251 regression tests passed on the VPS; lint, 1,169 literal translation-key checks, production TypeScript and build checks passed.
- Using the regenerated client, a transaction exercised the actual solo and notation save actions, solo progress retrieval, both activity-based goal measures, and all four team/goal tables and membership relations. The transaction deliberately rolled back; follow-up checks confirmed no probe results, challenge or goal remained.
- Staged and live checks passed for 34 routes, 31 JavaScript/CSS assets, the training APIs and engine assets. Authenticated coach checks confirmed the two Teams & goals creation forms and the absence of the pre-update notice; the club page also loaded without that notice.
- The solo board and notation pages were checked at phone width. Production source checksums match the deployment snapshot.
- Only the application container was recreated. PostgreSQL's container identity and start time remained unchanged.

Operational logs, migration output, archive contents, checksum, schema diff and source snapshots are in `/srv/sites/shah.belovezem.com/club-games-20261020/`. The previous application release is retained there as `release-before`.
