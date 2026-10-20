import { MetadataRoute } from "next";
import { listVibecode, listWebsites } from "@/lib/db/content";
import { generateWebsiteSlug } from "@/lib/slug";
import type { VibecodeComponent, Website } from "@/lib/types";

// Helper function to escape XML entities
function escapeXml(str: string): string {
  if (!str) return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The moment a row was last touched, as a number.
 *
 * A row with no date is older than every row that has one, which is what a
 * missing date has always meant: it belongs at the end of a list, not at the
 * front of it.
 */
function touchedAt(value?: Date): number {
  return value ? new Date(value).getTime() : 0;
}

/**
 * The websites, the ones that were touched last first.
 *
 * The accessor hands back the catalogue in the order the pages show it, and
 * that order is the one a curator chose. A sitemap is a promise about what
 * changed, so the order is put back here and the pages a crawler visits
 * first are the ones that moved.
 */
function recentlyTouched(websites: Website[]): Website[] {
  return [...websites].sort(
    (a, b) => touchedAt(b.updatedAt) - touchedAt(a.updatedAt),
  );
}

/**
 * The published drops, the ones that were published last first.
 *
 * The accessor lists every drop, and a sitemap only ever names the ones the
 * gallery shows, so the rest are dropped here rather than being fetched and
 * then thrown away. A drop without a publication date belongs at the end of
 * the list, which is where the sort puts it.
 */
function publishedDrops(drops: VibecodeComponent[]): VibecodeComponent[] {
  return drops
    .filter((drop) => drop.status === "published")
    .sort((a, b) => {
      const published = touchedAt(b.publishedAt) - touchedAt(a.publishedAt);
      if (published !== 0) return published;
      return touchedAt(b.updatedAt) - touchedAt(a.updatedAt);
    });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://shadway.online";

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/new`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sponsor`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/template`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/component-generator`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/vibecode`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
  ];

  try {
    // Get all websites for dynamic pages
    const websites = recentlyTouched(await listWebsites());

    // Generate dynamic pages for each website (if you have individual pages)
    const websitePages = websites.map((website) => ({
      url: escapeXml(`${baseUrl}/website/${generateWebsiteSlug(website.name)}`),
      lastModified: website.updatedAt || website.createdAt || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    // Category pages
    const categories = [
      ...new Set(websites.map((w) => w.category.toLowerCase())),
    ];
    const categoryPages = categories.map((category) => ({
      url: escapeXml(`${baseUrl}/category/${encodeURIComponent(category)}`),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const vibecodeItems = publishedDrops(await listVibecode());

    const vibecodePages = vibecodeItems.map((item) => ({
      url: escapeXml(`${baseUrl}/vibecode/${encodeURIComponent(item.slug)}`),
      lastModified:
        item.updatedAt || item.publishedAt || item.createdAt || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    return [
      ...staticPages,
      ...websitePages,
      ...categoryPages,
      ...vibecodePages,
    ];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticPages;
  }
}
