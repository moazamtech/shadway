import "dotenv/config";
import { connectToDatabase } from "../lib/mongodb";
import fs from "fs";
import path from "path";

async function seed() {
  const { db } = await connectToDatabase();
  const collection = db.collection("components");

  const already = await collection.countDocuments();
  if (already > 0) {
    console.log(`Components already seeded (${already}).`);
    return;
  }

  const registryDir = path.join(process.cwd(), "registry");
  const files = ["pulse-button.json", "neo-card.json"].filter((file) =>
    fs.existsSync(path.join(registryDir, file))
  );

  for (const file of files) {
    const item = JSON.parse(fs.readFileSync(path.join(registryDir, file), "utf8"));
    const firstFile = Array.isArray(item.files) ? item.files[0] : null;
    await collection.insertOne({
      slug: item.name,
      name: item.name,
      title: item.title || item.name,
      description: item.description || "",
      code: firstFile?.content || "",
      files: item.files,
      category: item.category || "ui",
      tags: item.categories ? [item.categories] : [],
      dependencies: item.dependencies || [],
      devDependencies: item.devDependencies || [],
      registryDependencies: item.registryDependencies || [],
      cssVars: item.cssVars,
      author: { userId: "shadway", name: "Shadway", username: "shadway", avatar: undefined },
      visibility: "public",
      status: "published",
      installs: 0,
      views: 0,
      likes: 0,
      featured: false,
      version: "1.0.0",
      license: "MIT",
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    });
    console.log(`Seeded ${item.name}`);
  }

  await collection.createIndexes([
    { key: { slug: 1 }, unique: true },
    { key: { "author.username": 1 } },
    { key: { status: 1, visibility: 1, createdAt: -1 } },
    { key: { tags: 1 } },
    { key: { title: "text", description: "text", tags: "text", name: "text" } },
  ]);
}

seed()
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
