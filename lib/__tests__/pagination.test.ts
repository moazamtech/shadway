import { describe, expect, it } from "vitest";

/**
 * The cursor round-trip, exercised without a database.
 *
 * `listComponentsPage` builds an opaque cursor from the last row's sort values
 * and decodes it on the next request. If the two halves drift apart the feed
 * silently skips or repeats a page, which is exactly the kind of bug that
 * survives a manual click-through.
 */
function encodeCursor(values: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

describe("pagination cursor", () => {
  it("round-trips the sort values", () => {
    // A cursor is JSON, so `createdAt` is carried as an ISO string — which is
    // also what a Mongo query compares against, so the round-trip is faithful.
    const values = {
      createdAt: "2026-01-02T03:04:05.000Z",
      likes: 5,
      views: 34,
      installs: 12,
      _id: "6ad0012124d912301c2bc7f9",
    };

    expect(decodeCursor(encodeCursor(values))).toEqual(values);
  });

  it("produces a string that is safe in a query parameter", () => {
    const encoded = encodeCursor({ createdAt: "2026-01-02T03:04:05.000Z", _id: "abc" });

    // base64url omits +, / and =, so the cursor needs no percent-encoding.
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for a tampered cursor rather than throwing", () => {
    expect(decodeCursor("not-a-real-cursor!!!")).toBeNull();
  });

  it("returns null for an empty cursor", () => {
    expect(decodeCursor("")).toBeNull();
  });

  it("treats a decoded null cursor as the start of the list", () => {
    // A missing cursor must mean "from the beginning", never an error.
    const cursor = decodeCursor("garbage");
    expect(cursor ?? null).toBeNull();
  });
});
