// @ts-expect-error - @babel/core ships no bundled types in this setup.
import { transformAsync } from "@babel/core";
import crypto from "crypto";
import { PREVIEW_ERROR_CSS, PREVIEW_ERROR_SCRIPT } from "./error-overlay";
import { PREVIEW_THEME_CSS } from "./theme.generated";

export type BundleFile = { path: string; content: string };
export type BundleResult = { html: string; hash: string; externals: string[] };

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const REACT_MODULES = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
]);

const BASE_CSS = `
html,body{height:100%}
body{margin:0;background:var(--background);color:var(--foreground);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
${PREVIEW_ERROR_CSS}
`;

function normalize(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveLocal(specifier: string, fromPath: string, known: string[]): string | null {
  const candidates: string[] = [];

  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    // "@/..." resolves from the project root — the layout of an App Router
    // project. Projects written before that layout kept a src/ prefix.
    candidates.push(normalize(`/${rest}`));
    candidates.push(normalize(`/src/${rest}`));

    // Alias drift: projects (and pasted code) move between a `ui/` folder and
    // `components/` — try the sibling spelling before giving up.
    if (rest.startsWith("components/ui/")) {
      const tail = rest.slice("components/ui/".length);
      candidates.push(normalize(`/components/${tail}`));
      candidates.push(normalize(`/src/components/${tail}`));
    } else if (rest.startsWith("components/")) {
      const tail = rest.slice("components/".length);
      candidates.push(normalize(`/components/ui/${tail}`));
      candidates.push(normalize(`/src/components/ui/${tail}`));
    } else if (rest.startsWith("ui/")) {
      const tail = rest.slice("ui/".length);
      candidates.push(normalize(`/components/ui/${tail}`));
      candidates.push(normalize(`/src/components/ui/${tail}`));
    }
  } else if (specifier.startsWith(".")) {
    const stack = normalize(fromPath).split("/").slice(0, -1);
    for (const segment of specifier.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") stack.pop();
      else stack.push(segment);
    }
    candidates.push(normalize(stack.join("/")));

    // Demos written before the app folder lived beside the component and
    // dotted into it (`./components/component`); read those from the root.
    if (specifier.startsWith("./")) {
      candidates.push(normalize(specifier.slice(1)));
    }
  } else {
    return null;
  }

  for (const candidate of candidates) {
    if (known.includes(candidate)) return candidate;
    for (const ext of EXTENSIONS) {
      if (known.includes(candidate + ext)) return candidate + ext;
    }
    for (const ext of EXTENSIONS) {
      if (known.includes(`${candidate}/index${ext}`)) return `${candidate}/index${ext}`;
    }
  }

  // Last resort for aliases: match the file by name inside the folders a
  // component project actually uses.
  if (specifier.startsWith("@/")) {
    const name = specifier.split("/").pop()?.replace(/\.(tsx?|jsx?)$/, "");
    if (name) {
      for (const dir of ["components", "components/ui", "ui", "hooks", "lib"]) {
        for (const ext of EXTENSIONS) {
          const candidate = `/src/${dir}/${name}${ext}`;
          if (known.includes(candidate)) return candidate;
        }
      }
    }
  }

  return null;
}

const IMPORT_RE =
  /(\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*|\brequire\s*\(\s*)(["'])([^"']+)\2/g;

const MAIN_COMPONENT_PATHS = [
  "/components/component.tsx",
  "/src/components/component.tsx",
  "/src/component.tsx",
  "/component.tsx",
];

/** The canonical module that represents the published component. */
function componentModuleId(known: string[]): string | null {
  for (const candidate of MAIN_COMPONENT_PATHS) {
    if (known.includes(candidate)) return candidate;
  }
  const firstTsx = known.find(
    (path) =>
      path.endsWith(".tsx") &&
      !path.includes("/ui/") &&
      !path.startsWith("/app/") &&
      !path.endsWith("/App.tsx")
  );
  return firstTsx ?? null;
}

function packageNameOf(specifier: string): string {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

function esmUrl(specifier: string): string {
  return `https://esm.sh/${specifier}?external=react,react-dom`;
}

/**
 * Compiles a component's files into ONE self-contained HTML document.
 * This runs once at publish time; the marketplace then serves static HTML.
 */
export async function buildPreviewBundle(
  files: BundleFile[],
  options: { entry?: string; theme?: "light" | "dark"; title?: string } = {}
): Promise<BundleResult> {
  const known = files.map((file) => normalize(file.path));
  const externals = new Set<string>();
  const css: string[] = [];
  const modules: { id: string; code: string }[] = [];
  const unresolved: { specifier: string; from: string }[] = [];
  const unresolvedSeen = new Set<string>();

  for (const file of files) {
    const id = normalize(file.path);

    if (id.endsWith(".css")) {
      css.push(file.content);
      continue;
    }

    // Internal imports become registry ids; bare imports become esm.sh.
    const rewritten = file.content.replace(IMPORT_RE, (match, prefix, quote, specifier) => {
      const bare = specifier.trim();
      if (bare.startsWith("@vfs/")) return match;

      const local = resolveLocal(bare, id, known);
      if (local) return `${prefix}${quote}@vfs${local}${quote}`;

      // An alias that points at nothing is a missing file, not a package.
      // Report it the way a dev server does instead of leaving a specifier
      // the browser cannot resolve.
      if (bare.startsWith("@/")) {
        const key = `${bare}::${id}`;
        if (!unresolvedSeen.has(key)) {
          unresolvedSeen.add(key);
          unresolved.push({ specifier: bare, from: id.replace(/^\//, "") });
        }
        return match;
      }

      // A demo may import the component by its original file name (e.g.
      // "./gradient-ring-loader") while the published module lives at a
      // canonical path. Point any unresolved relative import at the main
      // component so demos keep working.
      if (bare.startsWith(".")) {
        const primary = componentModuleId(known);
        if (primary) return `${prefix}${quote}@vfs${primary}${quote}`;
      }

      if (REACT_MODULES.has(bare)) return `${prefix}${quote}${bare}${quote}`;

      externals.add(packageNameOf(bare));
      return `${prefix}${quote}${bare}${quote}`;
    });

    const result = await transformAsync(rewritten, {
      filename: `shadway-bundle${id.match(/\.(tsx|ts|jsx|js)$/)?.[0] ?? ".tsx"}`,
      cwd: process.cwd(),
      root: process.cwd(),
      babelrc: false,
      configFile: false,
      sourceFileName: id,
      sourceMaps: false,
      compact: false,
      presets: [
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }],
        ["@babel/preset-react", { runtime: "automatic" }],
      ],
      plugins: [["@babel/plugin-transform-modules-commonjs", { strictNamespace: false }]],
    });

    modules.push({ id, code: result?.code ?? rewritten });
  }

  const entryId = normalize(
    options.entry ??
      (known.includes("/app/page.tsx")
        ? "/app/page.tsx"
        : known.includes("/src/App.tsx")
          ? "/src/App.tsx"
          : known.find((p) => p.endsWith(".tsx")) ?? "/app/page.tsx")
  );

  const externalList = Array.from(externals);
  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify({ modules, css, externals: externalList }))
    .digest("hex")
    .slice(0, 16);

  const registry = modules
    .map(
      (mod) => `__modules[${JSON.stringify(mod.id)}] = function (module, exports, require) {
${mod.code}
};`
    )
    .join("\n");

  const externalImports = externalList
    .map(
      (name) =>
        `  __ext[${JSON.stringify(name)}] = await import(${JSON.stringify(esmUrl(name))});`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en" class="${options.theme === "dark" ? "dark" : ""}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(options.title ?? "Component preview")}</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
@import "tailwindcss";
${PREVIEW_THEME_CSS}
</style>
<style>${BASE_CSS}</style>
<style>${css.join("\n")}</style>
<script type="importmap">
${JSON.stringify({
  imports: {
    react: "https://esm.sh/react@19.1.2",
    "react/jsx-runtime": "https://esm.sh/react@19.1.2/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@19.1.2/jsx-dev-runtime",
    "react-dom": "https://esm.sh/react-dom@19.1.2",
    "react-dom/client": "https://esm.sh/react-dom@19.1.2/client",
  },
})}
</script>
<script>window.__shadwayUnresolved = ${JSON.stringify(unresolved).replace(/</g, "\\u003c")};</script>
<script type="module" src="/preview/overlay.js"></script>
<script>${PREVIEW_ERROR_SCRIPT}</script>
</head>
<body>
<div id="root"></div>
<script type="module">
const __modules = Object.create(null);
const __ext = Object.create(null);
const __cache = Object.create(null);

${registry}

function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  if (id.startsWith("@vfs/")) {
    const target = id.slice(4);
    const factory = __modules[target];
    if (!factory) throw new Error("Module not found: Can't resolve '" + target + "'");
    const module = { exports: {} };
    __cache[id] = module;
    factory(module, module.exports, __req);
    return module.exports;
  }
  if (__ext[id]) return __ext[id];
  if (__ext[id.split("/")[0]]) return __ext[id.split("/")[0]];
  throw new Error("Package not installed: " + id);
}

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const ReactDOM = await import("react-dom");
__ext["react"] = React;
__ext["react-dom"] = ReactDOM;
__ext["react/jsx-runtime"] = await import("react/jsx-runtime");

${externalImports}

try {
  const entryModule = __req(${JSON.stringify(`@vfs${entryId}`)});
  const Component = entryModule.default || entryModule;
  if (typeof Component !== "function" && typeof Component !== "object") {
    throw new Error("The demo entry must export a React component.");
  }
  createRoot(document.getElementById("root")).render(
    React.createElement(React.StrictMode, null, React.createElement(Component))
  );
} catch (error) {
  const message = String(error && error.message ? error.message : error);
  if (typeof window.__shadwayPreviewError === "function") {
    window.__shadwayPreviewError({
      title: "Unhandled Runtime Error",
      message: message,
      stack: error && error.stack ? error.stack : "",
    });
  } else {
    document.getElementById("root").textContent = message;
  }
}
</script>
</body>
</html>`;

  return { html, hash, externals: externalList };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}