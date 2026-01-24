import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
  // Disable shadow database check (use with caution)
  // This is necessary because the database user doesn't have permission to create databases
  shadowDatabaseUrl: env("DATABASE_URL"),
});
