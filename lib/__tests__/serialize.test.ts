import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { serializeComponent, toPlain, assertSerializable } from "../serialize";
import type { ComponentDocument } from "../db/components";

function makeComponent(overrides: Partial<ComponentDocument> = {}): ComponentDocument {
  const now = new Date("2026-01-02T03:04:05.000Z");
  return {
    slug: "status-pill",
    name: "Status-Pill",
    title: "Status Pill",
    description: "A green status pill.",
    code: "export default function StatusPill() { return null; }",
    category: "ui",
    tags: ["status", "pill"],
    dependencies: ["clsx"],
    devDependencies: [],
    registryDependencies: [],
    author: { userId: "u1", name: "Ada", username: "ada" },
    visibility: "public",
    status: "published",
    installs: 12,
    views: 34,
    likes: 5,
    featured: false,
    version: "1.0.0",
    license: "MIT",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("toPlain", () => {
  it("converts an ObjectId to its hex string", () => {
    const id = new ObjectId();
    expect(toPlain(id)).toBe(id.toHexString());
  });

  it("converts a Date to an ISO string", () => {
    expect(toPlain(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z"
    );
  });

  it("recurses through nested objects and arrays", () => {
    const id = new ObjectId();
    const result = toPlain({
      a: { b: [{ id, when: new Date("2026-01-01T00:00:00.000Z") }] },
    }) as { a: { b: { id: string; when: string }[] } };

    expect(result.a.b[0].id).toBe(id.toHexString());
    expect(result.a.b[0].when).toBe("2026-01-01T00:00:00.000Z");
  });

  it("passes primitives and null through untouched", () => {
    expect(toPlain(null)).toBeNull();
    expect(toPlain(undefined)).toBeNull();
    expect(toPlain(7)).toBe(7);
    expect(toPlain("x")).toBe("x");
    expect(toPlain(false)).toBe(false);
  });
});

describe("serializeComponent", () => {
  it("turns every timestamp into an ISO string", () => {
    const out = serializeComponent(
      makeComponent({ publishedAt: new Date("2026-02-03T00:00:00.000Z") })
    );

    expect(out.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(out.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(out.publishedAt).toBe("2026-02-03T00:00:00.000Z");
  });

  it("stringifies _id rather than leaving an ObjectId", () => {
    const id = new ObjectId();
    const out = serializeComponent(makeComponent({ _id: id }));

    expect(out._id).toBe(id.toHexString());
    expect(out._id).not.toBeInstanceOf(ObjectId);
  });

  it("omits _id entirely when the document has none", () => {
    const out = serializeComponent(makeComponent());
    expect(out._id).toBeUndefined();
  });

  it("never leaves a Date or ObjectId anywhere in the result", () => {
    const id = new ObjectId();
    const out = serializeComponent(
      makeComponent({
        _id: id,
        files: [{ path: "a.tsx", content: "x", type: "tsx" }],
        assets: [{ url: "https://x/y.png", type: "image" }],
      })
    );

    expect(assertSerializable(out)).toBeUndefined();
  });

  it("preserves the fields a card renders", () => {
    const out = serializeComponent(makeComponent());

    expect(out.slug).toBe("status-pill");
    expect(out.title).toBe("Status Pill");
    expect(out.author.username).toBe("ada");
    expect(out.tags).toEqual(["status", "pill"]);
    expect(out.installs).toBe(12);
    expect(out.category).toBe("ui");
  });
});

describe("assertSerializable", () => {
  it("throws on a Date", () => {
    expect(() => assertSerializable({ when: new Date() })).toThrow(
      /not serializable/
    );
  });

  it("throws on an ObjectId", () => {
    expect(() => assertSerializable({ _id: new ObjectId() })).toThrow(
      /not serializable/
    );
  });

  it("does not throw on a serialized component", () => {
    expect(() => assertSerializable(serializeComponent(makeComponent()))).not.toThrow();
  });
});
