import "dotenv/config";
import { db } from "./lib/db/postgres";
import { components } from "./lib/db/schema";
import { like, desc } from "drizzle-orm";

async function main() {
  const rows = await db()
    .select({
      slug: components.slug,
      createdAt: components.createdAt,
      updatedAt: components.updatedAt,
      status: components.status,
      visibility: components.visibility,
    })
    .from(components)
    .where(like(components.slug, "qa-%"))
    .orderBy(desc(components.createdAt));
  console.log(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
