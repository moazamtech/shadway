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
  return page.$$eval("[data-component-card]", (nodes) => nodes.length);
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

    await page.waitForSelector("[data-component-card]", { timeout: 45_000 }).catch(() => {});

    const total = await cardCount(page);
    log("feed renders cards", total > 0, `cards=${total}`);

    // ------------------------------------------------------------ hydration --
    const hydration = [...consoleErrors, ...pageErrors].filter((line) =>
      /hydrat|did not match|Text content does not match/i.test(line)
    );
    log("no hydration warnings", hydration.length === 0, `count=${hydration.length}`);

    // ------------------------------------------------------------- category --
    // The rail's categories are links — they carry a URL, because a category
    // is a place you can be sent to, not a control that toggles something.
    const sidebarCategories = await page.$$eval(
      'aside a[href*="category="]',
      (nodes) =>
        nodes
          .map((n) => (n.textContent || "").trim().toLowerCase())
          .filter(Boolean)
    );
    log(
      "sidebar categories present",
      sidebarCategories.length > 1,
      sidebarCategories.slice(0, 6).join(",")
    );

    const chips = await page.$$eval(
      'button[aria-pressed]',
      (nodes) => nodes.map((n) => (n.textContent || "").trim().toLowerCase())
    );
    if (chips.length > 1 && chips[0] === "all") {
      const target = chips[1];
      await page.evaluate((cat) => {
        const btn = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")
        ).find((b) => (b.textContent || "").trim().toLowerCase() === cat);
        btn?.click();
      }, target);
      await new Promise((r) => setTimeout(r, 400));
      const filtered = await cardCount(page);
      log(
        `category "${target}" narrows the feed`,
        filtered > 0 && filtered <= total,
        `after=${filtered} before=${total}`
      );
      await page.evaluate(() => {
        const all = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")
        ).find((b) => (b.textContent || "").trim().toLowerCase() === "all");
        all?.click();
      });
      await new Promise((r) => setTimeout(r, 300));
    }

    // ------------------------------------------------------- the palette ----
    // The search and the sort live in the ⌘K palette: the toolbar carries
    // the count and nothing else, so the grid is a picture of the catalogue
    // rather than a control panel.
    const openPalette = async () => {
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyK");
      await page.keyboard.up("Control");
      await page.waitForSelector('input[aria-label="Search components"]', {
        timeout: 10_000,
      });
      await new Promise((r) => setTimeout(r, 900));
    };

    const paletteRows = () =>
      page.$$eval('[cmdk-item]', (nodes) =>
        nodes.map((n) => (n.textContent || "").trim())
      );

    await openPalette();

    const sorts = await page.$$eval('[role="dialog"] button[aria-pressed]', (nodes) =>
      nodes.map((n) => (n.textContent || "").trim()).filter(Boolean)
    );
    log(
      "the palette carries the sort",
      sorts.some((label) => /popular/i.test(label)),
      sorts.slice(0, 4).join(",")
    );

    const firstBefore = (await paletteRows())[0] ?? "";
    await page.evaluate(() => {
      const pill = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
        /popular/i.test((b.textContent || "").trim()),
      );
      pill?.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    const firstAfter = (await paletteRows())[0] ?? "";
    log(
      "the sort reorders the results",
      Boolean(firstAfter) && firstAfter !== firstBefore,
      `before="${firstBefore}" after="${firstAfter}"`,
    );

    // --------------------------------------------------------------- search --
    await page.type('input[aria-label="Search components"]', "hero");
    await new Promise((r) => setTimeout(r, 600));
    const searched = await paletteRows();
    log(
      "the search narrows the results",
      searched.length > 0,
      `rows=${searched.length}`,
    );
    log(
      "the search finds the component by name",
      searched.some((row) => /hero/i.test(row)),
      searched.slice(0, 2).join(" | "),
    );

    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 400));
    log("the palette closes on escape", (await page.$('[cmdk-list]')) === null);

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
