import type { Metadata } from "next";

import { CARD_FIELDS, getComponentBySlugAnyStatus } from "@/lib/db/components";
import { generateSEOMetadata } from "@/lib/seo";
import ComponentDetailClient from "./component-detail-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Component metadata, read server-side.
 *
 * Projected to the card fields, which is what a share card needs and nothing
 * more: a full component document carries the author's source, the whole
 * project and the prebuilt preview document — a couple of hundred kilobytes,
 * read on every request and thrown away after the `<head>` is built.
 *
 * `getComponentBySlugAnyStatus` rather than the published-only read, because the
 * page itself resolves an unpublished component for its owner and its reviewer;
 * the metadata is marked noindex below in that case, so the extra row is never
 * one a crawler gets to describe.
 */
async function getComponentForMeta(slug: string) {
  return getComponentBySlugAnyStatus(slug, { projection: CARD_FIELDS });
}

/** Mongo dates, defensively — an older record may not carry the field at all. */
function toIso(value: unknown): string | undefined {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : undefined;
}

/**
 * What a share card says when there is nothing to say it about.
 *
 * Not "Component not found" — that is what a visitor gets, and this string ends
 * up indexed if it ever escapes into a `<title>`. It is also what the site-wide
 * defaults in `generateSEOMetadata` would otherwise say, which is a sentence
 * about websites on a page about a component.
 */
const UNAVAILABLE_DESCRIPTION =
  "Browse installable React and Tailwind components built with shadcn/ui on Shadway.";

/**
 * A component's own card.
 *
 * The page this sits on used to have no `generateMetadata` at all, so every
 * component in the catalogue shared the site's generic image — pasting two
 * different components into Slack or Discord produced two identical cards, on
 * the one surface where the picture is the entire point of the paste.
 */
function componentMetadata(
  component: NonNullable<Awaited<ReturnType<typeof getComponentForMeta>>>,
  slug: string,
): Metadata {
  const isPublished = component.status === "published";
  const title = component.title || slug;
  const tags = (component.tags ?? []).filter(Boolean);

  return generateSEOMetadata({
    title: `${title} | Shadcn UI Component`,
    // The author's own words when they wrote any. Composited otherwise, because
    // a component card with an empty description is a card with nothing under
    // the title, and `generateSEOMetadata`'s site-wide default would describe
    // websites instead.
    description:
      component.description?.trim() ||
      [
        title,
        component.category ? `${component.category} component` : "",
        tags.length ? `tagged ${tags.slice(0, 3).join(", ")}` : "",
        component.author?.name ? `by ${component.author.name}` : "",
      ]
        .filter(Boolean)
        .join(" — ") ||
      UNAVAILABLE_DESCRIPTION,
    keywords: tags,
    // `thumbnailUrl` is the author's cover. `resolveOgImage` turns it absolute
    // and, when it is missing or unusable, lands on the committed placeholder —
    // a relative path here would be dropped by the scraper entirely.
    image: component.thumbnailUrl,
    url: `/c/${slug}`,
    type: "article",
    publishedTime: toIso(component.createdAt),
    modifiedTime: toIso(component.updatedAt),
    author: component.author?.name,
    section: component.category,
    tags,
    // A draft, a submission in review, or a hidden component is served to its
    // owner and the admins and reads "not found" to everyone else. Describing
    // it in the `<head>` would both leak the pending title to a crawler and
    // invite it to index a page it cannot see.
    noIndex: !isPublished,
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  let component: Awaited<ReturnType<typeof getComponentForMeta>> = null;
  try {
    component = await getComponentForMeta(slug);
  } catch (error) {
    // The database is unreachable, or `MONGODB_URI` is unset — the same
    // condition the detail route survives by reading `registry/`. Metadata
    // generation must not be the thing that takes the page down: a wrong card
    // is recoverable, a 500 is not.
    console.error(`Failed to build metadata for component "${slug}":`, error);
  }

  if (!component) {
    return generateSEOMetadata({
      title: "Component not found | Shadway",
      description: UNAVAILABLE_DESCRIPTION,
      url: `/c/${slug}`,
      noIndex: true,
    });
  }

  return componentMetadata(component, slug);
}

/**
 * The page renders nothing of its own.
 *
 * Every visible part of this route is state — the loading skeleton, the
 * not-found panel, the tab strip — and all of it belongs to the client
 * component, which fetches the component itself. This server shell exists only
 * so `generateMetadata` has a server component to live in; rendering the client
 * component unchanged keeps the page byte-identical to what it was before the
 * split.
 */
export default function ComponentDetailPage() {
  return <ComponentDetailClient />;
}