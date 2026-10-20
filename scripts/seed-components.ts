import "dotenv/config";
import fs from "fs";
import path from "path";
import { count } from "drizzle-orm";

import { db } from "../lib/db/postgres";
import { components } from "../lib/db/schema";

/**
 * The first components.
 *
 * A registry with nothing in it is a registry nobody can see, so the two
 * reference components are written once — and only when the table is empty,
 * because a seeding script that overwrites a published component is a very
 * expensive mistake.
 */
async function seed() {
  const client = db();

  const already = await client.select({ count: count() }).from(components);
  if ((already[0]?.count ?? 0) > 0) {
    console.log(`Components already seeded (${already[0]?.count}).`);
    return;
  }

  const registryDir = path.join(process.cwd(), "registry");
  const files = ["pulse-button.json", "neo-card.json"].filter((file) =>
    fs.existsSync(path.join(registryDir, file)),
  );

  for (const file of files) {
    const item = JSON.parse(fs.readFileSync(path.join(registryDir, file), "utf8"));
    const firstFile = Array.isArray(item.files) ? item.files[0] : null;
    await client
      .insert(components)
      .values({
        id: crypto.randomUUID(),
        slug: item.name,
        name: item.name,
        title: item.title || item.name,
        description: item.description || "",
        code: firstFile?.content || "",
        files: Object.fromEntries(
          (Array.isArray(item.files) ? item.files : []).map((entry: { path: string; content: string }) => [
            entry.path,
            entry.content,
          ]),
        ),
        category: item.category || "ui",
        tags: item.categories ? [item.categories] : [],
        dependencies: item.dependencies || [],
        devDependencies: item.devDependencies || [],
        registryDependencies: item.registryDependencies || [],
        cssVars: item.cssVars ?? {},
        author: { userId: "shadway", name: "Shadway", username: "shadway", avatar: null },
        visibility: "public",
        status: "published",
        installs: 0,
        views: 0,
        likes: 0,
        bookmarks: 0,
        featured: false,
        version: "1.0.0",
        license: "MIT",
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      })
      .onConflictDoNothing({ target: components.slug });
    console.log(`Seeded ${item.name}`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
