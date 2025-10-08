require('dotenv').config();

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
async function uploadToCloudinary(imageUrl: string, folder = "og_images") {
  try {
    console.log("🔄 Uploading:", imageUrl);
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

      Readable.from(buffer).pipe(uploadStream);
    });

    console.log("✅ Uploaded to Cloudinary:", result.secure_url);
    return result.secure_url;
  } catch (error: any) {
    console.error("❌ Upload failed for", imageUrl, error.message);
    return imageUrl;
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

    console.log("🔍 Checking site:", site.url);

    if (site.image) {
      console.log("image found:", site.image);
      if (!site.image.includes("cloudinary")) {
        if (site.image.startsWith("http")) {
          console.log("  Uploading image for:", site.url);
          updates.image = await uploadToCloudinary(site.image, "og_images");
          updated = true;
        } else {
          console.log("  ⚠️ Skipping image: not HTTP URL", site.image);
        }
      } else {
        console.log("  ⏭ Already a Cloudinary image:", site.image);
      }
    }

    if (site.favicon) {
      console.log("  favicon found:", site.favicon);
      if (!site.favicon.includes("cloudinary")) {
        if (site.favicon.startsWith("http")) {
          console.log("  Uploading favicon for:", site.url);
          updates.favicon = await uploadToCloudinary(site.favicon, "favicons");
          updated = true;
        } else {
          console.log("  ⚠️ Skipping favicon: not HTTP URL", site.favicon);
        }
      } else {
        console.log("  ⏭ Already a Cloudinary favicon:", site.favicon);
      }
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
