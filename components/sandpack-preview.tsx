"use client";

import React, { useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  useSandpackClient,
  useSandpackConsole,
} from "@codesandbox/sandpack-react";
import { githubLight, amethyst } from "@codesandbox/sandpack-themes";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SANDPACK_SHADCN_FILES } from "@/lib/sandpack-files";
import {
  ColorSchemeConfig,
  defaultColorSchemeConfig,
  generateThemeCSS,
} from "@/lib/color-scheme";

type SandpackPreviewProps = {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  className?: string;
  showConsole?: boolean;
  title?: string;
  colorScheme?: ColorSchemeConfig;
  isDarkTheme?: boolean;
  onPreviewUrlChange?: (url: string) => void;
  onConsoleLogs?: (
    logs: Array<{
      level: "log" | "warn" | "error";
      message: string;
      timestamp: Date;
    }>,
  ) => void;
};
const SandpackPreviewUrlSync = ({
  onUrlChange,
}: {
  onUrlChange?: (url: string) => void;
}) => {
  const { sandpack, getClient } = useSandpackClient();
  const lastUrlRef = React.useRef("");

  React.useEffect(() => {
    if (!onUrlChange) return;
    if (sandpack.status !== "done") return;
    const client = getClient() as any;
    if (!client || typeof client.getCodeSandboxURL !== "function") return;

    let cancelled = false;
    client
      .getCodeSandboxURL()
      .then((result: any) => {
        const nextUrl = result?.embedUrl || result?.editorUrl || "";
        if (!nextUrl || cancelled || nextUrl === lastUrlRef.current) return;
        lastUrlRef.current = nextUrl;
        onUrlChange(nextUrl);
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [sandpack.status, getClient, onUrlChange]);

  return null;
};

const SandpackConsoleBridge = ({
  onLogs,
}: {
  onLogs?: (
    logs: Array<{
      level: "log" | "warn" | "error";
      message: string;
      timestamp: Date;
    }>,
  ) => void;
}) => {
  const { logs } = useSandpackConsole({
    resetOnPreviewRestart: true,
    showSyntaxError: true,
    maxMessageCount: 200,
  });

  React.useEffect(() => {
    if (!onLogs) return;
    const mapped = logs
      .filter((entry) => entry.method !== "clear")
      .map((entry) => {
        const level = (
          entry.method === "error"
            ? "error"
            : entry.method === "warn"
              ? "warn"
              : "log"
        ) as "log" | "warn" | "error";
        const message =
          entry.data
            ?.map((item) =>
              typeof item === "string" ? item : JSON.stringify(item),
            )
            ?.join(" ") ?? "";
        return { level, message, timestamp: new Date() };
      });
    onLogs(mapped);
  }, [logs, onLogs]);

  return null;
};

function findPrimaryComponentName(src: string) {
  const patterns: Array<RegExp> = [
    /^\s*export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/m,
    /^\s*export\s+default\s+(?:React\.)?memo\(\s*([A-Z][A-Za-z0-9_]*)\s*\)/m,
    /^\s*export\s+default\s+(?:React\.)?forwardRef\(\s*([A-Z][A-Za-z0-9_]*)\s*\)/m,
    /^\s*export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?\s*$/m,
    /^\s*export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/m,
    /function\s+([A-Z][A-Za-z0-9_]*)\s*\(/,
    /const\s+([A-Z][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?=\s*\(/,
    /const\s+([A-Z][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>/,
  ];

  for (const pattern of patterns) {
    const match = src.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "GeneratedComponent";
}

function posixDirname(pathname: string | null | undefined) {
  if (!pathname || typeof pathname !== "string") return "/";
  const normalized = pathname.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return "/";
  return normalized.slice(0, idx);
}

function posixRelative(
  fromDir: string | null | undefined,
  toPath: string | null | undefined,
): string {
  if (!fromDir || typeof fromDir !== "string")
    return typeof toPath === "string" ? toPath : ".";
  if (!toPath || typeof toPath !== "string") return ".";

  const from = fromDir.replace(/\\/g, "/");
  const to = toPath.replace(/\\/g, "/");
  const fromParts = from.split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }
  const up = fromParts.length - common;
  const rest = toParts.slice(common);
  const prefix = up === 0 ? "." : Array(up).fill("..").join("/");
  const joined = [prefix, ...rest].filter(Boolean).join("/");
  return joined.startsWith(".") ? joined : `./${joined}`;
}

function stripModuleExtension(p: string | null | undefined): string {
  if (!p || typeof p !== "string") return "";
  return p.replace(/\.(tsx|ts|jsx|js)$/i, "");
}

function dedupeNamedImports(src: string) {
  return src.replace(
    /import\s+(type\s+)?{\s*([^}]+)\s*}\s*from\s*["']([^"']+)["']\s*;?/g,
    (_full, typePrefix, names, from) => {
      const seen = new Set<string>();
      const deduped = names
        .split(",")
        .map((part: any) => part.trim())
        .filter((part: any) => part.length > 0)
        .filter((part: any) => {
          const key = part.replace(/\s+as\s+.+$/, "");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .join(", ");
      return `import ${typePrefix || ""}{ ${deduped} } from "${from}";`;
    },
  );
}

function extractPackageDependencies(
  sources: Array<string | undefined | null>,
  baseDeps: Record<string, string>,
) {
  const importRegex =
    /import\s+(?:[^"']+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
  const pkgNames = new Set<string>();

  const normalizePackageName = (specifier: string) => {
    if (!specifier) return null;
    if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
    if (specifier.startsWith("@/")) return null;

    const cleaned = specifier.replace(/^node:/, "");
    const parts = cleaned.split("/");
    if (cleaned.startsWith("@")) {
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      return cleaned;
    }
    return parts[0];
  };

  for (const src of sources) {
    if (!src) continue;
    let match: RegExpExecArray | null;
    // Reset regex state since it's global
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(src)) !== null) {
      const spec = match[1] || match[2];
      const name = normalizePackageName(spec);
      if (name) pkgNames.add(name);
    }
  }

  const deps: Record<string, string> = {};
  for (const name of pkgNames) {
    if (baseDeps[name]) continue;
    deps[name] = "latest";
  }

  return deps;
}

function rewriteAliasImportsForFile(
  src: string | null | undefined,
  fromFilePath: string | null | undefined,
) {
  if (!src || typeof src !== "string") return src || "";
  if (!fromFilePath || typeof fromFilePath !== "string") return src;

  const fromDir = posixDirname(fromFilePath);
  return src.replace(/from\s+["']@\/([^"']+)["']/g, (_m, target) => {
    let normalizedTarget = target;

    // Special handling for Shadcn UI components which are lowercase in our sandpack-files
    if (target.startsWith("components/ui/")) {
      const parts = target.split("/");
      const last = parts.pop();
      if (last) {
        parts.push(last.toLowerCase());
        normalizedTarget = parts.join("/");
      }
    }

    const toPath = `/${String(normalizedTarget)}`;
    const rel = posixRelative(fromDir, toPath);
    return `from "${stripModuleExtension(rel)}"`;
  });
}

function stripForbiddenImports(src: string) {
  // We no longer strip lucide-react or framer-motion as they are now allowed.
  return src;
}

function repairMultilineJsxAttributeStrings(src: string) {
  // Common LLM failure: break JSX string props across lines, causing
  // "Unterminated string constant". Repair by collapsing newlines inside
  // a set of common JSX string attributes.
  const attrs = [
    "className",
    "title",
    "placeholder",
    "aria-label",
    "aria-description",
    "alt",
    "id",
    "htmlFor",
    "href",
    "src",
    "value",
    "name",
  ];

  const escapeRe = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const attrGroup = attrs.map(escapeRe).join("|");
  const re = new RegExp(`\\b(${attrGroup})\\s*=\\s*"([\\s\\S]*?)"`, "g");

  let out = src.replace(re, (_full, attrName, rawValue) => {
    const repaired = String(rawValue).replace(/\r?\n\s*/g, " ");
    return `${attrName}="${repaired}"`;
  });

  // Another common truncation: closing JSX tags missing the final `>` at end-of-line.
  out = out.replace(/<\/([A-Za-z][A-Za-z0-9]*)\s*(?=\r?\n|$)/g, "</$1>");
  return out;
}

function hasIdentifierDeclaration(src: string, name: string) {
  const patterns: Array<RegExp> = [
    new RegExp(String.raw`^\s*import\s+(?!type\b)[^;]*\b${name}\b[^;]*;?`, "m"),
    new RegExp(String.raw`^\s*const\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*let\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*var\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*function\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*class\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*export\s+function\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*export\s+class\s+${name}\b`, "m"),
  ];
  return patterns.some((p) => p.test(src));
}

function isJsxTagUsed(src: string, tagName: string) {
  return new RegExp(String.raw`<${tagName}\b`, "m").test(src);
}

function injectMissingImports(src: string) {
  const neededShadcn: Array<{ tag: string; importLine: string }> = [
    {
      tag: "Input",
      importLine: `import { Input } from "@/components/ui/input";`,
    },
    {
      tag: "Textarea",
      importLine: `import { Textarea } from "@/components/ui/textarea";`,
    },
    {
      tag: "Separator",
      importLine: `import { Separator } from "@/components/ui/separator";`,
    },
    {
      tag: "Badge",
      importLine: `import { Badge } from "@/components/ui/badge";`,
    },
  ];

  const neededOtherImports: Array<{ when: RegExp; importLine: string }> = [
    // React Router hooks are commonly used without imports.
    {
      when: /\buseLocation\s*\(/,
      importLine: `import { useLocation } from "react-router-dom";`,
    },
    {
      when: /\buseNavigate\s*\(/,
      importLine: `import { useNavigate } from "react-router-dom";`,
    },
    {
      when: /\buseParams\s*\(/,
      importLine: `import { useParams } from "react-router-dom";`,
    },
    {
      when: /\buseSearchParams\s*\(/,
      importLine: `import { useSearchParams } from "react-router-dom";`,
    },
    {
      when: /\buseMatch\s*\(/,
      importLine: `import { useMatch } from "react-router-dom";`,
    },
  ];

  const missingLines: string[] = [];

  for (const entry of neededShadcn) {
    if (
      isJsxTagUsed(src, entry.tag) &&
      !hasIdentifierDeclaration(src, entry.tag)
    ) {
      missingLines.push(entry.importLine);
    }
  }

  for (const entry of neededOtherImports) {
    const importedName = entry.importLine.match(/import\s*{\s*([^}\s,]+)/)?.[1];
    if (!importedName) continue;
    if (entry.when.test(src) && !hasIdentifierDeclaration(src, importedName)) {
      missingLines.push(entry.importLine);
    }
  }

  if (missingLines.length === 0) return src;

  const lines = src.split("\n");
  let insertAt = 0;
  if (lines[0]?.match(/^\s*["']use client["']\s*;?\s*$/)) {
    insertAt = 1;
    while (lines[insertAt] !== undefined && lines[insertAt].trim() === "")
      insertAt += 1;
  }

  lines.splice(insertAt, 0, ...missingLines);
  return lines.join("\n");
}

// Heuristic to find the primary component name and wrap it for Sandpack
function createAppFileFromCode(src: string) {
  src = repairMultilineJsxAttributeStrings(src);
  src = injectMissingImports(src);
  src = dedupeNamedImports(src);
  src = rewriteAliasImportsForFile(src, "/App.tsx");
  src = stripForbiddenImports(src);
  const componentNameFromSource = findPrimaryComponentName(src);

  // Remove/transform default exports so we can safely provide our own default App export.
  let defaultExportVar: string | null = null;
  let sanitized = src;
  sanitized = sanitized.replace(
    /^\s*export\s+default\s+function\s+/m,
    "function ",
  );
  sanitized = sanitized.replace(/^\s*export\s+default\s+class\s+/m, "class ");
  sanitized = sanitized.replace(
    /^\s*export\s+default\s+([A-Za-z0-9_]+)\s*;?\s*$/gm,
    "",
  );
  sanitized = sanitized.replace(
    /^\s*export\s+default\s+(.+?)\s*;?\s*$/m,
    (_full, expr) => {
      defaultExportVar = "__SandpackDefaultExport";
      return `const ${defaultExportVar} = ${expr};`;
    },
  );

  // Inject React import if missing (needed for React.useState, etc.)
  const hasReactImport =
    /import\s+(?:\*\s+as\s+)?React\s+from\s+["']react["']/.test(sanitized) ||
    /import\s+React\s*,/.test(sanitized);
  if (!hasReactImport) {
    sanitized = `import * as React from "react";\n` + sanitized;
  }

  const name =
    componentNameFromSource !== "GeneratedComponent"
      ? componentNameFromSource
      : (defaultExportVar ?? "GeneratedComponent");

  // Provide broad, safe defaults so components don't crash when props are omitted
  const defaultProps = `const __defaultProps = {
    title: "Preview",
    subtitle: "Subheadline",
    description: "Generated",
    items: [],
    features: [],
    links: [],
    stats: [],
    image: { src: "", alt: "" },
    avatar: { src: "", alt: "" },
    count: 0,
    percentage: 0,
    progress: 0,
    value: 0,
    className: ""
  };`;

  const wrapper = `\n\n${defaultProps}
export default function App(){
  const Comp: any = ${name};
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="w-full">
        {Comp ? <Comp {...__defaultProps} /> : (
          <div className="p-6">
            <div className="mx-auto max-w-2xl rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
              <h2 className="text-base font-semibold">Missing component export</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The generator did not produce a top-level React component we could render.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`;
  return sanitized + wrapper;
}

export function SandpackRuntimePreview({
  code,
  files,
  entryFile,
  className,
  title,
  colorScheme = defaultColorSchemeConfig,
  isDarkTheme = true,
  onPreviewUrlChange,
  onConsoleLogs,
}: SandpackPreviewProps) {
  // Use controlled state for Sandpack theme
  const [isFullscreen, setIsFullscreen] = useState(false);
  const baseDependencies = useMemo(
    () => ({
      react: "latest",
      "react-dom": "latest",
      clsx: "latest",
      "class-variance-authority": "latest",
      "tailwind-merge": "latest",
      "@radix-ui/react-slot": "latest",
      "@radix-ui/react-separator": "latest",
      "react-router-dom": "latest",
      axios: "latest",
      zustand: "latest",
      "@tanstack/react-query": "latest",
      "react-hook-form": "latest",
      zod: "latest",
      "lucide-react": "latest",
      "framer-motion": "latest",
    }),
    [],
  );

  const extractedDependencies = useMemo(() => {
    const sources: Array<string | undefined | null> = [];
    if (files && Object.keys(files).length > 0) {
      for (const src of Object.values(files)) sources.push(src);
    } else {
      sources.push(code);
    }
    return extractPackageDependencies(sources, baseDependencies);
  }, [files, code, baseDependencies]);

  const sandpackFiles = useMemo(() => {
    const normalizeGeneratedFiles = (input: Record<string, string>) => {
      const out: Record<string, string> = {};
      if (!input || typeof input !== "object") return out;

      for (const [k, v] of Object.entries(input)) {
        // Skip entries with null, undefined, or empty keys
        if (k === null || k === undefined || k === "" || typeof k !== "string")
          continue;
        // Skip entries with empty or non-string values
        if (!v || typeof v !== "string" || !v.trim()) continue;

        const normalized = k.startsWith("/") ? k : `/${k}`;
        out[normalized] = v;
      }
      return out;
    };

    const transformGeneratedFile = (
      path: string | null | undefined,
      src: string | null | undefined,
    ) => {
      if (!path || typeof path !== "string") return src || "";
      if (!src || typeof src !== "string") return "";

      try {
        let out = src;
        out = repairMultilineJsxAttributeStrings(out);
        out = injectMissingImports(out);
        out = dedupeNamedImports(out);
        out = rewriteAliasImportsForFile(out, path);
        out = stripForbiddenImports(out);
        return out;
      } catch (e) {
        console.error("Error transforming file:", path, e);
        return src;
      }
    };

    const createWrapperAppTsx = (entryPath: string) => {
      const safeEntry = entryPath ? entryPath.replace(/^\//, "") : "App";
      const importPath = stripModuleExtension(`./${safeEntry}`);
      return `import * as React from "react";
import Entry from "${importPath}";

export default function App(){
  const Comp: any = Entry;
  return (
    <div className="min-h-screen w-full bg-background text-foreground font-sans antialiased">
      <div className="w-full h-full">
        {Comp ? <Comp /> : (
          <div className="p-6">
            <div className="mx-auto max-w-2xl rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
              <h2 className="text-base font-semibold">Missing component export</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The generator did not produce a top-level React component we could render.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;
    };

    let appTsx: string;
    let generatedFiles: Record<string, string> | null = null;

    if (files && Object.keys(files).length > 0) {
      generatedFiles = normalizeGeneratedFiles(files);

      // Early return if no valid files after normalization
      if (!generatedFiles || Object.keys(generatedFiles).length === 0) {
        appTsx = createAppFileFromCode(code || "");
      } else {
        // Inject standard Shadcn components so they are available for import
        generatedFiles = { ...generatedFiles, ...SANDPACK_SHADCN_FILES };

        const transformed: Record<string, string> = {};
        for (const [path, src] of Object.entries(generatedFiles)) {
          // Double-check path is valid
          if (!path || typeof path !== "string") continue;
          if (!src || typeof src !== "string") continue;
          transformed[path] = transformGeneratedFile(path, src);
        }
        generatedFiles = transformed;

        // Find entry file with null safety
        const validKeys = Object.keys(generatedFiles).filter(
          (k) => k && typeof k === "string",
        );
        let entry: string | undefined =
          entryFile &&
            typeof entryFile === "string" &&
            generatedFiles[entryFile]
            ? entryFile
            : undefined;
        if (!entry && generatedFiles["/entry.tsx"]) entry = "/entry.tsx";
        if (!entry && generatedFiles["/App.tsx"]) entry = "/App.tsx";
        if (!entry && validKeys.length > 0) entry = validKeys[0];

        if (generatedFiles["/App.tsx"]) {
          const moved = generatedFiles["/GeneratedApp.tsx"]
            ? "/GeneratedApp_1.tsx"
            : "/GeneratedApp.tsx";
          generatedFiles[moved] = generatedFiles["/App.tsx"];
          delete generatedFiles["/App.tsx"];
          if (entry === "/App.tsx") entry = moved;
        }

        appTsx = createWrapperAppTsx(entry || "/App.tsx");
      }
    } else {
      appTsx = createAppFileFromCode(code || "");
    }

    // Generate the Tailwind v4 theme CSS from the color scheme
    const themeCSS = generateThemeCSS(colorScheme, isDarkTheme);

    const indexTsx = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Tailwind v4 theme CSS (generated from color scheme)
const tailwindTheme = ${JSON.stringify(themeCSS)};

// Create and inject the Tailwind theme style element
const styleEl = document.createElement("style");
styleEl.setAttribute("type", "text/tailwindcss");
styleEl.textContent = tailwindTheme;
document.head.appendChild(styleEl);

const root = createRoot(document.getElementById("root")!);
root.render(<App />);`;

    const indexHtml = `<!doctype html>
<html class="${isDarkTheme ? "dark" : ""}" lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    const indexCss = `/* Base styles */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;

    const tsconfig = JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        jsx: "react-jsx",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        lib: ["dom", "es2020"],
        baseUrl: ".",
        paths: {
          "@/*": ["./*"],
        },
      },
    });

    return {
      "/App.tsx": { code: String(appTsx) },
      "/index.tsx": { code: String(indexTsx) },
      "/index.css": { code: String(indexCss) },
      "/index.html": { code: String(indexHtml) },
      "/tsconfig.json": { code: String(tsconfig) },
      ...(generatedFiles
        ? Object.fromEntries(
          Object.entries(generatedFiles)
            .filter(
              ([path, src]) =>
                path && typeof path === "string" && typeof src === "string",
            )
            .map(([path, src]) => [path, { code: src }]),
        )
        : {}),
    } as const;
  }, [code, files, entryFile, isDarkTheme, colorScheme]);

  const FullscreenToggle = null;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <SandpackProvider
          template="react-ts"
          files={sandpackFiles}
          options={{
            visibleFiles: ["/App.tsx"],
            activeFile: "/App.tsx",
            externalResources: [
              "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
              "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
            ],
          }}
          customSetup={{
            dependencies: {
              ...baseDependencies,
              ...extractedDependencies,
            },
          }}
          theme={isDarkTheme ? amethyst : githubLight}
        >
          <SandpackPreviewUrlSync onUrlChange={onPreviewUrlChange} />
          <div className="relative h-screen flex flex-col">
            <SandpackLayout className="h-full w-full flex-1 min-h-0 border-0 rounded-none">
              <SandpackPreview
                showOpenInCodeSandbox={false}
                showRefreshButton={true}
                showRestartButton={true}
                className="h-full w-full flex-1 min-h-0"
                actionsChildren={
                  <div className="flex items-center gap-1">
                    {FullscreenToggle}
                  </div>
                }
              />
            </SandpackLayout>
          </div>
        </SandpackProvider>
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0", className)}>
      <SandpackProvider
        template="react-ts"
        files={sandpackFiles}
        options={{
          visibleFiles: ["/App.tsx"],
          activeFile: "/App.tsx",
          externalResources: [
            "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
            "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
          ],
        }}
        customSetup={{
          dependencies: {
            ...baseDependencies,
            ...extractedDependencies,
          },
        }}
        theme={isDarkTheme ? amethyst : githubLight}
      >
        <SandpackPreviewUrlSync onUrlChange={onPreviewUrlChange} />
        <SandpackLayout
          style={{
            position: "absolute",
            inset: 0,
            border: "none",
            borderRadius: 0,
            background: "transparent",
          }}
        >
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            showRestartButton={false}
            style={{
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
            }}
            actionsChildren={
              <div className="flex items-center gap-1 pr-1">
                {FullscreenToggle}
              </div>
            }
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
