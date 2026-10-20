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

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

  const results = await page.evaluate(async () => {
    const sandboxGlobal = globalThis as typeof globalThis & {
      __name?: (fn: unknown) => unknown;
    };
    sandboxGlobal.__name = (fn: unknown) => fn;
    const out: { name: string; ok: boolean; error: string }[] = [];

    const makeBlob = (code: string) => URL.createObjectURL(new Blob([code], { type: "text/javascript" }));

    async function trial(
      name: string,
      sandbox: string,
      inject: (entryUrl: string) => string
    ) {
      const depUrl = makeBlob("export const value = 'DEP-OK';");
      const entryUrl = makeBlob(
        `import { value } from "${depUrl}";\ndocument.title = value;\nwindow.__ok = value;`
      );

      return new Promise<{ name: string; ok: boolean; error: string }>((resolve) => {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", sandbox);

        const onMsg = (event: MessageEvent) => {
          if (!event.data || typeof event.data !== "object") return;
          const data = event.data as { type?: string; value?: unknown };
          if (data.type === "probe") {
            window.removeEventListener("message", onMsg);
            iframe.remove();
            const ok = data.value === "DEP-OK";
            const rec = { name, ok, error: ok ? "" : "bad value" };
            out.push(rec);
            resolve(rec);
          }
        };

        window.addEventListener("message", onMsg);

        iframe.srcdoc = `<!DOCTYPE html><html><body><div id="r"></div>
<script>
window.addEventListener("message", () => {});
</script>
<script type="module">
${inject(entryUrl)}
parent.postMessage({ type: "probe", value: (window.__ok ?? "none") }, "*");
</script>
</body></html>`;
        document.body.appendChild(iframe);

        setTimeout(() => {
          window.removeEventListener("message", onMsg);
          iframe.remove();
          const rec = { name, ok: false, error: "timeout" };
          out.push(rec);
          resolve(rec);
        }, 6000);
      });
    }

    const injectBlob = (entryUrl: string) => `import "${entryUrl}";`;

    const injectData = (entryUrl: string) => {
      const dataUrl = `data:text/javascript,${encodeURIComponent(`import "${entryUrl}";`)}`;
      return `import "${dataUrl}";`;
    };

    out.push(await trial("blob + allow-scripts", "allow-scripts", injectBlob));
    out.push(await trial("blob + allow-same-origin", "allow-scripts allow-same-origin", injectBlob));
    out.push(await trial("data-url + allow-scripts", "allow-scripts", injectData));

    return out;
  });

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", String(e).slice(0, 300));
  process.exit(1);
});