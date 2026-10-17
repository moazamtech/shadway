import puppeteer, { type Browser } from "puppeteer";
import fs from "fs";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

export function resolveChromePath(): string | undefined {
  return CHROME_CANDIDATES.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });
}

export type CaptureResult = {
  buffer: Buffer;
  width: number;
  height: number;
  contentWidth?: number;
} | null;

/**
 * Renders a built component document once and captures it as a cover image.
 *
 * This is what makes the marketplace feed fast: cards use a static image
 * instead of booting a bundler per visitor.
 */
export async function capturePreview(
  previewHtml: string,
  options: { width?: number; height?: number } = {}
): Promise<CaptureResult> {
  const executablePath = resolveChromePath();
  if (!executablePath) return null;

  const maxWidth = options.width ?? 1200;
  const maxHeight = options.height ?? 900;

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: maxWidth, height: maxHeight, deviceScaleFactor: 1 });

    const htmlUrl = `data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`;
    await page.goto(htmlUrl, { waitUntil: "networkidle2", timeout: 45000 });

    // Force dark mode so covers match the dark-themed feed.
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    });

    // The document is self-contained, but React still needs a paint.
    await new Promise((resolve) => setTimeout(resolve, 900));

    const hasContent = await page
      .evaluate(() => {
        const root = document.getElementById("root");
        return Boolean(root && root.childElementCount > 0);
      })
      .catch(() => false);

    if (!hasContent) return null;

    // Measure the real content box so the cover is tightly cropped instead of
    // showing a mostly-empty canvas.
    const clip = await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) return null;

      const rects = Array.from(root.querySelectorAll<HTMLElement>("*"))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 1 && r.height > 1);

      const rootRect = root.getBoundingClientRect();
      const all = [rootRect, ...rects];
      const left = Math.min(...all.map((r) => r.left));
      const top = Math.min(...all.map((r) => r.top));
      const right = Math.max(...all.map((r) => r.right));
      const bottom = Math.max(...all.map((r) => r.bottom));

      const pad = 24;
      const x = Math.max(0, Math.floor(left - pad));
      const y = Math.max(0, Math.floor(top - pad));
      const width = Math.min(
        window.innerWidth - x,
        Math.max(160, Math.ceil(right - left + pad * 2))
      );
      const height = Math.min(
        window.innerHeight - y,
        Math.max(120, Math.ceil(bottom - top + pad * 2))
      );

      return { x, y, width, height };
    });

    const screenshot = await page.screenshot({
      // A cover is a card image, not a print proof. PNG of a rendered page is
      // the worst case for both size and usefulness — a flat UI screenshot
      // compresses to a fraction of it as WebP at a quality nobody can see.
      type: "webp",
      quality: 84,
      fullPage: false,
      ...(clip ? { clip } : {}),
    });

    const buffer = Buffer.from(screenshot);
    const meta = await page.evaluate(() => ({
      w: document.getElementById("root")?.getBoundingClientRect().width ?? 0,
    }));

    return { buffer, width: clip?.width ?? maxWidth, height: clip?.height ?? maxHeight, contentWidth: meta.w };
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
