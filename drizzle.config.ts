import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * The schema's home.
 *
 * `drizzle-kit` reads the same table definitions the application does — there
 * is no second copy of the shape in a migration folder to drift out of step —
 * and pushes them to the database named by `DATABASE_URL`.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
