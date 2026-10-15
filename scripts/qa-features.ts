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
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  const frameText = async () =>
    (
      await Promise.all(
        page
          .frames()
          .filter((f) => f !== page.mainFrame())
          .map((f) => f.evaluate(() => document.body?.innerText?.trim() || "").catch(() => ""))
      )
    ).join(" | ");

  // ---------- Detail page: tabs + install ----------
  await page.goto("http://localhost:3000/c/pulse-button", {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await new Promise((r) => setTimeout(r, 5000));
  console.log("PREVIEW_RENDERED:", (await frameText()).includes("Pulse Button"));

  for (const label of ["Code", "Install"]) {
    const clicked = await page.evaluate((text: string) => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.textContent || "").trim() === text
      );
      (btn as HTMLButtonElement)?.click();
      return Boolean(btn);
    }, label);
    await new Promise((r) => setTimeout(r, 900));
    const body = await page.evaluate(() => document.body.innerText);
    console.log(`TAB_${label.toUpperCase()}:`, clicked && body.includes(label === "Install" ? "shadcn CLI" : "PulseButton"));
  }

  for (const tab of ["v0", "Lovable", "Bolt"]) {
    const has = await page.evaluate((text: string) => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.textContent || "").trim() === text
      );
      (btn as HTMLButtonElement)?.click();
      return Boolean(btn);
    }, tab);
    await new Promise((r) => setTimeout(r, 600));
    const body = await page.evaluate(() => document.body.innerText);
    console.log(`INSTALL_${tab.toUpperCase()}:`, has && /prompt|registry|component/i.test(body));
  }

  await page.screenshot({ path: "tmp-detail-install.png" });

  // ---------- Studio: create file + install package ----------
  await page.goto("http://localhost:3000/studio", {
    waitUntil: "networkidle2",
    timeout: 90000,
  });
  await new Promise((r) => setTimeout(r, 6000));
  console.log("STUDIO_PREVIEW:", (await frameText()).includes("Your shadcn component"));

  // Create a new file
  const created = await page.evaluate(() => {
    const addBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.getAttribute("title") || "") === "New file"
    ) as HTMLButtonElement | undefined;
    addBtn?.click();
    return Boolean(addBtn);
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const input = Array.from(document.querySelectorAll("input")).find(
      (i) => (i as HTMLInputElement).placeholder === "hooks/use-thing.ts"
    ) as HTMLInputElement | undefined;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "hooks/use-counter.ts");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  const fileCreated = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "Create"
    ) as HTMLButtonElement | undefined;
    btn?.click();
    return Boolean(btn);
  });
  await new Promise((r) => setTimeout(r, 800));
  const treeHasNewFile = await page.evaluate(() =>
    document.body.innerText.includes("use-counter.ts")
  );
  console.log("NEW_FILE_CREATED:", created && fileCreated && treeHasNewFile);

  // Install an npm package
  await page.evaluate(() => {
    const input = Array.from(document.querySelectorAll("input")).find(
      (i) => (i as HTMLInputElement).placeholder === "framer-motion"
    ) as HTMLInputElement | undefined;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
      setter?.call(input, "clsx");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "Install"
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 3000));
  const pkgInstalled = await page.evaluate(() => document.body.innerText.includes("clsx"));
  console.log("PACKAGE_INSTALLED:", pkgInstalled);

  await page.screenshot({ path: "tmp-studio-final.png" });

  console.log("PAGE_ERRORS:", errors.length);
  errors.slice(0, 5).forEach((e) => console.log("  -", e));

  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", String(e).slice(0, 300));
  process.exit(1);
});