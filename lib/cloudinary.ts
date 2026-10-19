import { v2 as cloudinary } from "cloudinary";
import fetch from "node-fetch";
import os from "os";
import fs from "fs";
import path from "path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadToCloudinary(filePath: string, publicId?: string) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "og_images",
      public_id: publicId,
      overwrite: true,
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
}

/**
 * Downloads a remote image URL, uploads it to Cloudinary,
 * and deletes the local temp file.
 */
export async function uploadRemoteImageToCloudinary(
  imageUrl: string,
  publicId?: string,
): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch remote image: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, Buffer.from(buffer));

    const result = await cloudinary.uploader.upload(tempPath, {
      folder: "og_images",
      public_id: publicId,
      overwrite: true,
    });

    fs.unlinkSync(tempPath);
    return result.secure_url;
  } catch (err) {
    console.error("uploadRemoteImageToCloudinary failed:", err);
    throw err;
  }
}

/**
 * Whether this deployment has the credentials an upload needs.
 *
 * `cloudinary.config` above is called at import time with `process.env` values
 * that are `undefined` on a checkout without a `.env`, and it does not throw —
 * the failure arrives later, as an exception from inside the SDK, with a
 * message about a missing `cloud_name` that reads like a bug in whatever
 * called it. Callers that are *meant* to degrade (the profile avatar picker,
 * which has to keep saving a bio and two links when there is no bucket) ask
 * this first and say so in the UI, instead of discovering the absence through
 * a 500.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export async function uploadBufferToCloudinary(
  buffer: ArrayBuffer,
  filename?: string,
  publicId?: string,
  /**
   * `folder` defaults to the thumbnails folder this helper has always written
   * to, so every existing caller is unaffected. An avatar is not a thumbnail
   * and burying it under `vibecode_thumbnails` makes the bucket unreadable
   * for whoever prunes it — hence the option rather than a second upload
   * function.
   */
  options: { folder?: string } = {},
): Promise<string> {
  const ext = filename ? path.extname(filename) : ".png";
  const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}${ext}`);
  try {
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    const result = await cloudinary.uploader.upload(tempPath, {
      folder: options.folder ?? "vibecode_thumbnails",
      public_id: publicId,
      overwrite: true,
    });
    return result.secure_url;
  } catch (err) {
    console.error("uploadBufferToCloudinary failed:", err);
    throw err;
  } finally {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      console.warn("Failed to clean up temp upload file:", cleanupError);
    }
  }
}
