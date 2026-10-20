import "dotenv/config";
import bcrypt from "bcryptjs";
import puppeteer from "puppeteer";
import fs from "fs";

import { connectToDatabase } from "../lib/mongodb";
import { createAccount, deleteAccount } from "../lib/db/users";
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
 * has to reach it. This opens the studio, watches the preview pane until it
 * says something, then types into the editor and watches the pane again.
 */

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

function stamp(start: number) {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

/** What the preview pane is showing right now. */
async function paneState(page: import("puppeteer").Page) {
  return page.evaluate(() => {
    const section = Array.from(document.querySelectorAll("section")).find((node) =>
      (node.textContent || "").includes("Preview"),
    );
    const root = section ?? document.body;
    const iframes = Array.from(root.querySelectorAll("iframe"));
    const spinners = Array.from(root.querySelectorAll("svg")).filter((node) =>
      (node.className.baseVal || "").includes("lucide-loader"),
    );
    return {
      iframes: iframes.length,
      spinner: spinners.length,
      text: (root.innerText || "").replace(/\s+/g, " ").trim().slice(0, 240),
    };
  });
}

/** The text inside every frame on the page. */
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
  const password = PASSWORD;

  const account = await createAccount({
    email,
    password: await bcrypt.hash(password, 12),
    name: "QA Sandbox",
    role: "admin",
  });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });

    const errors: string[] = [];
    const logs: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error") errors.push(text.slice(0, 200));
      else logs.push(`${message.type()}: ${text.slice(0, 200)}`);
    });
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));

    await signIn(page, email, password);
    await page.goto(`${BASE}/api/health`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const published = await page.evaluate(async (base) => {
      const response = await fetch(`${base}/api/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "QA Sandbox Live",
          description: "A fixture for the sandbox live-edit check.",
          code: [
            "export function QaSandboxLive() {",
            "  return <h1>SANDBOX-START</h1>;",
            "}",
          ].join("\n"),
          category: "ui",
          tags: ["qa"],
        }),
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, slug: data?.item?.slug ?? null };
    }, BASE);
    log("the fixture component is published", published.status === 201, `slug=${published.slug}`);

    if (!published.slug) {
      await browser.close();
      return;
    }

    const start = Date.now();
    await page.goto(`${BASE}/studio/${published.slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    console.log(`  navigated at ${stamp(start)}  url=${page.url()}`);

    // ---- the preview has to arrive on its own -----------------------------
    let previewSeen = false;
    let previewAt = 0;
    let firstSpinner = 0;
    for (let i = 0; i < 90; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      let state: Awaited<ReturnType<typeof paneState>>;
      try {
        state = await paneState(page);
      } catch (error) {
        console.log(
          `  ${stamp(start)}  (the page navigated: ${String(error).slice(0, 80)})`,
        );
        continue;
      }
      const text = await frames(page);
      if (!firstSpinner && state.spinner > 0) firstSpinner = Date.now() - start;
      if (text.includes("SANDBOX-START")) {
        previewSeen = true;
        previewAt = Date.now() - start;
        console.log(`  the preview rendered at ${stamp(start)} (${(previewAt / 1000).toFixed(1)}s)`);
        console.log(`  pane state: ${JSON.stringify(state)}`);
        break;
      }
      if (i % 5 === 4) {
        console.log(
          `  ${stamp(start)}  iframes=${state.iframes} spinner=${state.spinner} text=${JSON.stringify(state.text.slice(0, 120))}`,
        );
      }
    }
    log("the preview arrives on its own", previewSeen, `at ${(previewAt / 1000).toFixed(1)}s`);
    if (firstSpinner) console.log(`  the loading spinner was up from ${(firstSpinner / 1000).toFixed(1)}s`);

    await page.screenshot({ path: "tmp-sandbox-before.png" });

    // ---- an edit has to reach it -----------------------------------------
    const editorReady = await page.evaluate(() =>
      Boolean(document.querySelector(".monaco-editor")),
    );
    log("the editor loads", editorReady);

    await page.click(".monaco-editor .view-lines");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.type(
      "export function QaSandboxLive() { return <h1>SANDBOX-LIVE-OK</h1>; }",
    );

    const editorValue = await page
      .$eval("textarea", (element) => (element as HTMLTextAreaElement).value)
      .catch(() => "");
    log(
      "the editor holds what was typed",
      editorValue.includes("SANDBOX-LIVE-OK"),
      editorValue.slice(0, 60),
    );

    const editStart = Date.now();
    let painted = false;
    for (const wait of [1000, 1500, 2000, 3000, 4000, 5000, 6000]) {
      await new Promise((resolve) => setTimeout(resolve, wait));
      const text = await frames(page);
      if (text.includes("SANDBOX-LIVE-OK")) {
        painted = true;
        console.log(
          `  the preview repainted ${((Date.now() - editStart) / 1000).toFixed(1)}s after the edit`,
        );
        break;
      }
    }
    log("the preview repaints with the edit", painted);

    await page.screenshot({ path: "tmp-sandbox-after.png" });

    console.log(`  console errors: ${errors.length}`);
    for (const error of errors.slice(0, 6)) console.log(`    ${error}`);
    console.log(`  console logs: ${logs.length}`);
    for (const entry of logs.slice(0, 10)) console.log(`    ${entry}`);

    await browser.close();
  } finally {
    const { db } = await connectToDatabase();
    await db
      .collection("components")
      .deleteMany({ "author.email": email } as Record<string, unknown>);
    await deleteAccount(account._id ?? account.email);
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 600));
  process.exit(1);
});
