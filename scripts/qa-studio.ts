import puppeteer from "puppeteer";
import fs from "fs";

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });

  const errors: string[] = [];
  const warnings: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error") errors.push(t.slice(0, 200));
    if (/hydrat|<a>|cannot be a descendant/i.test(t)) {
      warnings.push(t.slice(0, 200));
    }
  });

  const frameText = async () =>
    (
      await Promise.all(
        page
          .frames()
          .filter((f) => f !== page.mainFrame())
          .map((f) => f.evaluate(() => document.body?.innerText?.trim() || "").catch(() => ""))
      )
    ).join(" | ");

  // ---------- Homepage: no hydration warnings ----------
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  const cards = await page.evaluate(
    () => document.querySelectorAll("article").length
  );
  console.log("HOME_CARDS:", cards);
  console.log("HOME_HYDRATION_WARNINGS:", warnings.length);
  warnings.slice(0, 3).forEach((w) => console.log("   !", w));
  await page.screenshot({ path: "tmp-home.png" });

  // ---------- Studio: editor + folders + preview ----------
  await page.goto("http://localhost:3000/studio", {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await new Promise((r) => setTimeout(r, 8000));

  const monacoReady = await page.evaluate(() => Boolean(document.querySelector(".monaco-editor")));
  console.log("MONACO_LOADED:", monacoReady);

  const folderCount = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).filter((b) =>
      b.textContent?.trim().startsWith("components")
    ).length
  );
  console.log("FOLDERS_RENDERED:", folderCount > 0);

  const previewOk = (await frameText()).includes("Your shadcn component");
  console.log("STUDIO_PREVIEW:", previewOk);

  // Collapse a folder and confirm it toggles
  const collapsed = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "src"
    ) as HTMLButtonElement | undefined;
    if (!btn) return false;
    const before = document.body.innerText;
    btn.click();
    return before !== document.body.innerText;
  });
  await new Promise((r) => setTimeout(r, 500));
  console.log("FOLDER_COLLAPSE:", collapsed);

  // Live edit through Monaco
  await page.click(".monaco-editor .view-lines");
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.type('export default function Live() { return <h1>MONACO-EDIT-OK</h1>; }');
  await new Promise((r) => setTimeout(r, 4500));
  console.log("LIVE_EDIT:", (await frameText()).includes("MONACO-EDIT-OK"));

  await page.screenshot({ path: "tmp-studio.png" });

  // ---------- Publish panel ----------
  const opened = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "Publish"
    ) as HTMLButtonElement | undefined;
    btn?.click();
    return Boolean(btn);
  });
  await new Promise((r) => setTimeout(r, 2500));
  const publishBody = await page.evaluate(() => document.body.innerText);
  console.log("PUBLISH_PANEL:", opened && /Describe your component/.test(publishBody));
  console.log(
    "PUBLISH_HAS_METADATA:",
    ["Title", "Description", "Tags", "Visibility"].every((f) => publishBody.includes(f))
  );
  await page.screenshot({ path: "tmp-publish-panel.png" });

  console.log("TOTAL_ERRORS:", errors.length);
  errors.slice(0, 5).forEach((e) => console.log("   x", e));

  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", String(e).slice(0, 300));
  process.exit(1);
});