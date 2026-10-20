import { ObjectId } from "mongodb";
import type { ComponentCardDocument } from "@/lib/db/components";

/**
 * The server/client boundary.
 *
 * `lib/db/*` returns raw Mongo documents: `_id` is an `ObjectId`, and the
 * timestamp fields are `Date`s. Neither survives crossing into a Client
 * Component — React's flight serializer rejects them with
 *
 *   "Only plain objects can be passed to Client Components from Server
 *    Components. Objects with toJSON methods are not supported."
 *
 * Every server component that renders a card, a list row or a detail panel must
 * run its rows through here first. Spreading the raw document (`{ ...item }`)
 * looks like it serializes but leaves the ObjectId and Date instances in place,
 * which is exactly the bug this module exists to prevent.
 *
 * Nothing here is component-specific on purpose: the shape is derived from the
 * document, so a new field on `ComponentDocument` needs no change here.
 */

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Anything that is a Date, an ObjectId, or an array of them. */
function isPlainSerializable(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value instanceof Date || value instanceof ObjectId) return false;
  if (Array.isArray(value)) return value.every(isPlainSerializable);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(
      isPlainSerializable
    );
  }
  return true;
}

/**
 * Convert a Mongo document to a JSON-safe plain object.
 *
 * ObjectId -> its hex string, Date -> ISO string, recursively. Anything else is
 * passed through untouched, so nested structures survive intact.
 */
export function toPlain<T>(value: T): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();

  if (Array.isArray(value)) {
    return value.map((entry) => toPlain(entry)) as JsonValue[];
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(source)) {
      out[key] = toPlain(entry);
    }
    return out;
  }

  return value as JsonPrimitive;
}

/**
 * The shape a client component receives. `_id` is absent, and every timestamp
 * is an ISO string — never a `Date` or `ObjectId` instance.
 */
export type SerializedCard = Omit<
  ComponentCardDocument,
  "_id" | "createdAt" | "updatedAt" | "publishedAt"
> & {
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

/**
 * Serialize one listing row for a client component.
 *
 * `_id` is dropped deliberately: it is never rendered, and leaving it in would
 * mean shipping a 24-char ObjectId on every card in the feed. The row is a
 * projection (`CARD_FIELDS`), so the author's source and the prebuilt preview
 * document are not here to serialize in the first place.
 */
export function serializeCard(component: ComponentCardDocument): SerializedCard {
  const { createdAt, updatedAt, publishedAt, ...rest } = component;

  /**
   * `_id` is dropped deliberately: it is never rendered, and leaving it in
   * would mean shipping a 24-char ObjectId on every card in the feed. The row
   * is a projection (`CARD_FIELDS`), so the author's source and the prebuilt
   * preview document are not here to serialize in the first place.
   *
   * The card is built as a copy rather than by leaving the id out of the
   * destructuring, because the row belongs to the caller and the payload is a
   * different thing.
   */
  const card: SerializedCard & { _id?: unknown } = {
    ...rest,
    createdAt: createdAt ? new Date(createdAt).toISOString() : "",
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : "",
  };
  delete card._id;

  if (publishedAt) card.publishedAt = new Date(publishedAt).toISOString();

  return card;
}

/**
 * Serialize a list of rows. Kept separate so a caller can map without
 * re-implementing the per-item conversion.
 */
export function serializeComponents<T>(rows: T[]): JsonValue[] {
  return rows.map((row) => toPlain(row));
}

/**
 * Assert that a value is safe to pass across the boundary. Used in tests and as
 * a development-time guard — a mistake here is silent in production but loud
 * in a test run.
 */
export function assertSerializable(value: unknown, label = "value"): void {
  if (isPlainSerializable(value)) return;
  throw new Error(
    `${label} is not serializable across the server/client boundary`
  );
}
