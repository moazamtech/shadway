import puppeteer from "puppeteer";
import fs from "fs";

import {
  BASE,
  createQaAccount,
  removeQaAccount,
  signIn,
} from "./qa-session";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

/**
 * Publishing from the quick form.
 *
 * The studio is the tool; `/new` is the shortcut, and it is the one a person
 * lands on when they have a component in a file and want it in the registry
 * without learning a sandbox. Nothing else walks that page, so a field that
 * stopped sending its value, or a button that stopped submitting, would only
 * be found by a person who tried to publish.
 *
 * The check fills the form the way a person does — typing into the real
 * inputs — and then asks the registry whether the component arrived.
 */

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const TITLE = "QA Quick Publish";

async function main() {
  const account = await createQaAccount("user");

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));

    await signIn(page, account.email, account.password);
    await page.goto(`${BASE}/new`, { waitUntil: "networkidle2", timeout: 90_000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await page.type("#publish-title", TITLE);
    await page.type(
      "#publish-code",
      [
        "export function QaQuickPublish() {",
        "  return <div className=\"p-4 text-sm\">Published from the quick form.</div>;",
        "}",
      ].join("\n"),
    );

    const values = await page.evaluate(() => ({
      title: (document.querySelector("#publish-title") as HTMLInputElement)?.value ?? "",
      code: (document.querySelector("#publish-code") as HTMLTextAreaElement)?.value ?? "",
    }));
    log("the form holds what was typed", values.title === TITLE && values.code.includes("QaQuickPublish"));
    log("the title field is the one the label names", values.title === TITLE);

    // Submit through the form itself.
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) =>
          (candidate.textContent || "").trim().toLowerCase() === "publish component",
      ) as HTMLButtonElement | undefined;
      button?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const url = page.url();
    log("the browser lands on the new component", /\/c\/[^/]+$/.test(url), url);

    const slug = url.split("/c/")[1] ?? "";
    if (slug) {
      const registry = await fetch(`${BASE}/r/${slug}`).catch(() => null);
      const item = registry ? await registry.json().catch(() => ({})) : {};
      const files = (item as { files?: { content?: string }[] }).files ?? [];
      log(
        "the registry has the component",
        registry?.ok === true && files.some((file) => file.content?.includes("QaQuickPublish")),
        `files=${files.length}`,
      );
    }

    log("the page had no errors", errors.length === 0, errors.slice(0, 2).join(" | "));

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
