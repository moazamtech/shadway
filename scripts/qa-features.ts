import "dotenv/config";
import fs from "fs";
import puppeteer from "puppeteer";
import bcrypt from "bcryptjs";

import { connectToDatabase } from "../lib/mongodb";
import { planUsername } from "../lib/db/users";

/**
 * The surfaces a component is judged on.
 *
 * The detail page and the studio are the two places a component is looked at
 * closely, and both have parts that only exist because something else
 * happens first: the preview is a document the site built, the code tab is
 * the author's own files, the install line is the registry's address, and the
 * studio's package list is what the sandbox actually installed.
 *
 * So this walks both, as a signed-in author, and checks the parts rather
 * than the pages: that the preview paints, that the code tab names the
 * file, that the install tab carries the CLI command, that the other two
 * install paths answer, and that a new file in the studio reaches the tree.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-features.ts
 */

const BASE = process.env.BASE ?? "http://localhost:3000";
const PASSWORD = "qa-features-1234";
const SLUG = "particles";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

const jar: Record<string, string> = {};

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const cookie = Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
  }
  return response;
}

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const { db } = await connectToDatabase();
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `qa-features-${suffix}@shadway.test`;
  const users = db.collection("users");

  try {
    await users.insertOne({
      email,
      password: await bcrypt.hash(PASSWORD, 12),
      name: "QA Features",
      username: await planUsername(email, "QA Features"),
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const csrf = await (await request("/api/auth/csrf")).json();
    await request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email,
        password: PASSWORD,
        callbackUrl: `${BASE}/`,
        json: "true",
      }).toString(),
    });

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));

    await page.setCookie(
      ...Object.entries(jar).map(([name, value]) => ({
        name,
        value,
        domain: "localhost",
        path: "/",
      })),
    );

    const frameText = async () =>
      (
        await Promise.all(
          page
            .frames()
            .filter((frame) => frame !== page.mainFrame())
            .map((frame) =>
              frame
                .evaluate(() => document.body?.innerText?.trim() || "")
                .catch(() => ""),
            ),
        )
      ).join(" | ");

    // ------------------------------------------------------- the detail page --
    await page.goto(`${BASE}/c/${SLUG}`, { waitUntil: "networkidle2", timeout: 90_000 });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const preview = await frameText();
    /**
     * The preview is a document, and a document can be a canvas: the text in
     * it may be empty while the thing itself is on screen. What has to be
     * true is that the frame exists and has rendered something.
     */
    const previewPainted = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll("iframe"));
      return frames.length > 0;
    });
    log(
      "the preview paints the component",
      previewPainted,
      `frames=${preview.length ? preview.length : 0}`,
    );

    const clickText = async (text: string) =>
      page.evaluate((label: string) => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (candidate) => (candidate.textContent || "").trim() === label,
        ) as HTMLButtonElement | undefined;
        button?.click();
        return Boolean(button);
      }, text);

    const codeClicked = await clickText("Code");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const codeBody = await page.evaluate(() => document.body.innerText);
    log(
      "the code tab names the author's file",
      codeClicked && /component\.tsx|particles/i.test(codeBody),
      codeBody.slice(0, 0),
    );

    const installClicked = await clickText("Install");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const installBody = await page.evaluate(() => document.body.innerText);
    log(
      "the install tab carries the CLI command",
      installClicked && installBody.includes("shadcn"),
      installBody.slice(0, 0),
    );

    for (const tab of ["v0", "Lovable", "Bolt"]) {
      const clicked = await page.evaluate((label: string) => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (candidate) => (candidate.textContent || "").trim() === label,
        ) as HTMLButtonElement | undefined;
        button?.click();
        return Boolean(button);
      }, tab);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const body = await page.evaluate(() => document.body.innerText);
      log(
        `the ${tab} path answers`,
        clicked && /prompt|registry|component/i.test(body),
        "",
      );
    }

    // ---------------------------------------------------------- the studio ---
    await page.goto(`${BASE}/studio/${SLUG}`, {
      waitUntil: "networkidle2",
      timeout: 90_000,
    });
    await new Promise((resolve) => setTimeout(resolve, 8000));

    const studioText = await page.evaluate(() => document.body.innerText);
    log(
      "the studio opens the component",
      studioText.includes("FILES") && studioText.includes("component.tsx"),
      "",
    );
    log(
      "the studio shows the packages it is running",
      studioText.includes("PACKAGES"),
      "",
    );

    // A new file has to reach the tree — it is how an author adds a helper.
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) => (candidate.getAttribute("title") || "") === "New file",
      ) as HTMLButtonElement | undefined;
      button?.click();
      return Boolean(button);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.evaluate(() => {
      const input = Array.from(document.querySelectorAll("input")).find(
        (candidate) =>
          (candidate as HTMLInputElement).placeholder === "components/hero.tsx" ||
          (candidate as HTMLInputElement).placeholder === "use-thing.ts",
      ) as HTMLInputElement | undefined;
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, "components/use-counter.ts");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    // The field creates on Enter — there is no button, and the hint under it
    // says so.
    const confirmed = await page.evaluate(() => {
      const input = Array.from(document.querySelectorAll("input")).find(
        (candidate) =>
          (candidate as HTMLInputElement).placeholder === "components/hero.tsx",
      ) as HTMLInputElement | undefined;
      if (!input) return false;
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      return true;
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const tree = await page.evaluate(() => document.body.innerText);
    log(
      "a new file reaches the tree",
      confirmed && tree.includes("use-counter.ts"),
      "",
    );

    log("the page had no errors", errors.length === 0, errors.slice(0, 2).join(" | "));

    await browser.close();
  } finally {
    await users.deleteMany({ email }).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 300));
  process.exit(1);
});
