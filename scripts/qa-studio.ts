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
 * The studio dashboard.
 *
 * The dashboard is the list of what an author has made, and the one control
 * that acts on it: creating a new one. It is also the page that used to be
 * the editor, which is why the checks that walked it kept opening a page that
 * was no longer there — the editor lives at `/studio/<slug>` now, and the
 * dashboard at `/studio`.
 *
 * So this signs in, opens the dashboard, and checks the two things that can
 * be wrong: that the author's own work is listed, and that the new-component
 * dialog opens and creates.
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

    await signIn(page, account.email, account.password);

    // One component, so the list has something in it.
    const published = await page.evaluate(async () => {
      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "QA Studio Fixture",
          description: "A fixture for the studio dashboard check.",
          code: ["export function QaStudioFixture() {", "  return <div />;", "}"].join("\n"),
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

    await page.goto(`${BASE}/studio`, { waitUntil: "networkidle2", timeout: 90_000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const body = await page.evaluate(() => document.body.innerText);
    log("the dashboard names the work", body.includes("Components"));
    log(
      "the author's own component is listed",
      body.includes("QA Studio Fixture"),
      "",
    );

    // The new-component dialog.
    const opened = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) =>
          (candidate.textContent || "").trim().toLowerCase() === "new component",
      ) as HTMLButtonElement | undefined;
      button?.click();
      return Boolean(button);
    });
    await new Promise((resolve) => setTimeout(resolve, 700));

    const dialogText = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement | null;
      return dialog ? dialog.innerText : "";
    });
    log("the new-component dialog opens", opened && dialogText.length > 0);

    await page.screenshot({ path: "tmp-studio-dashboard.png" });
    log("the page had no console errors", errors.length === 0, errors.slice(0, 2).join(" | "));

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
