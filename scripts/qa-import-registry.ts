import fs from "fs";
import http from "node:http";
import type { AddressInfo } from "node:net";

import puppeteer from "puppeteer";

import {
  ImportError,
  importReferences,
  readRegistryItem,
  type RegistryNetwork,
} from "../app/api/studio/import-registry/route";
import { parseRegistryInput } from "../lib/studio/registry-reference";
import { BASE, createQaAccount, removeQaAccount, signIn, type QaAccount } from "./qa-session";

/**
 * The registry import.
 *
 * An author who has found a component on a registry this site does not run
 * pastes its address into the studio, and the item comes in whole: the
 * component file, the demo, the packages it needs. The address is the whole
 * of what the author gives, and it is a stranger's address, so the checks
 * here are as much about the address as about the item.
 *
 * The registry the route reads is a server of this script's own, so the
 * checks do not depend on a registry being up and do not depend on the
 * network. The route is pointed at it by giving it a network of its own: a
 * resolver that answers with a public address, and a request that goes to
 * the local server.
 *
 *   npx tsx scripts/qa-import-registry.ts
 */

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((p) => fs.existsSync(p));

/** A public address, for the resolver the route is given. */
const PUBLIC_ADDRESS = "203.0.113.10";

/** The item the local registry serves. */
const ITEM = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "qa-hero",
  type: "registry:block",
  title: "QA Hero",
  description: "A registry item served by the import check.",
  dependencies: ["clsx", "tailwind-merge", "~/lib/utils"],
  registryDependencies: ["button", "https://example.com/r/other"],
  cssVars: {
    light: { "--qa-hero": "0 0% 0%" },
    dark: { "--qa-hero": "100% 0 0" },
  },
  files: [
    {
      path: "components/qa-hero.tsx",
      content:
        'export function QaHero() {\n  return <div className="p-6">QA hero</div>;\n}\n',
      type: "registry:component",
      target: "components/qa-hero.tsx",
    },
    {
      path: "app/page.tsx",
      content:
        'import { QaHero } from "@/components/qa-hero";\n\nexport default function Page() {\n  return <QaHero />;\n}\n',
      type: "registry:page",
      target: "app/page.tsx",
    },
  ],
};

/**
 * The directory the CLI carries.
 *
 * The CLI knows the community registries by name, so `@acme/button` works
 * without the project having configured anything. The local registry serves a
 * directory of its own, with one registry in it, and the checks below ask for
 * an item in that registry by name.
 */
const DIRECTORY = [
  {
    name: "@acme",
    url: "https://registry.example/r/{name}.json",
    homepage: "https://acme.example",
    description: "A registry of the check's own.",
  },
];

let failures = 0;
function log(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
  if (!ok) failures += 1;
}

/** The local registry: an item, a page that is not one, and a 404. */
function startRegistry() {
  const server = http.createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    /**
     * The address without its extension.
     *
     * A registry answers at `/r/name` and at `/r/name.json` alike, and the
     * checks ask for both, so the extension is taken off before the address
     * is compared.
     */
    const key = path.replace(/\.json$/, "");

    if (key === "/r/qa-hero" || key === "/r/styles/new-york/qa-hero") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(ITEM));
      return;
    }

    /**
     * The dependency the item is built out of.
     *
     * A block that says it is built out of a button is describing a component
     * that does not compile without one, so the import has to bring the button
     * in with it.
     */
    if (key === "/r/button" || key === "/r/styles/new-york/button") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          name: "button",
          type: "registry:ui",
          dependencies: ["@radix-ui/react-slot"],
          files: [
            {
              path: "ui/button.tsx",
              content:
                'export function Button(props: Record<string, unknown>) {\n  return <button {...props} />;\n}\n',
              type: "registry:ui",
            },
          ],
        })
      );
      return;
    }

    if (path === "/r/registries.json") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(DIRECTORY));
      return;
    }

    if (path === "/r/large") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          name: "qa-large",
          type: "registry:component",
          files: [
            {
              path: "components/qa-large.tsx",
              content: `// ${"x".repeat(500 * 1024)}\n`,
              type: "registry:component",
            },
            {
              path: "components/qa-small.tsx",
              content: "export const QaSmall = 1;\n",
              type: "registry:component",
            },
          ],
        })
      );
      return;
    }

    if (path === "/r/missing") {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("not found");
      return;
    }

    if (path === "/r/not-an-item") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ hello: "world" }));
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!doctype html><html><body>A page, not an item.</body></html>");
  });

  return new Promise<{ server: http.Server; origin: string }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

/**
 * The network the route is given: the local server, and a resolver that
 * answers with a public address.
 *
 * The requests are counted, because a refusal that never reaches the
 * network is the whole of what the local-address rule is for.
 */
function networkFor(origin: string, resolve: (host: string) => Promise<string[]>) {
  const state = { requests: 0 };
  const network: RegistryNetwork = {
    fetch: async (url, init) => {
      state.requests += 1;
      const path = new URL(url).pathname;
      return fetch(`${origin}${path}`, init);
    },
    resolve,
  };
  return { network, state };
}

/** The refusal, as a sentence an author can act on. */
async function refusal(address: string, network: RegistryNetwork) {
  try {
    await readRegistryItem(address, { network });
  } catch (error) {
    if (error instanceof ImportError) return error;
    throw error;
  }
  return null;
}

async function main() {
  const { server, origin } = await startRegistry();
  const { network, state } = networkFor(origin, async () => [PUBLIC_ADDRESS]);

  try {
    const item = await readRegistryItem("https://registry.example/r/qa-hero", { network });

    log("the item's files come back", item.files.length === 2, `files=${item.files.length}`);
    log(
      "the file keeps its content",
      item.files[0]?.content.includes("export function QaHero") === true,
    );
    log(
      "the file keeps its type and its target",
      item.files[0]?.type === "registry:component" && item.files[0]?.target === "components/qa-hero.tsx",
      `${item.files[0]?.type} ${item.files[0]?.target ?? "-"}`,
    );
    log("the item's name comes back", item.name === "qa-hero", item.name);
    log(
      "the packages come back as packages",
      item.dependencies.join(",") === "clsx,tailwind-merge",
      item.dependencies.join(","),
    );
    log(
      "the css variables come back",
      item.cssVars?.light["--qa-hero"] === "0 0% 0%",
      JSON.stringify(item.cssVars?.light ?? {}),
    );
    log(
      "a relative registry dependency is addressed absolutely",
      item.registryDependencies[0]?.kind === "item" &&
        item.registryDependencies[0]?.namespace === null &&
        item.registryDependencies[0]?.name === "button",
      JSON.stringify(item.registryDependencies),
    );

    /* ------------------------------------------------- the command and the name -- */

    /**
     * The command, in the shapes people copy it in.
     *
     * The runner is the package manager's business — `npx`, `pnpm dlx`,
     * `bunx` all mean the same thing to the person who copied them — and what
     * the command says is which item it installs.
     */
    for (const command of [
      "npx shadcn@latest add @acme/qa-hero",
      "pnpm dlx shadcn@latest add @acme/qa-hero",
      "bunx --bun shadcn@latest add @acme/qa-hero",
      "yarn dlx shadcn@latest add @acme/qa-hero",
      "npx shadcn@latest add @acme/qa-hero --yes",
      "shadcn add @acme/qa-hero",
    ]) {
      const references = parseRegistryInput(command);
      const named =
        references.length === 1 &&
        references[0].kind === "item" &&
        references[0].namespace === "acme" &&
        references[0].name === "qa-hero";

      const imported = named
        ? await importReferences(references, network)
        : null;

      log(
        `the command names the item: ${command}`,
        named && imported !== null && imported.items.length === 1,
        named ? "" : "it did not name the item",
      );
    }

    const byName = await importReferences(
      parseRegistryInput("@acme/qa-hero"),
      network
    );
    log(
      "a name in a namespace is found through the directory",
      byName.items.length === 1 && byName.items[0].name === "qa-hero",
      byName.items.map((found) => found.url).join(" | "),
    );
    log(
      "the item's own files come with it",
      byName.files.some((file) => file.path === "components/qa-hero.tsx"),
      byName.files.map((file) => file.path).join(" | "),
    );

    const bare = await importReferences(parseRegistryInput("qa-hero"), network);
    log(
      "a name with no namespace is found in the default registry",
      bare.items.length === 1 && bare.items[0].name === "qa-hero",
      bare.items.map((found) => found.url).join(" | "),
    );

    log(
      "the item it is built out of is brought in as well",
      byName.registryFiles.some((file) => file.path === "ui/button.tsx"),
      byName.registryFiles.map((file) => file.path).join(" | "),
    );
    log(
      "the packages the dependencies need are named",
      byName.dependencies.includes("@radix-ui/react-slot"),
      byName.dependencies.join(","),
    );
    log(
      "a dependency that cannot be read is reported and not fatal",
      byName.unresolved.some((entry) => entry.includes("other")),
      byName.unresolved.join(" | "),
    );

    const local = await refusal(`http://127.0.0.1:${new URL(origin).port}/r/qa-hero`, network);
    log(
      "a local address is refused",
      local !== null && local.status === 400,
      local?.message ?? "it was not refused",
    );
    log(
      "the refusal is a sentence and not a stack trace",
      local !== null && !local.message.includes("\n") && local.message.endsWith("."),
      local?.message ?? "",
    );

    const before = state.requests;
    await refusal("http://127.0.0.1:9/r/qa-hero", network);
    await refusal("http://10.0.0.5/r/qa-hero", network);
    await refusal("http://169.254.169.254/r/qa-hero", network);
    await refusal("http://[::1]/r/qa-hero", network);
    await refusal("http://localhost/r/qa-hero", network);
    log(
      "a refused address is never fetched",
      state.requests === before,
      `requests=${state.requests - before}`,
    );

    const inward = networkFor(origin, async () => ["127.0.0.1"]).network;
    const resolved = await refusal("https://registry.example/r/qa-hero", inward);
    log(
      "a name that resolves inward is refused",
      resolved !== null && resolved.status === 400,
      resolved?.message ?? "it was not refused",
    );

    const page = await refusal("https://registry.example/r/qa-hero/page", network);
    log(
      "an answer that is not an item is refused",
      page !== null && page.status === 422,
      page?.message ?? "it was not refused",
    );

    const notAnItem = await refusal("https://registry.example/r/not-an-item", network);
    log(
      "a document that is not an item is refused",
      notAnItem !== null && notAnItem.status === 422,
      notAnItem?.message ?? "it was not refused",
    );

    const missing = await refusal("https://registry.example/r/missing", network);
    log(
      "an address with no item is refused",
      missing !== null && missing.status === 404,
      missing?.message ?? "it was not refused",
    );

    const scheme = await refusal("ftp://registry.example/r/qa-hero", network);
    log(
      "a link that is not http is refused",
      scheme !== null && scheme.status === 400,
      scheme?.message ?? "it was not refused",
    );

    const notAnItemUrl = await refusal("https://registry.example/components/qa-hero", network);
    log(
      "a link that names no item is refused",
      notAnItemUrl !== null && notAnItemUrl.status === 400,
      notAnItemUrl?.message ?? "it was not refused",
    );

    const large = await readRegistryItem("https://registry.example/r/large", { network });
    log(
      "a file that is too large is left out and named",
      large.files.length === 1 && large.skipped.length === 1 && large.skipped[0].reason.includes("400 KB"),
      large.skipped.map((file) => `${file.path}: ${file.reason}`).join(" | "),
    );

    await checkEndpoint(origin);
  } finally {
    server.close();
  }

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

/**
 * The endpoint itself, over http.
 *
 * The route is asked for an address inside the deployment's own network, and
 * it answers with a sentence and a status rather than a stack trace. The
 * first request is made without a session, which is the gate the studio's
 * own import sits behind, and the second with one.
 *
 * The session is a courtesy rather than a requirement: the account is created
 * through the same helper the other checks use, and a database that is being
 * migrated is not a failure of this route. The refusal itself is checked
 * above, where no database is involved.
 */
async function checkEndpoint(origin: string) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // A plain document on the site's own origin: the requests below are made
    // from the page, so they have to be made from somewhere on the site.
    const landed = await page
      .goto(`${BASE}/api/health`, { waitUntil: "domcontentloaded", timeout: 90_000 })
      .catch(() => null);
    if (!landed) {
      console.log("SKIP  the endpoint over http  the dev server is not running");
      return;
    }

    const ask = async (url: string) =>
      page.evaluate(async (target) => {
        const response = await fetch("/api/studio/import-registry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target }),
        });
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return { status: response.status, body };
      }, url);

    const anonymous = await ask(`${origin}/r/qa-hero`);
    log(
      "the endpoint asks for a session",
      anonymous.status === 401,
      `${anonymous.status} ${String(anonymous.body?.error ?? "")}`,
    );

    let account: QaAccount | null = null;
    try {
      account = await createQaAccount("admin");
    } catch (error) {
      console.log(
        `SKIP  the endpoint over http  no session could be created: ${String(error).slice(0, 120)}`
      );
      return;
    }

    try {
      await signIn(page, account.email, account.password);

      const answer = await ask(`${origin}/r/qa-hero`);

      log(
        "the endpoint refuses an address inside the network",
        answer.status === 400 && typeof answer.body?.error === "string",
        `${answer.status} ${String(answer.body?.error ?? "")}`,
      );
      log(
        "the endpoint answers with a sentence",
        typeof answer.body?.error === "string" && !answer.body.error.includes("\n"),
        String(answer.body?.error ?? ""),
      );
    } finally {
      await removeQaAccount(account.email);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("FATAL:", String(error).slice(0, 400));
  process.exit(1);
});
