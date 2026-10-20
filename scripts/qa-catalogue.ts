import "dotenv/config";

/**
 * The whole catalogue, checked.
 *
 * Every other script proves one thing about one component. This one walks
 * every published component and asks the three questions a visitor asks:
 *
 *   - does the page render?
 *   - does the published document load — the build the site serves, with the
 *     theme it was asked for?
 *   - does the registry answer with files that are actually there?
 *
 * A component that fails any of them is broken for somebody, and the failure
 * is invisible until that somebody opens it. This is the check that catches it
 * before they do.
 *
 * Run with a dev server up:
 *   npx tsx scripts/qa-catalogue.ts
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

type RegistryFile = {
  path?: string;
  content?: string;
  type?: string;
};

type RegistryItem = {
  name?: string;
  files?: RegistryFile[];
  dependencies?: string[];
  meta?: { author?: string };
};

let failures = 0;
const problems: string[] = [];

function log(label: string, ok: boolean, extra = "") {
  if (!ok) {
    failures += 1;
    problems.push(`${label}${extra ? ` — ${extra}` : ""}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  ${extra}` : ""}`);
}

async function main() {
  const listRes = await fetch(`${BASE}/api/components?limit=200`, { cache: "no-store" });
  const listBody = (await listRes.json().catch(() => ({}))) as {
    items?: { slug: string; title?: string }[];
  };
  const items = listBody.items ?? [];

  console.log(`\nChecking ${items.length} published component(s).\n`);

  for (const item of items) {
    const slug = item.slug;

    // 1. The page.
    const page = await fetch(`${BASE}/c/${encodeURIComponent(slug)}`, {
      redirect: "manual",
    });
    log(`${slug} — the page answers`, page.status === 200, `status=${page.status}`);

    // 2. The published document, in both themes.
    for (const theme of ["light", "dark"] as const) {
      const artifact = await fetch(`${BASE}/p/${encodeURIComponent(slug)}?theme=${theme}`, {
        cache: "no-store",
      });
      const html = await artifact.text();
      const themed = html.includes(
        theme === "dark" ? '<html lang="en" class="dark">' : '<html lang="en" class="">',
      );
      log(
        `${slug} — the document loads in ${theme}`,
        artifact.status === 200 && html.includes("<!DOCTYPE html") && themed,
        `status=${artifact.status} bytes=${html.length}`
      );
    }

    // 3. The registry item: files that exist, with content in them.
    const registry = await fetch(`${BASE}/r/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const itemBody = (await registry.json().catch(() => ({}))) as RegistryItem;
    const files = itemBody.files ?? [];
    const empty = files.filter((file) => !file.content || !file.content.trim());
    log(
      `${slug} — the registry answers with files`,
      registry.status === 200 && files.length > 0 && empty.length === 0,
      `files=${files.length} empty=${empty.length}`
    );
    log(
      `${slug} — the registry names its author`,
      typeof itemBody.meta?.author === "string" && itemBody.meta.author.length > 0,
      `author=${itemBody.meta?.author ?? "none"}`
    );
  }

  console.log("");
  if (problems.length) {
    console.log("Problems:");
    for (const problem of problems) console.log(`  - ${problem}`);
  }
  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
