import { uploadToCloudinary } from './cloudinary';
import puppeteer from 'puppeteer';
import fs from 'fs';

export async function captureScreenshotAndUpload(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const filePath = `/tmp/screenshot-${Date.now()}.png`;
  await page.screenshot({ path: filePath, fullPage: true });
  await browser.close();

  const cloudinaryUrl = await uploadToCloudinary(filePath, "og_images");
  fs.unlinkSync(filePath); // delete local temp file
  return cloudinaryUrl;
}
