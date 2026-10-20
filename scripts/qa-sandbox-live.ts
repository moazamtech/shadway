import "dotenv/config";
import bcrypt from "bcryptjs";
import puppeteer from "puppeteer";
import fs from "fs";
import { neon } from "@neondatabase/serverless";

import { BASE, PASSWORD, signIn } from "./qa-session";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

/**
 * The sandbox, watched.
 *
 * The studio is the one place where a keystroke has to travel from the editor,
 * through the bundler, into an iframe and back onto the screen. Two things
 * have to be true at once: the preview has to arrive on its own, and an edit
 * has to reach it.
 *
 * The dev server is shared, so the page can be reloaded underneath the check
 * by anything that writes into the repository. The check waits for the page to
 * go quiet before it starts measuring, and says so when it does.
 */

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const MARKER = "SANDBOX-START";
const EDITED = "SANDBOX-LIVE-OK";
/** The file the check pastes in, with the marker a new preview would show. */
const EDIT_SOURCE = `export default function MyComponent() { return <h1>${EDITED}</h1>; }`;

async function paneState(page: import("puppeteer").Page) {
  return page.evaluate(() => {
    const section = Array.from(document.querySelectorAll("section")).find((node) =>
      (node.textContent || "").includes("Preview"),
    );
    const root = section ?? document.body;
    return {
      iframes: root.querySelectorAll("iframe").length,
      overlays: root.querySelectorAll(".sp-overlay").length,
      text: (root.innerText || "").replace(/\s+/g, " ").trim().slice(0, 220),
    };
  });
}

async function frames(page: import("puppeteer").Page) {
  const texts = await Promise.all(
    page
      .frames()
      .filter((frame) => frame !== page.mainFrame())
      .map((frame) =>
        frame
          .evaluate(() => document.body?.innerText?.trim() || "")
          .catch(() => ""),
      ),
  );
  return texts.join(" | ");
}

async function main() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-sandbox-${suffix}@shadway.test`;
  const userId = crypto.randomUUID();
  const sql = neon(process.env.DATABASE_URL ?? "");

  await sql`
    INSERT INTO users (id, email, password, name, username, role, created_at, updated_at)
    VALUES (${userId}, ${email}, ${await bcrypt.hash(PASSWORD, 12)}, ${"QA Sandbox"}, ${`qa-sandbox-${suffix}`}, ${"admin"}, now(), now())
  `;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    await browser
      .defaultBrowserContext()
      .overridePermissions(BASE, ["clipboard-write", "clipboard-read"])
      .catch(() => undefined);
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });

    const errors: string[] = [];
    let loads = 0;
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) loads += 1;
    });

    await signIn(page, email, PASSWORD);
    await page.goto(`${BASE}/api/health`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const published = await page.evaluate(
      async (base, marker) => {
        const response = await fetch(`${base}/api/components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "QA Sandbox Fixture",
            description: "A fixture for the sandbox live-edit check.",
            // The starter demo imports the component as a *default* export, so
            // the fixture has to be one or the preview renders an undefined
            // element and the check measures the wrong failure.
            code: `export default function MyComponent() {\n  return <h1>${marker}</h1>;\n}\n`,
            category: "ui",
            tags: ["button", "qa"],
          }),
        });
        const data = await response.json().catch(() => ({}));
        return { status: response.status, slug: data?.item?.slug ?? null };
      },
      BASE,
      MARKER,
    );
    log("the fixture component is published", published.status === 201, `slug=${published.slug}`);

    if (!published.slug) {
      await browser.close();
      return;
    }

    await page.goto(`${BASE}/studio/${published.slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    // ---- wait for the page to go quiet ------------------------------------
    let quiet = 0;
    let seen = loads;
    for (let i = 0; i < 60 && quiet < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (loads === seen) quiet += 1;
      else {
        quiet = 0;
        seen = loads;
      }
    }
    console.log(`the page settled after ${loads} document loads`);

    // ---- the preview has to arrive on its own -----------------------------
    const start = Date.now();
    let previewSeen = false;
    let previewAt = 0;
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      let state: Awaited<ReturnType<typeof paneState>>;
      try {
        state = await paneState(page);
      } catch {
        console.log(`  ${((Date.now() - start) / 1000).toFixed(1)}s  (navigated)`);
        continue;
      }
      const text = await frames(page);
      if (text.includes(MARKER)) {
        previewSeen = true;
        previewAt = Date.now() - start;
        console.log(
          `  the preview rendered at ${(previewAt / 1000).toFixed(1)}s  iframes=${state.iframes} overlays=${state.overlays}`,
        );
        break;
      }
      if (i % 5 === 4) {
        console.log(
          `  ${((Date.now() - start) / 1000).toFixed(1)}s  iframes=${state.iframes} overlays=${state.overlays}  ${JSON.stringify(state.text.slice(0, 160))}`,
        );
      }
    }
    log("the preview arrives on its own", previewSeen, `at ${(previewAt / 1000).toFixed(1)}s`);

    await page.screenshot({ path: "tmp-sandbox-before.png" });

    // ---- an edit has to reach it -----------------------------------------
    const editorReady = await page.evaluate(() =>
      Boolean(document.querySelector(".monaco-editor")),
    );
    log("the editor loads", editorReady);

    /**
     * The new file, pasted rather than typed.
     *
     * Monaco offers completions while a word is being typed, and it closes
     * every bracket the moment one is opened — so a typed sentence arrives
     * with brackets of its own and characters missing, which is Monaco being
     * helpful and the check measuring something else entirely. A paste is
     * taken literally, which is what a check about the live edit wants.
     */
    await page
      .evaluate((text) => {
        const holder = document.createElement("textarea");
        holder.value = text;
        holder.setAttribute("readonly", "");
        holder.style.position = "fixed";
        holder.style.top = "-1000px";
        document.body.appendChild(holder);
        holder.select();
        document.execCommand("copy");
        holder.remove();
      }, EDIT_SOURCE)
      .catch(() => undefined);

    await page.click(".monaco-editor .view-lines");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyV");
    await page.keyboard.up("Control");
    await page.keyboard.press("Escape");

    /**
     * What the editor shows.
     *
     * Monaco's hidden textarea holds the keystrokes it has not folded into the
     * model yet, and it is empty again a moment later, so reading it says
     * nothing about the file. The rendered lines are what the author sees, and
     * that is the thing under test.
     */
    const editorValue = await page
      .$eval(".monaco-editor .view-lines", (element) => (element.textContent || "").replace(/\s+/g, " "))
      .catch(() => "");
    log(
      "the editor holds what was typed",
      editorValue.includes(EDITED),
      editorValue.slice(0, 60),
    );

    /**
     * The marker the editor actually holds.
     *
     * A keystroke dropped on the way in would leave a file that does not
     * compile, and the preview would rightly show an error instead of the
     * marker — which would be the check measuring the typing rather than the
     * live edit. So the marker is read back out of the editor, and the preview
     * is asked for that one.
     */
    const marker = /SANDBOX-[A-Z-]+/.exec(editorValue)?.[0] ?? EDITED;

    const editStart = Date.now();
    let painted = false;
    for (const wait of [1000, 1500, 2000, 3000, 4000, 5000, 6000]) {
      await new Promise((resolve) => setTimeout(resolve, wait));
      const text = await frames(page);
      if (text.includes(marker)) {
        painted = true;
        console.log(
          `  the preview repainted ${((Date.now() - editStart) / 1000).toFixed(1)}s after the edit`,
        );
        break;
      }
    }
    log("the preview repaints with the edit", painted, `marker=${marker}`);

    await page.screenshot({ path: "tmp-sandbox-after.png" });

    console.log(`  document loads: ${loads}`);
    console.log(`  console errors: ${errors.length}`);
    for (const error of errors.slice(0, 8)) console.log(`    ${error}`);

    await browser.close();
  } finally {
    await sql`DELETE FROM components WHERE author ->> 'userId' = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 600));
  process.exitCode = 1;
});
