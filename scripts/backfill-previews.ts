import "dotenv/config";
import { getComponentsCollection } from "../lib/db/components";
import { buildPreviewBundle } from "../lib/preview/bundle";
import { componentSourceFiles } from "../lib/preview/files";
import { capturePreview } from "../lib/preview/capture";
import { uploadBufferToCloudinary } from "../lib/cloudinary";

async function main() {
  const collection = await getComponentsCollection();
  const items = await collection.find({}).toArray();

  for (const item of items) {
    process.stdout.write(`- ${item.slug} ... `);

    const bundle = await buildPreviewBundle(
      componentSourceFiles({ code: item.code, demoCode: item.demoCode, files: item.files }),
      { entry: "/src/App.tsx", title: item.title }
    );

    const capture = await capturePreview(bundle.html, { width: 1200, height: 900 });

    if (!capture) {
      console.log("capture failed");
      continue;
    }

    let thumbnailUrl = item.thumbnailUrl;
    try {
      thumbnailUrl = await uploadBufferToCloudinary(
        capture.buffer.buffer.slice(
          capture.buffer.byteOffset,
          capture.buffer.byteOffset + capture.buffer.byteLength
        ) as ArrayBuffer,
        `${item.slug}-cover.png`,
        `shadway-covers/${item.slug}`
      );
    } catch (e) {
      console.log("upload failed:", e instanceof Error ? e.message : e);
    }

    await collection.updateOne(
      { slug: item.slug },
      {
        $set: {
          previewHtml: bundle.html,
          previewHash: bundle.hash,
          thumbnailUrl,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`ok -> ${thumbnailUrl ? "cloudinary" : "no cover"}`);
  }

  await collection.createIndexes([
    { key: { slug: 1 }, unique: true },
    { key: { "author.username": 1 } },
    { key: { status: 1, visibility: 1, createdAt: -1 } },
    { key: { tags: 1 } },
  ]);

  console.log("done");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });