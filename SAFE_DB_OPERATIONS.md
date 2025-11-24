# Safe Database Management

To ensure the database is never accidentally reset or deleted, follow these guidelines:

## 1. Updating the Schema
Use the following command to update the database schema. This command attempts to synchronize the schema without data loss. If a destructive change is detected, it will warn you and stop (unless you force it, which you should NOT do).

```bash
npx prisma db push
```

**DO NOT** use the `--force-reset` flag.

## 2. Migrations (Advanced)
We attempted to set up Prisma Migrations, but the database user lacks permissions to create a "shadow database". Therefore, we must rely on `db push`. 

## 3. Backups
It is highly recommended to periodically back up your data.

## 4. User Roles
To promote a user to COACH (Teacher), you can use the provided script:

```bash
npx tsx scripts/update-role.ts
```
(Edit the script to change the username if needed)
