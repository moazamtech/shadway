import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "./postgres";
import {
  config,
  submissions,
  templates,
  vibecode,
  websites,
} from "./schema";
import type { Submission, Template, VibecodeComponent, Website } from "@/lib/types";

/**
 * The older half of the catalogue.
 *
 * The templates, the websites, the community drops and the submissions are
 * simple documents with a handful of fields, and they were read straight out
 * of Mongo by the routes that own them. They live here now, in one place, so
 * that a route is a route and not a database client: the shape of the answer
 * is decided once, here, and every caller gets the same one.
 *
 * The `_id` in the returned documents is the same text id Mongo used, so the
 * pages that link to a website or a template keep working without knowing that
 * the database changed.
 */

function idOf(id: string): string {
  return id;
}

/* ------------------------------------------------------------------ config -- */

/** One configuration value, or null. */
export async function getConfigValue<T = unknown>(id: string): Promise<T | null> {
  const rows = await db()
    .select({ value: config.value })
    .from(config)
    .where(eq(config.id, id))
    .limit(1);
  return (rows[0]?.value ?? null) as T | null;
}

/** Write one configuration value. */
export async function setConfigValue(id: string, value: unknown): Promise<void> {
  const target = db();
  const existing = await target
    .select({ id: config.id })
    .from(config)
    .where(eq(config.id, id))
    .limit(1);

  if (existing.length) {
    await target
      .update(config)
      .set({ value, updatedAt: new Date() })
      .where(eq(config.id, id));
    return;
  }

  await target.insert(config).values({ id, value });
}

/* --------------------------------------------------------------- templates -- */

/** Every template, in the order the pages show them. */
export async function listTemplates(): Promise<Template[]> {
  const rows = await db()
    .select()
    .from(templates)
    .orderBy(asc(templates.sequence), desc(templates.createdAt));
  return rows.map((row) => ({ ...row, _id: row.id })) as Template[];
}

/** One template, by id. */
export async function getTemplate(id: string): Promise<Template | null> {
  const rows = await db()
    .select()
    .from(templates)
    .where(eq(templates.id, idOf(id)))
    .limit(1);
  return rows.length ? ({ ...rows[0], _id: rows[0].id } as Template) : null;
}

/** Write a template and return it with its id. */
export async function insertTemplate(
  values: Omit<Template, "_id" | "createdAt" | "updatedAt">,
): Promise<Template> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db()
    .insert(templates)
    .values({
      id,
      name: values.name,
      description: values.description ?? null,
      image: values.image ?? null,
      demoUrl: values.demoUrl ?? null,
      purchaseUrl: values.purchaseUrl ?? null,
      price: typeof values.price === "number" ? values.price : null,
      featured: values.featured ?? false,
      sequence: values.sequence ?? 0,
      downloads: values.downloads ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  return { ...values, _id: id, createdAt: now, updatedAt: now } as Template;
}

/** Change a template. */
export async function updateTemplate(
  id: string,
  patch: Partial<Template>,
): Promise<Template | null> {
  const existing = await getTemplate(id);
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.image !== undefined) values.image = patch.image;
  if (patch.demoUrl !== undefined) values.demoUrl = patch.demoUrl;
  if (patch.purchaseUrl !== undefined) values.purchaseUrl = patch.purchaseUrl;
  if (patch.price !== undefined) {
    values.price = typeof patch.price === "number" ? patch.price : null;
  }
  if (patch.featured !== undefined) values.featured = patch.featured;
  if (patch.sequence !== undefined) values.sequence = patch.sequence;
  if (patch.downloads !== undefined) values.downloads = patch.downloads;

  await db().update(templates).set(values).where(eq(templates.id, idOf(id)));
  return getTemplate(id);
}

/** Remove a template. */
export async function deleteTemplate(id: string): Promise<boolean> {
  const existing = await getTemplate(id);
  if (!existing) return false;
  await db().delete(templates).where(eq(templates.id, idOf(id)));
  return true;
}

/* ---------------------------------------------------------------- websites -- */

/** Every website, in the order the pages show them. */
export async function listWebsites(): Promise<Website[]> {
  const rows = await db()
    .select()
    .from(websites)
    .orderBy(asc(websites.sequence), desc(websites.createdAt));
  return rows.map((row) => ({ ...row, _id: row.id })) as Website[];
}

/** One website, by id. */
export async function getWebsite(id: string): Promise<Website | null> {
  const rows = await db()
    .select()
    .from(websites)
    .where(eq(websites.id, idOf(id)))
    .limit(1);
  return rows.length ? ({ ...rows[0], _id: rows[0].id } as Website) : null;
}

/** Write a website. */
export async function insertWebsite(
  values: Omit<Website, "_id" | "createdAt" | "updatedAt">,
): Promise<Website> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db()
    .insert(websites)
    .values({
      id,
      name: values.name,
      description: values.description ?? null,
      url: values.url ?? null,
      image: values.image ?? null,
      category: values.category ?? null,
      tags: values.tags ?? [],
      featured: values.featured ?? false,
      sequence: values.sequence ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  return { ...values, _id: id, createdAt: now, updatedAt: now } as Website;
}

/** Change a website. */
export async function updateWebsite(
  id: string,
  patch: Partial<Website>,
): Promise<Website | null> {
  const existing = await getWebsite(id);
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.url !== undefined) values.url = patch.url;
  if (patch.image !== undefined) values.image = patch.image;
  if (patch.category !== undefined) values.category = patch.category;
  if (patch.tags !== undefined) values.tags = patch.tags;
  if (patch.featured !== undefined) values.featured = patch.featured;
  if (patch.sequence !== undefined) values.sequence = patch.sequence;

  await db().update(websites).set(values).where(eq(websites.id, idOf(id)));
  return getWebsite(id);
}

/** Remove a website. */
export async function deleteWebsite(id: string): Promise<boolean> {
  const existing = await getWebsite(id);
  if (!existing) return false;
  await db().delete(websites).where(eq(websites.id, idOf(id)));
  return true;
}

/**
 * Put a list of websites in a new order.
 *
 * The order is a list of ids, and the sequence each one gets is its place in
 * that list — so reordering is one write per website and never a transaction
 * over the whole table.
 */
export async function reorderWebsites(ids: string[]): Promise<void> {
  const target = db();
  await Promise.all(
    ids.map((id, index) =>
      target
        .update(websites)
        .set({ sequence: index, updatedAt: new Date() })
        .where(eq(websites.id, idOf(id))),
    ),
  );
}

/* ---------------------------------------------------------------- vibecode -- */

/** Every community drop, newest first. */
export async function listVibecode(limit?: number): Promise<VibecodeComponent[]> {
  const query = db()
    .select()
    .from(vibecode)
    .orderBy(desc(vibecode.createdAt));
  const rows = limit ? await query.limit(limit) : await query;
  return rows.map((row) => ({ ...row, _id: row.id })) as unknown as VibecodeComponent[];
}

/** One drop, by slug. */
export async function getVibecodeBySlug(slug: string): Promise<VibecodeComponent | null> {
  const rows = await db()
    .select()
    .from(vibecode)
    .where(eq(vibecode.slug, slug))
    .limit(1);
  return rows.length ? ({ ...rows[0], _id: rows[0].id } as unknown as VibecodeComponent) : null;
}

/** One drop, by id. */
export async function getVibecode(id: string): Promise<VibecodeComponent | null> {
  const rows = await db()
    .select()
    .from(vibecode)
    .where(eq(vibecode.id, idOf(id)))
    .limit(1);
  return rows.length ? ({ ...rows[0], _id: rows[0].id } as unknown as VibecodeComponent) : null;
}

/** Write a drop. */
export async function insertVibecode(
  values: Omit<VibecodeComponent, "_id" | "createdAt" | "updatedAt">,
): Promise<VibecodeComponent> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db()
    .insert(vibecode)
    .values({
      id,
      title: values.title,
      description: values.description ?? null,
      slug: values.slug,
      prompt: values.prompt ?? null,
      category: values.category ?? null,
      tags: values.tags ?? [],
      thumbnailUrl: values.thumbnailUrl ?? null,
      code: values.code ?? null,
      files: values.files ?? {},
      entryFile: values.entryFile ?? null,
      language: values.language ?? null,
      status: values.status ?? "draft",
      viewCount: values.viewCount ?? 0,
      createdBy: values.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
      publishedAt: values.publishedAt ?? null,
    });
  return { ...values, _id: id, createdAt: now, updatedAt: now } as VibecodeComponent;
}

/** Change a drop. */
export async function updateVibecode(
  id: string,
  patch: Partial<VibecodeComponent>,
): Promise<VibecodeComponent | null> {
  const existing = await getVibecode(id);
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of [
    "title",
    "description",
    "slug",
    "prompt",
    "category",
    "tags",
    "thumbnailUrl",
    "code",
    "files",
    "entryFile",
    "language",
    "status",
    "viewCount",
    "createdBy",
    "publishedAt",
  ] as const) {
    if (patch[key] !== undefined) {
      values[key] = patch[key] as unknown;
    }
  }

  await db().update(vibecode).set(values).where(eq(vibecode.id, idOf(id)));
  return getVibecode(id);
}

/** Remove a drop. */
export async function deleteVibecode(id: string): Promise<boolean> {
  const existing = await getVibecode(id);
  if (!existing) return false;
  await db().delete(vibecode).where(eq(vibecode.id, idOf(id)));
  return true;
}

/** Count the drops that are published. */
export async function countPublishedVibecode(): Promise<number> {
  const rows = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(vibecode)
    .where(eq(vibecode.status, "published"));
  return rows[0]?.count ?? 0;
}

/* ------------------------------------------------------------- submissions -- */

/** Every submission, newest first. */
export async function listSubmissions(): Promise<Submission[]> {
  const rows = await db()
    .select()
    .from(submissions)
    .orderBy(desc(submissions.createdAt));
  return rows.map((row) => ({ ...row, _id: row.id })) as Submission[];
}

/** One submission, by id. */
export async function getSubmission(id: string): Promise<Submission | null> {
  const rows = await db()
    .select()
    .from(submissions)
    .where(eq(submissions.id, idOf(id)))
    .limit(1);
  return rows.length ? ({ ...rows[0], _id: rows[0].id } as Submission) : null;
}

/** Write a submission. */
export async function insertSubmission(
  values: Omit<Submission, "_id" | "createdAt" | "updatedAt">,
): Promise<Submission> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db()
    .insert(submissions)
    .values({
      id,
      name: values.name,
      email: values.email,
      websiteName: values.websiteName ?? null,
      websiteUrl: values.websiteUrl ?? null,
      description: values.description ?? null,
      category: values.category ?? null,
      githubUrl: values.githubUrl ?? null,
      status: values.status ?? "pending",
      createdAt: now,
      updatedAt: now,
    });
  return { ...values, _id: id, createdAt: now, updatedAt: now } as Submission;
}

/** Change a submission. */
export async function updateSubmission(
  id: string,
  patch: Partial<Submission>,
): Promise<Submission | null> {
  const existing = await getSubmission(id);
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of [
    "name",
    "email",
    "websiteName",
    "websiteUrl",
    "description",
    "category",
    "githubUrl",
    "status",
  ] as const) {
    if (patch[key] !== undefined) {
      values[key] = patch[key] as unknown;
    }
  }

  await db().update(submissions).set(values).where(eq(submissions.id, idOf(id)));
  return getSubmission(id);
}

/** Remove a submission. */
export async function deleteSubmission(id: string): Promise<boolean> {
  const existing = await getSubmission(id);
  if (!existing) return false;
  await db().delete(submissions).where(eq(submissions.id, idOf(id)));
  return true;
}

/** The submissions with a given status, for a queue. */
export async function listSubmissionsByStatus(status: string): Promise<Submission[]> {
  const rows = await db()
    .select()
    .from(submissions)
    .where(eq(submissions.status, status))
    .orderBy(desc(submissions.createdAt));
  return rows.map((row) => ({ ...row, _id: row.id })) as Submission[];
}

/** The ids of a set of rows, in the order they were given. */
export function idsInOrder(ids: string[]): string[] {
  return ids.filter(Boolean);
}

export { and, inArray };
