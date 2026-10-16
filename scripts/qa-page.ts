import puppeteer from "puppeteer";
import fs from "fs";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

async function main() {
  const url = process.argv[2];
  const shot = process.argv[3] || "tmp-qa.png";
  const needle = process.argv[4] || "";

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });

  const errors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("requestfailed", (r) =>
    failed.push(`${r.url().slice(0, 80)} ${r.failure()?.errorText || ""}`)
  );

  const res = await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  console.log("STATUS:", res?.status());

  // Give the preview pipeline time to transpile + render.
  await new Promise((r) => setTimeout(r, 9000));

  const frameInfo: string[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const text = await frame
      .evaluate(() => document.body?.innerText?.trim().slice(0, 200) || "")
      .catch(() => "<unreadable>");
    frameInfo.push(`  [${frame.url().slice(0, 40)}] ${JSON.stringify(text)}`);
  }
  console.log("PREVIEW FRAMES:", frameInfo.length);
  frameInfo.forEach((f) => console.log(f));

  if (needle) {
    const found = await page
      .evaluate(
        (text) => document.body.innerText.includes(text),
        needle
      )
      .catch(() => false);
    console.log(`TEXT "${needle}": ${found}`);
  }

  console.log("PAGE ERRORS:", errors.length);
  errors.slice(0, 5).forEach((e) => console.log("  -", e));
  console.log("FAILED REQUESTS:", failed.length);
  failed.slice(0, 6).forEach((f) => console.log("  -", f));

  await page.screenshot({ path: shot });
  console.log("SHOT:", shot);
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", String(e).slice(0, 400));
  process.exit(1);
});