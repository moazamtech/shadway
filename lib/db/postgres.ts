import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import { schema } from "./schema";

/**
 * The database.
 *
 * One client per process, created on first use and kept. The Neon driver is
 * HTTP, so there is no socket to hold open and nothing to pool — which is what
 * makes it the right driver for a serverless deployment and what makes a
 * module-level client safe here.
 *
 * The connection string comes from the environment and is never written down
 * anywhere else: the URL is a credential, and a credential in a file is a
 * credential in a repository.
 */

let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — the database is not configured.");
  }
  return url;
}

/** The database, connected. */
export function db() {
  if (!client) {
    client = drizzle(neon(connectionString()), { schema });
  }
  return client;
}

/**
 * Whether the database is configured at all.
 *
 * A page that can be rendered without the database — a sign-in form, a 404 —
 * asks this rather than catching an exception, so "not configured" is an
 * answer and not a crash.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export { schema };
export * from "./schema";
