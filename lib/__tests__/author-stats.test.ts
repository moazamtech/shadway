import { describe, expect, it } from "vitest";

import {
  authorStatsPipeline,
  EMPTY_AUTHOR_STATS,
  MAX_PAGE_SIZE,
} from "@/lib/db/components";

/**
 * The counts a profile claims its author owns.
 *
 * These used to be a JavaScript `reduce` over `listComponents({ author, limit:
 * MAX_PAGE_SIZE })`, which meant the number on the page was really "how many
 * cards fit under the ceiling" wearing the costume of "how many components
 * this person has published". The same number was the Components tab badge, so
 * the page agreed with itself and both were wrong the same way.
 *
 * The pipeline below is checked without a database, the way the cursor round
 * trip in `pagination.test.ts` is: what is worth pinning is the shape of the
 * query, not Mongo's arithmetic.
 */
describe("authorStatsPipeline", () => {
  const [match, group] = authorStatsPipeline("ada");

  it("matches the same rows a listing would show this author", () => {
    // The filter is written twice — here and in `listComponentsPage` — and the
    // day the two disagree the tiles count drafts, unlisted items or somebody
    // else's work, and nothing about the page looks broken.
    expect(match).toEqual({
      $match: {
        "author.username": "ada",
        status: "published",
        visibility: "public",
      },
    });
  });

  it("is not bounded by the page size", () => {
    // There is no `$limit` anywhere in it. That is the entire difference
    // between this and the `reduce`, and it is the whole reason the function
    // exists.
    const serialized = JSON.stringify(authorStatsPipeline("ada"));
    expect(serialized).not.toContain("$limit");
    expect(serialized).not.toContain(String(MAX_PAGE_SIZE));
  });

  it("counts rows and sums the three counters in one pass", () => {
    expect(group).toEqual({
      $group: {
        _id: null,
        components: { $sum: 1 },
        views: { $sum: { $ifNull: ["$views", 0] } },
        likes: { $sum: { $ifNull: ["$likes", 0] } },
        installs: { $sum: { $ifNull: ["$installs", 0] } },
      },
    });
  });

  it("groups into exactly one row, so the answer is one document", () => {
    // `_id: null` is what makes `$group` collapse the whole match into a
    // single accumulator. Without it every author would come back as one row
    // per component and the caller would be summing a page again.
    expect((group as { $group: { _id: unknown } }).$group._id).toBeNull();
  });

  it("reads a missing counter as zero rather than as nothing", () => {
    // The counters are denormalised onto the document and the oldest records
    // predate them. A bare `$sum: "$views"` over documents where the field is
    // absent skips those rows; the author with a decade of old components
    // loses a decade of views instead of counting them as zero.
    for (const field of ["views", "likes", "installs"]) {
      const group = (authorStatsPipeline("ada")[1] as {
        $group: Record<string, unknown>;
      }).$group;
      expect(group[field]).toEqual({ $sum: { $ifNull: [`$${field}`, 0] } });
    }
  });
});

describe("EMPTY_AUTHOR_STATS", () => {
  /**
   * A `$group` over zero documents emits no row at all, so the caller has to
   * substitute something. Substituting `undefined` instead of this would put
   * `NaN` in every stat tile of every profile with nothing published — the
   * empty profile is the first page anyone opens after signing up.
   */
  it("is four zeroes, and never nullish", () => {
    expect(EMPTY_AUTHOR_STATS).toEqual({
      components: 0,
      views: 0,
      likes: 0,
      installs: 0,
    });
    for (const value of Object.values(EMPTY_AUTHOR_STATS)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
