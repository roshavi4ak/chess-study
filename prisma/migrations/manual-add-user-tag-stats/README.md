# Manual Migration: add-user-tag-stats

## Description
This migration adds support for tracking user tag statistics. It creates a new table called `UserTagStats` that stores, for each user and each puzzle tag:
- `totalCount`: The total number of times the user has encountered this tag
- `unsolvedCount`: The number of times the user has encountered this tag in unsolved puzzles

## Why Manual?
This migration is created manually because Prisma Migrate couldn't create a shadow database due to insufficient permissions.

## How to Apply
1. Connect to your PostgreSQL database (using psql or your preferred SQL client)
2. Run the SQL commands from `migration.sql`
3. After applying, run `npx prisma generate` to regenerate the Prisma Client

## Verification
To verify the migration:
1. Check if the `UserTagStats` table exists
2. Run `npx prisma studio` and check the `UserTagStats` table
3. Try solving a puzzle and check if the tag statistics are updated