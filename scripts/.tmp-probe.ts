import "dotenv/config";
import { getAuthorStats, listComponents, listComponentsPage } from "../lib/db/components";

async function main() {
  const items = await listComponents({ limit: 5 });
  console.log("the feed answers:", items.map((row) => row.slug).join(", "));
  const stats = await getAuthorStats("moazamdevw");
  console.log("the author totals:", JSON.stringify(stats));
  const page = await listComponentsPage({ limit: 1 });
  console.log("a page answers:", page.items[0]?.slug, "hasMore:", page.hasMore);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
