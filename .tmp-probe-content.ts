import "dotenv/config";
import { MongoClient } from "mongodb";
import { db } from "./lib/db/postgres";
import { config, submissions, templates, vibecode, websites } from "./lib/db/schema";

function shape(id: string) {
  if (/^[0-9a-f]{24}$/i.test(id)) return "hex24";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return "uuid";
  return "other";
}

async function main() {
  const pg = db();

  const t = await pg.select().from(templates);
  const w = await pg.select().from(websites);
  const v = await pg.select().from(vibecode);
  const s = await pg.select().from(submissions);
  const c = await pg.select().from(config);

  console.log("pg counts:", {
    templates: t.length,
    websites: w.length,
    vibecode: v.length,
    submissions: s.length,
    config: c.length,
  });

  const ids = [...t, ...w, ...v, ...s].map((row) => row.id);
  const shapes = new Set(ids.map(shape));
  console.log("id shapes:", [...shapes]);
  console.log("template sample:", t[0]);
  console.log("website sample:", w[0]);
  console.log("submission sample:", s[0]);
  console.log("config rows:", c);

  const createdBy = new Set(v.map((row) => JSON.stringify(row.createdBy)));
  console.log("pg vibecode createdBy values:", [...createdBy].slice(0, 5), "count", createdBy.size);
  console.log("pg vibecode statuses:", new Set(v.map((row) => row.status)));
  console.log("pg vibecode publishedAt null count:", v.filter((r) => !r.publishedAt).length);
  console.log("pg vibecode files null count:", v.filter((r) => r.files === null).length);
  console.log("pg template price nulls:", t.filter((r) => r.price === null).length);
  console.log("pg website tags empty:", w.filter((r) => (r.tags ?? []).length === 0).length);

  const mongo = await MongoClient.connect(process.env.MONGODB_URI!);
  const src = mongo.db("shadcn-hub");
  const mv = await src.collection("vibecode").find({}).toArray();
  const mb = new Set(mv.map((row) => JSON.stringify(row.createdBy)));
  console.log("mongo vibecode createdBy sample:", [...mb].slice(0, 5), "count", mb.size);
  console.log("mongo vibecode statuses:", new Set(mv.map((row) => row.status)));
  console.log("mongo vibecode count:", mv.length);
  const mdocs = await src.collection("vibecode").find({}).limit(3).toArray();
  for (const row of mdocs) {
    console.log("mongo vibecode doc keys:", Object.keys(row), "createdBy:", row.createdBy);
  }
  const mw = await src.collection("websites").find({}).toArray();
  console.log("mongo websites keys sample:", Object.keys(mw[0] ?? {}));
  const mt = await src.collection("templates").find({}).toArray();
  console.log("mongo templates keys sample:", Object.keys(mt[0] ?? {}), "price:", mt[0]?.price);
  const ms = await src.collection("submissions").find({}).toArray();
  console.log("mongo submissions count:", ms.length, "sample:", ms[0]);
  const mc = await src.collection("config").find({}).toArray();
  console.log("mongo config:", mc);

  await mongo.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
