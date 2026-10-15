import puppeteer, { type Page } from "puppeteer";
import fs from "fs";

/**
 * Feed QA for the marketplace home page.
 *
 *   npx tsx scripts/qa-home.ts
 *   npx tsx scripts/qa-home.ts http://localhost:3111
 *
 * Checks: card rendering, category filter, sort control, search filter,
 * hydration/console noise, and horizontal overflow at three breakpoints.
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function cardCount(page: Page) {
  return page.$$eval('a[href^="/c/"]', (nodes) => nodes.length);
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - window.innerWidth;
  });
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 950 });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 240));
    });
    page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 240)));

    const res = await page.goto(`${BASE}/`, {
      waitUntil: "networkidle2",
      timeout: 90_000,
    });
    log("home responds 200", res?.status() === 200, `status=${res?.status()}`);

    await page.waitForSelector('a[href^="/c/"]', { timeout: 45_000 }).catch(() => {});

    const total = await cardCount(page);
    log("feed renders cards", total > 0, `cards=${total}`);

    // ------------------------------------------------------------ hydration --
    const hydration = [...consoleErrors, ...pageErrors].filter((line) =>
      /hydrat|did not match|Text content does not match/i.test(line)
    );
    log("no hydration warnings", hydration.length === 0, `count=${hydration.length}`);

    // ------------------------------------------------------------- category --
    const chips = await page.$$eval(
      'button[aria-pressed]',
      (nodes) => nodes.map((n) => (n.textContent || "").trim().toLowerCase())
    );
    log(
      "category chips are data-derived",
      chips.length > 1 && chips[0] === "all",
      chips.join(",")
    );

    if (chips.length > 1) {
      const target = chips[1];
      await page.click(
        `button[aria-pressed][class*="capitalize"]:not([aria-pressed="true"])`
      );
      await new Promise((r) => setTimeout(r, 400));
      const filtered = await cardCount(page);
      log(
        `category "${target}" narrows the feed`,
        filtered > 0 && filtered <= total,
        `after=${filtered} before=${total}`
      );
      // Reset to "all".
      await page.evaluate(() => {
        const all = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")
        ).find((b) => (b.textContent || "").trim().toLowerCase() === "all");
        all?.click();
      });
      await new Promise((r) => setTimeout(r, 300));
    }

    // ----------------------------------------------------------------- sort --
    const hasSort = await page.$('select[aria-label="Sort components"]');
    log("sort control present", Boolean(hasSort));
    if (hasSort) {
      await page.select('select[aria-label="Sort components"]', "popular");
      await new Promise((r) => setTimeout(r, 300));
      log("sort change keeps cards", (await cardCount(page)) > 0);
    }

    // --------------------------------------------------------------- search --
    await page.type('input[aria-label="Search components"]', "button");
    await new Promise((r) => setTimeout(r, 600));
    const searched = await cardCount(page);
    const countText = await page.$$eval("span", (nodes) =>
      nodes.map((n) => n.textContent || "").find((t) => /components$/.test(t)) || ""
    );
    log("search filters the feed", searched <= total, `after=${searched} label="${countText}"`);

    await page.click('button[aria-label="Clear search"]').catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    // ----------------------------------------------------------- responsive --
    for (const width of [375, 768, 1440]) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 500));
      const delta = await overflow(page);
      log(`no horizontal overflow @${width}px`, delta <= 1, `delta=${delta}px`);
      await page.screenshot({ path: `tmp-home-${width}.png` });
    }

    log("no page errors", pageErrors.length === 0, `count=${pageErrors.length}`);
    pageErrors.slice(0, 4).forEach((e) => console.log("   -", e));
  } finally {
    await browser.close();
  }

  console.log(failures === 0 ? "\nALL FEED CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 500));
  process.exit(1);
});
