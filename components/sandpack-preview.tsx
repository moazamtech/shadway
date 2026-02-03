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
import {
  SANDPACK_BASE_FILES,
  SANDPACK_SHADCN_FILES,
} from "@/lib/sandpack-files";

type SandpackPreviewProps = {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  className?: string;
  showConsole?: boolean;
  title?: string;
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
      .catch(() => {});

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
  const Comp: any = typeof ${name} !== "undefined" ? ${name} : null;
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="w-full">
        {Comp ? <Comp {...__defaultProps} /> : (
          <div className="flex flex-col items-center justify-center min-h-[500px] space-y-8 text-center px-6 py-24">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-orange-600/20 rounded-full animate-pulse" />
              <div className="text-6xl md:text-8xl animate-bounce">
                🔥
              </div>
            </div>
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground leading-[0.8]">
                vibecraft with shadway
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-medium tracking-tight">
                generate unique ideas web app in free
              </p>
              <div className="pt-6">
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-orange-600/10 border border-orange-600/20 text-orange-500 text-sm font-black uppercase tracking-[0.2em]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  your app is in cooking
                </div>
              </div>
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
  isDarkTheme = true,
  onPreviewUrlChange,
  onConsoleLogs,
}: SandpackPreviewProps) {
  // Use controlled state for Sandpack theme
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const baseDependencies = useMemo(
    () => ({
      react: "latest",
      "react-dom": "latest",
      "react-is": "latest",
      "prop-types": "latest",
      clsx: "latest",
      "class-variance-authority": "latest",
      "tailwind-merge": "latest",
      tailwindcss: "^4.0.0",
      "@tailwindcss/vite": "^4.0.0",
      vite: "^5.4.0",
      "@vitejs/plugin-react": "^4.3.0",
      "@radix-ui/react-slot": "latest",
      "@radix-ui/react-separator": "latest",
      "@radix-ui/react-avatar": "latest",
      "@radix-ui/react-label": "latest",
      "@radix-ui/react-switch": "latest",
      "@radix-ui/react-tabs": "latest",
      "@radix-ui/react-checkbox": "latest",
      "@radix-ui/react-slider": "latest",
      "@radix-ui/react-dialog": "latest",
      "@radix-ui/react-select": "latest",
      "react-router-dom": "latest",
      axios: "latest",
      zustand: "latest",
      "@tanstack/react-query": "latest",
      "react-hook-form": "latest",
      zod: "latest",
      "lucide-react": "latest",
      "framer-motion": "latest",
      motion: "latest",
      recharts: "latest",
      d3: "latest",
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
          <div className="flex flex-col items-center justify-center min-h-[500px] space-y-8 text-center px-6 py-24">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-orange-600/20 rounded-full animate-pulse" />
              <div className="text-6xl md:text-8xl animate-bounce">
                🔥
              </div>
            </div>
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground leading-[0.8]">
                vibecraft with shadway
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-medium tracking-tight">
                generate unique ideas web app in free
              </p>
              <div className="pt-6">
                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-orange-600/10 border border-orange-600/20 text-orange-500 text-sm font-black uppercase tracking-[0.2em]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  your app is in cooking
                </div>
              </div>
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
        // Inject base + Shadcn components so they are available for import
        // But allow generated files to override base files (especially index.css with custom fonts)
        const shadcnPaths = new Set(Object.keys(SANDPACK_SHADCN_FILES));
        const nonShadcnGeneratedFiles = Object.fromEntries(
          Object.entries(generatedFiles).filter(
            ([path]) => !shadcnPaths.has(path),
          ),
        );

        generatedFiles = {
          ...SANDPACK_BASE_FILES,
          ...SANDPACK_SHADCN_FILES,
          ...nonShadcnGeneratedFiles, // Generated files override base files
        };

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

    const TW_ANIMATE_CSS_URL =
      "https://cdn.jsdelivr.net/npm/tw-animate-css@1.4.0/dist/tw-animate.css";

    // Extract Google Fonts and tw-animate imports - check generated files first, then fallback to base
    const extractCssImports = (
      css: string,
    ): {
      fontLinks: string[];
      cleanedCss: string;
      extraResources: string[];
    } => {
      const fontLinks: string[] = [];
      const extraResources: string[] = [];
      const importMatches = css.match(
        /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^'"]+['"]\);?/g,
      );
      if (importMatches) {
        importMatches.forEach((match) => {
          const urlMatch = match.match(/url\(['"]([^'"]+)['"]\)/);
          if (urlMatch && urlMatch[1]) {
            fontLinks.push(urlMatch[1]);
          }
        });
      }

      const hasTwAnimate = /@import\s+["']tw-animate-css["']\s*;?/g.test(css);
      if (hasTwAnimate) extraResources.push(TW_ANIMATE_CSS_URL);

      // Remove @import statements for Google Fonts and tw-animate from CSS
      let cleanedCss = css.replace(
        /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^'"]+['"]\);?\s*/g,
        "",
      );
      cleanedCss = cleanedCss.replace(
        /@import\s+["']tw-animate-css["']\s*;?\s*/g,
        "",
      );

      return { fontLinks, cleanedCss, extraResources };
    };

    // Check generated files for index.css first, then fallback to base
    let finalIndexCss =
      generatedFiles?.["/index.css"] || SANDPACK_BASE_FILES["/index.css"];

    const {
      fontLinks: googleFontLinks,
      cleanedCss,
      extraResources,
    } = finalIndexCss
      ? extractCssImports(finalIndexCss)
      : { fontLinks: [], cleanedCss: finalIndexCss, extraResources: [] };

    // Use the cleaned CSS without @import statements
    finalIndexCss = cleanedCss;

    const indexCssInjected = finalIndexCss
      ? `const styleEl = document.createElement("style");
styleEl.setAttribute("type", "text/tailwindcss");
styleEl.textContent = ${JSON.stringify(finalIndexCss)};
document.head.appendChild(styleEl);`
      : "";

    // Create font link injection code
    const fontLinkInjection =
      googleFontLinks.length > 0
        ? googleFontLinks
            .map(
              (url) => `
const fontLink${googleFontLinks.indexOf(url)} = document.createElement("link");
fontLink${googleFontLinks.indexOf(url)}.rel = "stylesheet";
fontLink${googleFontLinks.indexOf(url)}.href = "${url}";
document.head.appendChild(fontLink${googleFontLinks.indexOf(url)});
`,
            )
            .join("\n")
        : "";

    const preconnectInjection =
      googleFontLinks.length > 0
        ? `
const preconnect = document.createElement("link");
preconnect.rel = "preconnect";
preconnect.href = "https://fonts.googleapis.com";
document.head.appendChild(preconnect);

const preconnectCrossorigin = document.createElement("link");
preconnectCrossorigin.rel = "preconnect";
preconnectCrossorigin.href = "https://fonts.gstatic.com";
preconnectCrossorigin.crossOrigin = "anonymous";
document.head.appendChild(preconnectCrossorigin);
`
        : "";

    const indexTsx = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

${preconnectInjection}
${fontLinkInjection}
${indexCssInjected}

const setTheme = (dark: boolean) => {
  document.documentElement.classList.toggle("dark", !!dark);
};

window.addEventListener("message", (event) => {
  const data = (event && (event as MessageEvent).data) || {};
  if (data && data.type === "SP_THEME") {
    setTheme(!!data.dark);
  }
});

const refreshTailwind = () => {
  const tw = (window as any).tailwind;
  if (tw && typeof tw.refresh === "function") {
    tw.refresh();
    return true;
  }
  return false;
};

if (!refreshTailwind()) {
  const retry = setInterval(() => {
    if (refreshTailwind()) clearInterval(retry);
  }, 200);
  setTimeout(() => clearInterval(retry), 2000);
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);`;

    const indexHtml = `<!doctype html>
<html class="${isDarkTheme ? "dark" : ""}" lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

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

    const baseFilesForReturn = Object.fromEntries(
      Object.entries({
        ...SANDPACK_BASE_FILES,
        ...SANDPACK_SHADCN_FILES,
      })
        .filter(([path]) => path !== "/index.css")
        .map(([path, src]) => [path, { code: src }]),
    );

    return {
      files: {
        "/App.tsx": { code: String(appTsx) },
        "/index.tsx": { code: String(indexTsx) },
        "/index.css": { code: String(finalIndexCss || "") },
        "/index.html": { code: String(indexHtml) },
        "/tsconfig.json": { code: String(tsconfig) },
        ...baseFilesForReturn,
        ...(generatedFiles
          ? Object.fromEntries(
              Object.entries(generatedFiles)
                .filter(
                  ([path, src]) =>
                    path &&
                    typeof path === "string" &&
                    typeof src === "string" &&
                    path !== "/index.css",
                )
                .map(([path, src]) => [path, { code: src }]),
            )
          : {}),
      },
      externalResources: [...googleFontLinks, ...extraResources],
    };
  }, [code, files, entryFile, isDarkTheme]);

  const FullscreenToggle = null;

  React.useEffect(() => {
    let cancelled = false;
    const applyTheme = () => {
      if (cancelled) return;
      const iframe =
        iframeRef.current ||
        (previewRef.current?.querySelector(
          "iframe",
        ) as HTMLIFrameElement | null);
      if (!iframe) {
        setTimeout(applyTheme, 200);
        return;
      }
      iframeRef.current = iframe;
      const doc = iframe.contentDocument;
      if (doc?.documentElement) {
        doc.documentElement.classList.toggle("dark", isDarkTheme);
      }
      iframe.contentWindow?.postMessage(
        { type: "SP_THEME", dark: isDarkTheme },
        "*",
      );
    };
    applyTheme();
    return () => {
      cancelled = true;
    };
  }, [isDarkTheme, sandpackFiles]);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <SandpackProvider
          template="react-ts"
          files={sandpackFiles.files}
          options={{
            visibleFiles: ["/App.tsx"],
            activeFile: "/App.tsx",
            externalResources: [
              "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
              ...sandpackFiles.externalResources,
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
              <div ref={previewRef} className="relative h-full w-full">
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
              </div>
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
        files={sandpackFiles.files}
        options={{
          visibleFiles: ["/App.tsx"],
          activeFile: "/App.tsx",
          externalResources: [
            "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
            ...sandpackFiles.externalResources,
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
          <div ref={previewRef} className="absolute inset-0">
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
          </div>
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
