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

export async function uploadBufferToCloudinary(
  buffer: ArrayBuffer,
  filename?: string,
  publicId?: string,
): Promise<string> {
  const ext = filename ? path.extname(filename) : ".png";
  const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}${ext}`);
  try {
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    const result = await cloudinary.uploader.upload(tempPath, {
      folder: "vibecode_thumbnails",
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
