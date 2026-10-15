import { MongoClient, Db } from "mongodb";

/**
 * A single shared client per process.
 *
 * `MongoClient` owns a connection pool, so the client must be created once and
 * reused. Constructing one per request leaks sockets and, under a long-running
 * dev server or serverless warm instance, eventually exhausts the heap — the
 * process dies with "JavaScript heap out of memory" rather than anything that
 * points at the database.
 *
 * In development Next.js reloads modules on edit, which would orphan a global
 * client on every save. Stashing it on `globalThis` keeps one client across
 * those reloads.
 */

declare global {
  // eslint-disable-next-line no-var
  var __shadwayMongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __shadwayMongoPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient | null = null;

async function connect(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }

  // A concurrent request must await the in-flight connection, not start a
  // second handshake.
  if (!globalThis.__shadwayMongoPromise) {
    globalThis.__shadwayMongoClient ??= new MongoClient(process.env.MONGODB_URI, {
      // Bound the pool: an unbounded pool is how a warm process accumulates
      // sockets until the heap gives out.
      maxPoolSize: 25,
      minPoolSize: 2,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 8_000,
    });

    globalThis.__shadwayMongoPromise = globalThis.__shadwayMongoClient
      .connect()
      .then((connected) => {
        client = connected;
        return connected;
      })
      .catch((error) => {
        // Allow a later request to retry instead of caching the failure.
        globalThis.__shadwayMongoPromise = undefined;
        throw error;
      });
  }

  return globalThis.__shadwayMongoPromise;
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const connected = await connect();
  return { client: connected, db: connected.db("shadcn-hub") };
}

/**
 * Drop the cached client. For tests that need a clean handle, or for a
 * connection string that changed at runtime.
 */
export async function closeDatabase(): Promise<void> {
  const existing = client;
  client = null;
  globalThis.__shadwayMongoClient = undefined;
  globalThis.__shadwayMongoPromise = undefined;
  if (existing) await existing.close();
}
