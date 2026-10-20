import puppeteer from "puppeteer";
import fs from "fs";

import {
  BASE,
  createQaAccount,
  frameText,
  removeQaAccount,
  signIn,
} from "./qa-session";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

/**
 * The live edit.
 *
 * The studio is the one place in the product where a keystroke has to travel
 * from the editor, through the sandbox, into a browser tab and back onto the
 * screen. Every layer of that can break on its own, and none of them fails
 * loudly: the editor keeps the text, the preview keeps the old render, and
 * the only symptom is a preview that stopped agreeing with the file.
 *
 * So this types into the editor and waits for the preview to say the new
 * thing. The component is published first, so the editor opens on a file the
 * signed-in account owns.
 */

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const account = await createQaAccount("admin");

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });

    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text().slice(0, 160));
    });
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));

    // A component of their own, so the editor opens on a file they may edit.
    await signIn(page, account.email, account.password);
    const published = await page.evaluate(async () => {
      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "QA Live Edit",
          description: "A fixture for the live-edit check.",
          code: [
            "export function QaLiveEdit() {",
            "  return <h1>LIVE-EDIT-START</h1>;",
            "}",
          ].join("\n"),
          category: "ui",
          tags: ["button", "qa"],
        }),
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, slug: data?.item?.slug ?? null };
    });
    log(
      "the fixture component is published",
      published.status === 201 && Boolean(published.slug),
      `slug=${published.slug}`,
    );

    if (!published.slug) {
      await browser.close();
      return;
    }

    await page.goto(`${BASE}/studio/${published.slug}`, {
      waitUntil: "networkidle2",
      timeout: 90_000,
    });
    await new Promise((resolve) => setTimeout(resolve, 9000));

    const editorReady = await page.evaluate(() =>
      Boolean(document.querySelector(".monaco-editor")),
    );
    log("the editor loads", editorReady);

    // Type with real keyboard events so the editor's own change handling runs.
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.type(
      'export function QaLiveEdit() { return <h1>LIVE-EDIT-OK</h1>; }',
    );

    const editorValue = await page
      .$eval("textarea", (element) => (element as HTMLTextAreaElement).value)
      .catch(() => "");
    log(
      "the editor holds what was typed",
      editorValue.includes("LIVE-EDIT-OK"),
      editorValue.slice(0, 60),
    );

    let painted = false;
    for (const wait of [2500, 3500, 5000]) {
      await new Promise((resolve) => setTimeout(resolve, wait));
      const texts = await frameText(page);
      if (texts.includes("LIVE-EDIT-OK")) {
        painted = true;
        break;
      }
    }
    log("the preview repaints with the edit", painted);

    log("the page had no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));

    await page.screenshot({ path: "tmp-liveedit.png" });
    await browser.close();
  } finally {
    await removeQaAccount(account.email);
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 300));
  process.exit(1);
});
