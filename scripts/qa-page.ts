import puppeteer from "puppeteer";
import fs from "fs";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

const BASE = process.env.BASE ?? "http://localhost:3000";

async function main() {
  // The page to open, the file to write, and a string the page must contain.
  // With no arguments the script looks at the site itself, so running it bare
  // reports the state of the front page instead of failing on an undefined
  // address.
  const url = process.argv[2] ?? `${BASE}/`;
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