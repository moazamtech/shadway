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
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

  await page.goto("http://localhost:3000/studio", { waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));

  // Confirm the sandbox preview rendered real content.
  const frames = page.frames().filter((f) => f !== page.mainFrame());
  let previewText = "";
  for (const f of frames) {
    previewText = await f.evaluate(() => document.body?.innerText?.trim() || "").catch(() => "");
  }
  console.log("PREVIEW:", JSON.stringify(previewText.slice(0, 80)));
  console.log("PREVIEW_RENDERED:", previewText.includes("Your shadcn component"));

  // Type a real component into the editor.
  const editorSelector = "textarea";
  await page.click(editorSelector);
  await page.evaluate(() => {
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    el.focus();
  });

  const componentCode = `import { Button } from "@/components/ui/button";

export default function StatusPill() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center bg-background p-10">
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium text-emerald-600">All systems operational</span>
      </div>
    </div>
  );
}
`;

  await page.evaluate((code) => {
    const el = document.querySelector("textarea") as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    setter?.call(el, code);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, componentCode);

  await new Promise((r) => setTimeout(r, 4000));

  const afterEdit = await page
    .frames()
    .filter((f) => f !== page.mainFrame())
    .map((f) => f.evaluate(() => document.body?.innerText?.trim() || "").catch(() => ""))
    .join(" ");
  console.log("LIVE_UPDATE:", afterEdit.includes("All systems operational"));

  // Fill publish metadata and publish.
  const setInput = async (placeholder: string, value: string) => {
    const handle = await page.evaluateHandle((ph: string) => {
      return Array.from(document.querySelectorAll("input")).find(
        (i) => (i as HTMLInputElement).placeholder === ph
      );
    }, placeholder);
    const el = handle.asElement() as import("puppeteer").ElementHandle<Element> | null;
    if (!el) return false;
    await el.click({ clickCount: 3 });
    await el.type(value);
    return true;
  };

  console.log("TITLE_SET:", await setInput("Animated gradient button", "Status Pill"));
  console.log("DESC_SET:", await setInput("A short description shown on the card and used by agents.", "A green status pill."));
  console.log("TAGS_SET:", await setInput("button, animation", "status, pill"));

  const publishClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "Publish"
    ) as HTMLButtonElement | undefined;
    btn?.click();
    return Boolean(btn);
  });
  console.log("PUBLISH_CLICKED:", publishClicked);

  // Wait for navigation to the detail page.
  let slug = "";
  try {
    await page.waitForFunction(() => location.pathname.startsWith("/c/"), { timeout: 45000 });
    slug = await page.evaluate(() => location.pathname);
  } catch {
    slug = await page.evaluate(() => location.pathname);
    const err = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log("PUBLISH_ERROR_TEXT:", err.replace(/\n/g, " | "));
  }
  console.log("FINAL_PATH:", slug);
  console.log("PAGE ERRORS:", errors.length);
  errors.slice(0, 5).forEach((e) => console.log("  -", e));

  await page.screenshot({ path: "tmp-publish.png" });
  await browser.close();

  if (slug.startsWith("/c/")) {
    const target = slug.split("/").pop();
    const res = await fetch(`http://localhost:3000/r/${target}`);
    const json = await res.json();
    console.log("REGISTRY_OK:", res.status, json.name, "files:", json.files?.length);
  }
}

main().catch((e) => {
  console.error("FATAL:", String(e).slice(0, 400));
  process.exit(1);
});