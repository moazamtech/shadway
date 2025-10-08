import 'dotenv/config';
import cloudinary from "cloudinary";
import fetch from "node-fetch";
import { connectToDatabase } from "../lib/mongodb";
import { Readable } from "stream";

// ✅ Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to upload an image URL to Cloudinary
async function uploadToCloudinary(imageUrl: string, folder = "website_images") {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${imageUrl}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );

      // ✅ No streamifier — use built-in Node stream
      Readable.from(buffer).pipe(uploadStream);
    });

    return result.secure_url;
  } catch (error: any) {
    console.error("❌ Upload failed for", imageUrl, error.message);
    return imageUrl; // fallback
  }
}

// ✅ Main migration function
async function migrateAllImages() {
  const { db } = await connectToDatabase();
  const websites = db.collection("websites");

  const all = await websites.find({}).toArray();
  console.log(`Found ${all.length} websites.`);

  for (const site of all) {
    let updated = false;
    const updates: any = {};

    if (site.ogImage && site.ogImage.startsWith("http") && !site.ogImage.includes("cloudinary")) {
      console.log("Uploading ogImage for:", site.url);
      updates.ogImage = await uploadToCloudinary(site.ogImage, "og_images");
      updated = true;
    }

    if (site.favicon && site.favicon.startsWith("http") && !site.favicon.includes("cloudinary")) {
      console.log("Uploading favicon for:", site.url);
      updates.favicon = await uploadToCloudinary(site.favicon, "favicons");
      updated = true;
    }

    if (updated) {
      await websites.updateOne({ _id: site._id }, { $set: updates });
      console.log("✅ Updated:", site.url);
    }
  }

  console.log("🎉 Migration complete!");
  process.exit(0);
}

migrateAllImages().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
