import "dotenv/config";

import bcrypt from "bcryptjs";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

import { connectToDatabase } from "../lib/mongodb";

/**
 * End-to-end proof that a generated project runs on a real Next.js dev server.
 *
 * 1. Seeds a QA account and signs in the way the login form does (csurf +
 *    credentials callback), then hands the session cookie to the browser.
 * 2. POSTs a generated project to /api/preview/devserver — the exact payload
 *    the component-generator sends — and waits for it to boot.
 * 3. Asserts the served page contains the generator's own text and that the
 *    shadcn `@/` import resolved.
 * 4. Edits the component and asserts the running server picks it up.
 * 5. Screenshots the generator and the dev server it is rendering on.
 *
 * Run: npx tsx scripts/qa-generator-preview.ts
 */
const BASE = "http://localhost:3000";
const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((candidate) => fs.existsSync(candidate));
const SHOTS = "C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\shadway-qa";

const EMAIL = "qa-preview@example.com";
const PASSWORD = "qa-preview-password";

const FILES: Record<string, string> = {
  "/App.tsx": `import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">
        Generated on a real Next.js dev server
      </span>
      <h1 className="text-5xl font-bold tracking-tight">
        Interfaces that feel effortless
      </h1>
      <p className="max-w-md text-center text-muted-foreground">
        This page is rendered by the Next.js runtime, not an emulator.
      </p>
      <Button className="gap-1.5">
        <Star className="size-4" />
        Shadway generator check
      </Button>
    </main>
  );
}
`,
};

const PAGE = `import Entry from "@/App";

export default function Page() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <Entry />
    </div>
  );
}
`;

const STYLE = `@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap");
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --font-sans: var(--font-space-grotesk);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

:root {
  --font-space-grotesk: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}

@layer base {
  * {
    border-color: oklch(0.9 0 0);
  }
  body {
    background-color: oklch(1 0 0);
    color: oklch(0.145 0 0);
  }
}

.dark * {
  border-color: oklch(0.3 0 0);
}
.dark body {
  background-color: oklch(0.145 0 0);
  color: oklch(0.985 0 0);
}
`;

type Status = {
  configured?: boolean;
  engine?: string;
  status?: "installing" | "starting" | "ready" | "error" | "stopped";
  url?: string;
  port?: number;
  detail?: string | null;
  logs?: string[];
};

type Cookie = { name: string; value: string };

/** Collects every `Set-Cookie` from a response into a single header value. */
async function withCookies(
  response: Response,
  jar: Cookie[]
): Promise<string> {
  const setCookies = (response.headers as Headers).getSetCookie?.() ?? [];
  for (const raw of setCookies) {
    const pair = raw.split(";")[0];
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    const existing = jar.find((cookie) => cookie.name === name);
    if (existing) existing.value = value;
    else jar.push({ name, value });
  }
  return jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function statusOf(sessionId: string, cookies: string): Promise<Status> {
  const response = await fetch(`${BASE}/api/preview/devserver?sessionId=${sessionId}`, {
    headers: { cookie: cookies },
  });
  return (await response.json()) as Status;
}

async function postProject(
  sessionId: string,
  cookies: string,
  files: Record<string, string>,
  style: string,
  page: string
): Promise<Status> {
  const response = await fetch(`${BASE}/api/preview/devserver`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ sessionId, files, style, page }),
  });
  return (await response.json()) as Status;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("users").updateOne(
    { email: EMAIL },
    { $set: { email: EMAIL, password: bcrypt.hashSync(PASSWORD, 10), name: "QA Preview" } },
    { upsert: true }
  );
  console.log("QA USER seeded");

  // Sign in exactly like the login form does.
  const jar: Cookie[] = [];
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
  const csrfToken = csrfPayload?.csrfToken ?? "";

  const params = new URLSearchParams();
  params.set("csrfToken", csrfToken);
  params.set("email", EMAIL);
  params.set("password", PASSWORD);
  params.set("callbackUrl", `${BASE}/`);
  params.set("json", "true");

  const callback = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: await withCookies(csrfResponse, jar),
    },
    body: params.toString(),
  });
  const cookieHeader = await withCookies(callback, jar);
  console.log("CALLBACK", callback.status, cookieHeader.slice(0, 60) + "…");

  const sessionResponse = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader },
  });
  const session = (await sessionResponse.json()) as { user?: { id?: string } };
  console.log("SESSION", JSON.stringify(session.user ?? {}));
  if (!session.user?.id) throw new Error("Login failed — no session user");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  fs.mkdirSync(SHOTS, { recursive: true });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });
    page.setDefaultTimeout(120_000);
    page.on("pageerror", (error) => console.log("PAGE ERROR", String(error).slice(0, 160)));

    for (const cookie of jar) {
      await page.setCookie({ name: cookie.name, value: cookie.value, domain: "localhost", path: "/" });
    }

    const sessionId = "qa-gen";
    await page.goto(`${BASE}/component-generator`, { waitUntil: "domcontentloaded" });
    await sleep(3000);
    await page.screenshot({ path: path.join(SHOTS, "generator.png") });
    console.log("GENERATOR PAGE SHOT saved");

    const first = await postProject(sessionId, cookieHeader, FILES, STYLE, PAGE);
    console.log("CREATE", first.status, first.url, (first.logs ?? []).slice(-2).join(" | "));

    let server = first;
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await sleep(4000);
      server = await statusOf(sessionId, cookieHeader);
      if (server.status !== "installing" && server.status !== "starting") break;
    }

    console.log("STATUS", server.status, server.detail ?? "", server.url);

    if (server.status !== "ready" || !server.url) {
      console.log("LOGS\n" + (server.logs ?? []).slice(-40).join("\n"));
      throw new Error(`Dev server never became ready: ${server.status}`);
    }

    const target = `${server.url}/?theme=dark`;
    await page.goto(target, { waitUntil: "domcontentloaded" });

    let text = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      text = await page.evaluate(() => document.body.innerText);
      if (text.includes("Interfaces that feel effortless")) break;
      await page.reload({ waitUntil: "domcontentloaded" });
      await sleep(4000);
    }

    console.log("PAGE TEXT", text.slice(0, 200).replace(/\n/g, " | "));
    if (!text.includes("Interfaces that feel effortless")) {
      throw new Error("The dev server did not serve the generated page");
    }
    if (!text.includes("Shadway generator check")) {
      throw new Error("The shadcn Button import did not resolve");
    }

    const theme = await page.evaluate(() => document.documentElement.className);
    console.log("THEME", theme);

    await page.screenshot({ path: path.join(SHOTS, "preview.png") });
    console.log("PREVIEW SHOT saved — the generated project on a real dev server");

    // Editing the component must reach the running server immediately.
    const sync = await postProject(
      sessionId,
      cookieHeader,
      {
        "/App.tsx": FILES["/App.tsx"].replace("Interfaces that feel effortless", "Edited at runtime"),
      },
      STYLE,
      PAGE
    );
    console.log("SYNC", sync.status, sync.detail ?? "");

    let after = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      after = await page.evaluate(() => document.body.innerText);
      if (after.includes("Edited at runtime")) break;
      await page.reload({ waitUntil: "domcontentloaded" });
      await sleep(4000);
    }
    console.log("AFTER EDIT", after.slice(0, 200).replace(/\n/g, " | "));
    if (!after.includes("Edited at runtime")) {
      throw new Error("The running dev server did not pick up the edited file");
    }

    console.log("ALL CHECKS PASSED");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("QA FAILED", error);
  process.exit(1);
});
