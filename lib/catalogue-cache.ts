/**
 * The catalogue's memory.
 *
 * A page that shows what has been published is a page that waits for the
 * database, and the database is a round trip away — a few hundred
 * milliseconds each, and a page that asks three questions waits for the
 * slowest of them. That wait is what a reader feels when they click
 * something: the page they were on goes, and the page they asked for has not
 * arrived.
 *
 * So the answers are kept for a moment. Ten seconds is long enough that
 * going back and forth between the feed and a profile never waits, and short
 * enough that the catalogue is never really out of date. Publishing says so
 * and the memory is emptied, so what an author just published is on the
 * page before anyone goes looking for it.
 *
 * The memory is the server's own, so it is per instance: a deployment with
 * several of them answers from whichever one the request landed on. That is
 * the trade for the answers being a moment old rather than a moment
 * *stale* — and the moment is kept short enough that the difference cannot
 * be seen.
 */
type Entry = { at: number; value: unknown };

/**
 * The memory belongs to the process, not to a module.
 *
 * A page and the route that publishes into it are separate bundles — the
 * page is rendered by the server, the route runs in its own — and a module
 * that each of them has its own copy of is a module whose memory each of
 * them keeps to itself. The publisher would empty its own copy and the page
 * would go on serving the old answer from its own.
 *
 * So the memory lives on the process itself, where every bundle in it can
 * reach it.
 */
const GLOBAL_KEY = "__shadwayCatalogueCache";

type GlobalWithCache = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, Entry>;
};

const memory: Map<string, Entry> =
  (globalThis as GlobalWithCache)[GLOBAL_KEY] ??
  ((globalThis as GlobalWithCache)[GLOBAL_KEY] = new Map<string, Entry>());

/** How long an answer is kept, in milliseconds. */
const TTL = 10_000;

/**
 * An answer, from the memory if it is there and fresh.
 */
export async function remember<T>(
  key: string,
  read: () => Promise<T>
): Promise<T> {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return hit.value as T;
  }

  const value = await read();
  memory.set(key, { at: Date.now(), value });
  return value;
}

/**
 * The catalogue is different now.
 *
 * Everything that shows what has been published is emptied at once, because
 * the one thing that makes a catalogue is that it is true.
 */
export function forgetCatalogue(): void {
  for (const key of [...memory.keys()]) {
    if (key.startsWith("catalogue:")) memory.delete(key);
  }
}
