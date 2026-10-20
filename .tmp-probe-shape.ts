import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { db } from "./lib/db/postgres";
import { submissions, templates, vibecode, websites } from "./lib/db/schema";

async function main() {
  const pg = db();
  const mongo = await MongoClient.connect(process.env.MONGODB_URI!);
  const src = mongo.db("shadcn-hub");

  async function compare(
    name: string,
    table: typeof templates,
    keys: string[],
  ) {
    const rows = await pg.select().from(table);
    const docs = await src.collection(name).find({}).toArray();
    const mongoKeys = new Set<string>();
    for (const doc of docs) {
      for (const key of Object.keys(doc)) mongoKeys.add(key);
    }
    const pgKeys = new Set<string>();
    for (const row of rows) pgKeys.add(key0(row));
    console.log(`--- ${name}: pg ${rows.length}, mongo ${docs.length}`);
    console.log("  mongo keys:", [...mongoKeys].join(","));
    console.log("  pg keys:", [...pgKeys].join(","));
    for (const key of keys) {
      const nulls = rows.filter((row) => (row as Record<string, unknown>)[key] === null).length;
      const missing = docs.filter((doc) => !(key in doc)).length;
      const undefinedInMongo = docs.filter((doc) => (doc as Record<string, unknown>)[key] === undefined).length;
      if (nulls || missing || undefinedInMongo) {
        console.log(`  ${key}: pg nulls=${nulls}, mongo missing key=${missing}, mongo undefined=${undefinedInMongo}`);
      }
    }
  }

  function key0(row: unknown) {
    return JSON.stringify(Object.keys(row as object));
  }

  await compare("templates", templates, [
    "name",
    "description",
    "image",
    "demoUrl",
    "purchaseUrl",
    "price",
    "featured",
    "sequence",
    "downloads",
  ]);
  await compare("websites", websites, [
    "name",
    "description",
    "url",
    "image",
    "category",
    "tags",
    "featured",
    "sequence",
  ]);
  await compare("submissions", submissions, [
    "name",
    "email",
    "websiteName",
    "websiteUrl",
    "description",
    "category",
    "githubUrl",
    "status",
  ]);
  await compare("vibecode", vibecode, [
    "title",
    "description",
    "slug",
    "prompt",
    "category",
    "tags",
    "thumbnailUrl",
    "code",
    "entryFile",
    "language",
    "status",
    "viewCount",
  ]);

  const tdocs = await src.collection("templates").find({}).toArray();
  const oddPrices = tdocs.filter((doc) => typeof doc.price !== "number");
  console.log("templates with non-number price:", oddPrices.length, oddPrices.map((d) => d.price));
  const pgPrices = await pg.select().from(templates);
  console.log("pg prices:", pgPrices.map((r) => r.price));

  const vdocs = await src.collection("vibecode").find({}).toArray();
  const odd = vdocs.filter((doc) => typeof doc.createdBy !== "object" || doc.createdBy === null);
  console.log("vibecode with non-object createdBy:", odd.length);

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
