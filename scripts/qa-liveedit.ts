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
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });

  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE_ERR:", m.text().slice(0, 160));
  });

  await page.goto("http://localhost:3000/studio", { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 7000));

  // Type with real keyboard events so React onChange fires naturally.
  await page.click("textarea");
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.type("export default function Live() { return <h1>LIVE-EDIT-OK</h1>; }");

  const editorValue = await page.$eval("textarea", (el) => (el as HTMLTextAreaElement).value);
  console.log("EDITOR_VALUE:", editorValue.slice(0, 80));

  for (const wait of [2000, 3000, 4000]) {
    await new Promise((r) => setTimeout(r, wait));
    const texts = await Promise.all(
      page
        .frames()
        .filter((f) => f !== page.mainFrame())
        .map((f) => f.evaluate(() => document.body?.innerText?.trim() || "").catch(() => "<err>"))
    );
    console.log(`AFTER ${wait}ms frames=${texts.length}:`, JSON.stringify(texts.map((t) => t.slice(0, 60))));
    if (texts.some((t) => t.includes("LIVE-EDIT-OK"))) {
      console.log("LIVE_UPDATE_OK");
      break;
    }
  }

  await page.screenshot({ path: "tmp-liveedit.png" });
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", String(e).slice(0, 300));
  process.exit(1);
});