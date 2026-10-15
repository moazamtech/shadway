import {
  DEFAULT_COMPONENT_CODE,
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_CODE,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_CODE,
  DEFAULT_STYLE_PATH,
} from "../lib/studio/starter";
import { componentPreviewFiles } from "../lib/preview/server-files";
import { transpilePreview } from "../lib/preview/transpile";
import { buildPreviewBundle } from "../lib/preview/bundle";
import { installedPathFor } from "../lib/preview/shadcn-ui";
import { sandboxSeedFiles } from "../lib/studio/sandbox/project";
import {
  ensureDevServer,
  getDevServer,
  stopDevServer,
} from "../lib/studio/devserver/runner";

/**
 * Checks the two preview engines against the project layout they share.
 *
 * The studio project is an App Router one — `app/page.tsx` renders the
 * component in `components/component.tsx`, `@/*` resolves from the root, and
 * `components/ui/*` comes from the vendored registry. The browser-side preview
 * resolves those imports in memory; the sandbox writes the same tree to disk
 * for a real Next.js dev server. Both are asserted here, plus the rehoming of
 * records written before the app-folder layout.
 *
 * Usage: npx tsx scripts/qa-studio-preview.ts
 */

const results: string[] = [];

function check(label: string, ok: boolean, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  /* ------------------------------------------------- the sandbox project -- */
  const seed = sandboxSeedFiles({
    code: DEFAULT_COMPONENT_CODE,
    demoCode: DEFAULT_DEMO_CODE,
  });
  const paths = seed.map((file) => file.path);
  const content = (path: string) => seed.find((file) => file.path === path)?.content ?? "";

  check("seed: next.config.ts", paths.includes("/next.config.ts"));
  check("seed: postcss.config.mjs", paths.includes("/postcss.config.mjs"));
  check("seed: tsconfig.json", paths.includes("/tsconfig.json"));
  check("seed: app/layout.tsx", paths.includes("/app/layout.tsx"));
  check("seed: app/theme-sync.tsx", paths.includes("/app/theme-sync.tsx"));
  check("seed: app/page.tsx", paths.includes(DEFAULT_DEMO_PATH));
  check("seed: components/component.tsx", paths.includes(DEFAULT_COMPONENT_PATH));
  check("seed: app/globals.css", paths.includes(DEFAULT_STYLE_PATH));
  check(
    "seed: vendored button at /components/ui/button.tsx",
    paths.includes("/components/ui/button.tsx")
  );
  check("seed: no legacy /src paths", !paths.some((path) => path.startsWith("/src/")));

  const pkg = content("/package.json");
  check("package.json: next dev on port 3000", /next dev[^"]*3000/.test(pkg));
  check(
    "package.json: next/react pinned, tailwind wired",
    /"next": "\^15/.test(pkg) && /"react": "\^19/.test(pkg) && /tailwindcss/.test(pkg)
  );
  check("package.json: detected npm deps included", /"radix-ui": "latest"/.test(pkg));
  check(
    "seed: globals.css carries the Tailwind import + theme",
    content(DEFAULT_STYLE_PATH).startsWith('@import "tailwindcss";')
  );
  check("layout: imports globals.css", content("/app/layout.tsx").includes('"./globals.css"'));
  check("layout: renders ThemeSync", content("/app/layout.tsx").includes("<ThemeSync />"));
  check(
    "theme-sync: is a client component",
    content("/app/theme-sync.tsx").startsWith('"use client"')
  );
  check(
    "next.config: allows the csb preview origins, hides the dev badge",
    /allowedDevOrigins/.test(content("/next.config.ts")) &&
      /devIndicators: false/.test(content("/next.config.ts"))
  );
  check(
    "tsconfig: @/* maps to the project root",
    /"@\/\*": \["\.\/\*"\]/.test(content("/tsconfig.json"))
  );

  /* ----------------------------------------------- the browser-side engine -- */
  check(
    "installedPathFor: ui -> components/ui",
    installedPathFor("ui/button.tsx") === "/components/ui/button.tsx"
  );
  check("installedPathFor: lib -> lib", installedPathFor("lib/utils.ts") === "/lib/utils.ts");
  check(
    "installedPathFor: hooks -> hooks",
    installedPathFor("hooks/use-mobile.ts") === "/hooks/use-mobile.ts"
  );

  const files = componentPreviewFiles({
    code: DEFAULT_COMPONENT_CODE,
    demoCode: DEFAULT_DEMO_CODE,
    styleCode: DEFAULT_STYLE_CODE,
  });
  const result = await transpilePreview(files, DEFAULT_DEMO_PATH);

  check("transpile: entry is app/page.tsx", result.entry === "/app/page.tsx");
  check(
    "transpile: no unresolved imports",
    result.unresolved.length === 0,
    JSON.stringify(result.unresolved)
  );
  check("transpile: no build errors", result.errors.length === 0, JSON.stringify(result.errors));
  check(
    "transpile: app/page.tsx module",
    result.modules.some((module) => module.path === "/app/page.tsx")
  );
  check(
    "transpile: components/component.tsx module",
    result.modules.some((module) => module.path === "/components/component.tsx")
  );
  check(
    "transpile: vendored button module",
    result.modules.some((module) => module.path === "/components/ui/button.tsx")
  );
  check("transpile: stylesheet collected", result.css.length > 0, `${result.css.length}`);
  check(
    "transpile: the page imports the component via @/",
    (result.modules.find((module) => module.path === "/app/page.tsx")?.code ?? "").includes(
      "@vfs/components/component"
    )
  );

  /* ------------------------------------------- records from the old layout -- */
  const legacyDemo = componentPreviewFiles({
    code: DEFAULT_COMPONENT_CODE,
    demoCode:
      'import MyComponent from "./components/component";\n\nexport default function App() {\n  return <MyComponent />;\n}\n',
  });
  const legacyResult = await transpilePreview(legacyDemo, DEFAULT_DEMO_PATH);
  check(
    "legacy demo with a relative import still resolves",
    legacyResult.unresolved.length === 0 && legacyResult.errors.length === 0,
    JSON.stringify([...legacyResult.unresolved, ...legacyResult.errors])
  );

  const legacySupport = componentPreviewFiles({
    code: 'import Thing from "@/components/thing";\n\nexport default function C() {\n  return <Thing />;\n}\n',
    files: [
      {
        path: "/src/components/thing.tsx",
        content: "export default function Thing() {\n  return <span>hi</span>;\n}\n",
      },
    ],
  });
  const supportResult = await transpilePreview(legacySupport, DEFAULT_DEMO_PATH);
  check(
    "legacy /src support file is rehomed to the root",
    supportResult.unresolved.length === 0 &&
      supportResult.errors.length === 0 &&
      supportResult.modules.some((module) => module.path === "/components/thing.tsx"),
    JSON.stringify(supportResult.unresolved)
  );

  /* --------------------------------------------------- the published bundle -- */
  const bundle = await buildPreviewBundle(files, { entry: DEFAULT_DEMO_PATH, title: "QA" });
  check(
    "bundle: builds an html document",
    bundle.html.includes("<!DOCTYPE html>") && bundle.hash.length > 0
  );
  check("bundle: reports no unresolved aliases", bundle.html.includes("__shadwayUnresolved = [];"));

  /* ------------------------------------------------ the local dev server -- */
  const runner = await ensureDevServer("qa-studio-preview", {
    code: DEFAULT_COMPONENT_CODE,
    demoCode: DEFAULT_DEMO_CODE,
    styleCode: DEFAULT_STYLE_CODE,
  });

  let live = runner;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (live.status === "ready" || live.status === "error") break;
    await new Promise((resolve) => setTimeout(resolve, 4000));
    live = getDevServer("qa-studio-preview") ?? live;
  }
  check("runner: dev server becomes ready", live.status === "ready", live.detail ?? live.status);

  if (live.status === "ready" && live.url) {
    const html = await (await fetch(live.url)).text();
    check("runner: serves the starter page", html.includes("Interfaces that feel effortless"));
    check("runner: compiled by Next", html.includes("__next"));
  }

  await stopDevServer("qa-studio-preview");

  console.log(results.join("\n"));
  const failed = results.filter((row) => row.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
}

void main();
