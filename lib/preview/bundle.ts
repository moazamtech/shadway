// @ts-expect-error - @babel/core ships no bundled types in this setup.
import { transformAsync } from "@babel/core";
import crypto from "crypto";

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

const THEME_CSS = `
:root{
  --background:0 0% 100%;--foreground:240 10% 3.9%;
  --card:0 0% 100%;--card-foreground:240 10% 3.9%;
  --popover:0 0% 100%;--popover-foreground:240 10% 3.9%;
  --primary:240 5.9% 10%;--primary-foreground:0 0% 98%;
  --secondary:240 4.8% 95.9%;--secondary-foreground:240 5.9% 10%;
  --muted:240 4.8% 95.9%;--muted-foreground:240 3.8% 46.1%;
  --accent:240 4.8% 95.9%;--accent-foreground:240 5.9% 10%;
  --destructive:0 84.2% 60.2%;--destructive-foreground:0 0% 100%;
  --border:240 5.9% 90%;--input:240 5.9% 90%;--ring:240 5% 64.9%;--radius:.5rem;
}
.dark{
  --background:240 10% 3.9%;--foreground:0 0% 98%;
  --card:240 10% 3.9%;--card-foreground:0 0% 98%;
  --popover:240 10% 3.9%;--popover-foreground:0 0% 98%;
  --primary:0 0% 98%;--primary-foreground:240 5.9% 10%;
  --secondary:240 3.7% 15.9%;--secondary-foreground:0 0% 98%;
  --muted:240 3.7% 15.9%;--muted-foreground:240 5% 64.9%;
  --accent:240 3.7% 15.9%;--accent-foreground:0 0% 98%;
  --destructive:0 62.8% 30.6%;--destructive-foreground:0 0% 98%;
  --border:240 3.7% 15.9%;--input:240 3.7% 15.9%;--ring:240 4.9% 83.9%;
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:hsl(var(--background));color:hsl(var(--foreground));font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.tw-bundle-error{font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;padding:14px;color:#ef4444;white-space:pre-wrap;line-height:1.55}
`;

function normalize(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveLocal(specifier: string, fromPath: string, known: string[]): string | null {
  const candidates: string[] = [];

  if (specifier.startsWith("@/")) {
    candidates.push(normalize(`/src/${specifier.slice(2)}`));
  } else if (specifier.startsWith(".")) {
    const stack = normalize(fromPath).split("/").slice(0, -1);
    for (const segment of specifier.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") stack.pop();
      else stack.push(segment);
    }
    candidates.push(normalize(stack.join("/")));
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
  return null;
}

const IMPORT_RE =
  /(\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*|\brequire\s*\(\s*)(["'])([^"']+)\2/g;

const MAIN_COMPONENT_PATHS = ["/src/components/component.tsx", "/src/component.tsx"];

/** The canonical module that represents the published component. */
function componentModuleId(known: string[]): string | null {
  for (const candidate of MAIN_COMPONENT_PATHS) {
    if (known.includes(candidate)) return candidate;
  }
  const firstTsx = known.find(
    (path) => path.endsWith(".tsx") && !path.includes("/ui/") && !path.endsWith("/App.tsx")
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
      (known.includes("/src/App.tsx")
        ? "/src/App.tsx"
        : known.find((p) => p.endsWith(".tsx")) ?? "/src/index.tsx")
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
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = { darkMode: ["class"], theme: { extend: {
  colors: {
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
    popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
    primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
    secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
    muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
    accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
    destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
    border: "hsl(var(--border))",
    input: "hsl(var(--input))",
    ring: "hsl(var(--ring))"
  },
  borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" }
} } };
</script>
<style>${THEME_CSS}</style>
<style>${css.join("\n")}</style>
<script type="importmap">
${JSON.stringify({
  imports: {
    react: "https://esm.sh/react@18.3.1",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
  },
})}
</script>
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
    if (!factory) throw new Error("Module not found: " + target);
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
  const root = document.getElementById("root");
  root.innerHTML = '<pre class="tw-bundle-error"></pre>';
  root.firstElementChild.textContent = String(error && error.message ? error.message : error);
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