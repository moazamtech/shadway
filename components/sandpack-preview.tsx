"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackConsole,
} from "@codesandbox/sandpack-react";
import { githubLight, amethyst } from "@codesandbox/sandpack-themes";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SANDPACK_SHADCN_FILES } from "@/lib/sandpack-files";

const SANDBOX_TRANSFORM_VERSION = 4;

const sandpackStyles = `
  * {
    box-sizing: border-box !important;
  }

  .sandpack-wrapper {
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    position: relative !important;
  }

  .sandpack-inner {
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 0% !important;
    min-height: 0 !important;
    position: relative !important;
  }

  .sp-layout {
    width: 100% !important;
    height: 100% !important;
    flex: 1 1 0% !important;
    min-height: 600px !important;
    display: flex !important;
    flex-direction: column !important;
    border: none !important;
    border-radius: 0 !important;
  }

  .sp-stack {
    height: 100% !important;
    flex: 1 1 0% !important;
    min-height: 0 !important;
  }

  .sp-preview-container {
    flex: 1 1 0% !important;
    min-height: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .sp-preview {
    flex: 1 1 0% !important;
    min-height: 0 !important;
    height: 100% !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  .sp-preview-iframe {
    flex: 1 1 0% !important;
    min-height: 0 !important;
    height: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
  }

  .sp-preview-actions {
    display: none !important;
  }

  iframe {
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* Hide scrollbars on Sandpack container */
  .sp-code-editor {
    overflow: hidden !important;
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }

  .sp-code-editor::-webkit-scrollbar {
    display: none !important;
  }

  /* Hide scrollbars in preview pane */
  .sp-preview,
  .sp-preview > * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  .sp-preview::-webkit-scrollbar,
  .sp-preview > *::-webkit-scrollbar {
    display: none !important;
  }
`;

type SandpackPreviewProps = {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  className?: string;
  showConsole?: boolean;
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
  if (!pathname || typeof pathname !== 'string') return "/";
  const normalized = pathname.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return "/";
  return normalized.slice(0, idx);
}

function posixRelative(fromDir: string | null | undefined, toPath: string | null | undefined) {
  if (!fromDir || typeof fromDir !== 'string') return toPath || ".";
  if (!toPath || typeof toPath !== 'string') return ".";

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

function stripModuleExtension(p: string) {
  return p.replace(/\.(tsx|ts|jsx|js)$/i, "");
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

function rewriteAliasImportsForFile(src: string | null | undefined, fromFilePath: string | null | undefined) {
  if (!src || typeof src !== 'string') return src || "";
  if (!fromFilePath || typeof fromFilePath !== 'string') return src;

  const fromDir = posixDirname(fromFilePath);
  return src.replace(/from\s+["']@\/([^"']+)["']/g, (_m, target) => {
    const toPath = `/${String(target)}`;
    const rel = posixRelative(fromDir, toPath);
    return `from "${stripModuleExtension(rel)}"`;
  });
}

function stripForbiddenImports(src: string) {
  // Remove lucide-react and framer-motion imports entirely.
  let out = src;
  out = out.replace(
    /import\s+[\s\S]*?from\s*["']lucide-react["']\s*;?/g,
    "// lucide-react import removed (use inline SVGs)",
  );
  out = out.replace(
    /import\s+[\s\S]*?from\s*["']framer-motion["']\s*;?/g,
    "// framer-motion import removed",
  );
  return out;
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

function hasNamedImportFromModule(
  src: string,
  name: string,
  moduleName: string,
) {
  const pattern = new RegExp(
    String.raw`^\s*import\s+(?!type\b)[^;]*\b${name}\b[^;]*from\s+["']${moduleName}["']\s*;?`,
    "m",
  );
  return pattern.test(src);
}

function hasNamespaceImportFromModule(
  src: string,
  name: string,
  moduleName: string,
) {
  const pattern = new RegExp(
    String.raw`^\s*import\s+(?!type\b)\*\s+as\s+${name}\s+from\s+["']${moduleName}["']\s*;?`,
    "m",
  );
  return pattern.test(src);
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
  showConsole = false,
}: SandpackPreviewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
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
      "lucide-react": "latest", // Re-adding lucide-react as it is often requested, but we strip imports if needed. actually user said NO lucide.
      // Keeping it out if user said no.
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

  React.useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = sandpackStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const sandpackFiles = useMemo(() => {
    const normalizeGeneratedFiles = (input: Record<string, string>) => {
      const out: Record<string, string> = {};
      if (!input || typeof input !== 'object') return out;

      for (const [k, v] of Object.entries(input)) {
        // Skip entries with null, undefined, or empty keys
        if (k === null || k === undefined || k === '' || typeof k !== 'string') continue;
        // Skip entries with empty or non-string values
        if (!v || typeof v !== 'string' || !v.trim()) continue;

        const normalized = k.startsWith("/") ? k : `/${k}`;
        out[normalized] = v;
      }
      return out;
    };

    const transformGeneratedFile = (path: string | null | undefined, src: string | null | undefined) => {
      if (!path || typeof path !== 'string') return src || "";
      if (!src || typeof src !== 'string') return "";

      try {
        let out = src;
        out = repairMultilineJsxAttributeStrings(out);
        out = injectMissingImports(out);
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
          if (!path || typeof path !== 'string') continue;
          if (!src || typeof src !== 'string') continue;
          transformed[path] = transformGeneratedFile(path, src);
        }
        generatedFiles = transformed;

        // Find entry file with null safety
        const validKeys = Object.keys(generatedFiles).filter(k => k && typeof k === 'string');
        let entry: string | undefined =
          entryFile && typeof entryFile === 'string' && generatedFiles[entryFile] ? entryFile : undefined;
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

    const indexTsx = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);`;

    const indexHtml = `<!doctype html>
<html class="${isDark ? "dark" : ""}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandpack Preview</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              background: 'hsl(var(--background))',
              foreground: 'hsl(var(--foreground))',
              card: 'hsl(var(--card))',
              'card-foreground': 'hsl(var(--card-foreground))',
              popover: 'hsl(var(--popover))',
              'popover-foreground': 'hsl(var(--popover-foreground))',
              primary: 'hsl(var(--primary))',
              'primary-foreground': 'hsl(var(--primary-foreground))',
              secondary: 'hsl(var(--secondary))',
              'secondary-foreground': 'hsl(var(--secondary-foreground))',
              muted: 'hsl(var(--muted))',
              'muted-foreground': 'hsl(var(--muted-foreground))',
              accent: 'hsl(var(--accent))',
              'accent-foreground': 'hsl(var(--accent-foreground))',
              destructive: 'hsl(var(--destructive))',
              'destructive-foreground': 'hsl(var(--destructive-foreground))',
              border: 'hsl(var(--border))',
              input: 'hsl(var(--input))',
              ring: 'hsl(var(--ring))',
            },
            borderRadius: {
              sm: 'calc(var(--radius) - 2px)',
              md: 'var(--radius)',
              lg: 'calc(var(--radius) + 2px)',
            },
            fontFamily: {
              sans: ['Inter', 'system-ui', 'sans-serif'],
            },
          },
        },
      }
    </script>
    <style>
      :root {
        --background: 0 0% 100%;
        --foreground: 0 0% 3.9%;
        --card: 0 0% 100%;
        --card-foreground: 0 0% 3.9%;
        --popover: 0 0% 100%;
        --popover-foreground: 0 0% 3.9%;
        --primary: 0 0% 9%;
        --primary-foreground: 0 0% 98%;
        --secondary: 0 0% 96.1%;
        --secondary-foreground: 0 0% 9%;
        --muted: 0 0% 96.1%;
        --muted-foreground: 0 0% 45.1%;
        --accent: 0 0% 96.1%;
        --accent-foreground: 0 0% 9%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 0 0% 98%;
        --border: 0 0% 89.8%;
        --input: 0 0% 89.8%;
        --ring: 0 0% 3.9%;
        --radius: 0.5rem;
      }
      
      .dark {
        --background: 0 0% 3.9%;
        --foreground: 0 0% 98%;
        --card: 0 0% 3.9%;
        --card-foreground: 0 0% 98%;
        --popover: 0 0% 3.9%;
        --popover-foreground: 0 0% 98%;
        --primary: 0 0% 98%;
        --primary-foreground: 0 0% 9%;
        --secondary: 0 0% 14.9%;
        --secondary-foreground: 0 0% 98%;
        --muted: 0 0% 14.9%;
        --muted-foreground: 0 0% 63.9%;
        --accent: 0 0% 14.9%;
        --accent-foreground: 0 0% 98%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 0 0% 98%;
        --border: 0 0% 14.9%;
        --input: 0 0% 14.9%;
        --ring: 0 0% 83.1%;
      }
      
      *, *::before, *::after {
        border-color: hsl(var(--border));
      }
      
      body {
        font-family: 'Inter', system-ui, sans-serif;
        background-color: hsl(var(--background));
        color: hsl(var(--foreground));
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body class="min-h-screen w-full bg-background text-foreground font-sans antialiased">
    <div id="root"></div>
  </body>
</html>`;

    // indexCss is minimal since Tailwind is loaded via CDN
    const indexCss = `/* Tailwind CSS is loaded via CDN in index.html with tailwind.config */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
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

    const cnUtil = `export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}`;

    const utilsTs = `import { cn } from "./cn";
export { cn };`;

    const buttonTsx = `import React from 'react';
import { cn } from '../lib/cn';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};
export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  };
  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 px-3 rounded-md',
    lg: 'h-11 px-8 rounded-md',
    icon: 'h-10 w-10'
  };
  return <button className={cn(base, variants[variant as keyof typeof variants], sizes[size as keyof typeof sizes], className)} {...props} />;
}`;

    const cardTsx = `import React from 'react';
import { cn } from '../lib/cn';
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}`;

    const componentsButtonTsx = `export { Button } from "../../ui/button";
export type { ButtonProps } from "../../ui/button";`;

    const componentsCardTsx = `export * from "../../ui/card";`;

    const componentsBadgeTsx = `import React from 'react';
import { cn } from '../../lib/cn';
export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' };
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base = 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground',
    outline: 'text-foreground'
  };
  return <span className={cn(base, variants[variant as keyof typeof variants], className)} {...props} />;
}`;

    const componentsInputTsx = `import React from 'react';
import { cn } from '../../lib/cn';
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    />
  );
});
Input.displayName = 'Input';`;

    const componentsTextareaTsx = `import React from 'react';
import { cn } from '../../lib/cn';
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';`;

    const twindTs = `import { setup } from '@twind/core';
import presetTailwind from '@twind/preset-tailwind';

export function initTwind() {
  setup({
    presets: [presetTailwind({ darkMode: 'class' })],
    hash: false,
  });
}`;

    const componentsSeparatorTsx = `import React from 'react';
import { cn } from '../../lib/cn';
export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical'; decorative?: boolean };
export function Separator({ className, orientation = 'horizontal', decorative = true, ...props }: SeparatorProps) {
  return (
    <div
      role={decorative ? 'none' : 'separator'}
      aria-orientation={orientation}
      className={cn(orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', 'shrink-0 bg-border', className)}
      {...props}
    />
  );
}`;

    return {
      "/App.tsx": { code: appTsx },
      "/index.tsx": { code: indexTsx },
      "/index.css": { code: indexCss },
      "/index.html": { code: indexHtml },
      "/twind.ts": { code: twindTs },
      "/tsconfig.json": { code: tsconfig },
      "/lib/cn.ts": { code: cnUtil },
      "/lib/utils.ts": { code: utilsTs },
      "/ui/button.tsx": { code: buttonTsx },
      "/ui/card.tsx": { code: cardTsx },
      "/components/ui/button.tsx": { code: componentsButtonTsx },
      "/components/ui/card.tsx": { code: componentsCardTsx },
      "/components/ui/badge.tsx": { code: componentsBadgeTsx },
      "/components/ui/input.tsx": { code: componentsInputTsx },
      "/components/ui/textarea.tsx": { code: componentsTextareaTsx },
      "/components/ui/separator.tsx": { code: componentsSeparatorTsx },
      ...(generatedFiles
        ? Object.fromEntries(
          Object.entries(generatedFiles)
            .filter(([path, src]) => path && typeof path === 'string' && src && typeof src === 'string')
            .map(([path, src]) => [
              path,
              { code: src },
            ]),
        )
        : {}),
    } as const;
  }, [code, files, entryFile, isDark, SANDBOX_TRANSFORM_VERSION]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

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
              "https://cdn.tailwindcss.com",
            ],
          }}
          customSetup={{
            dependencies: {
              ...baseDependencies,
              ...extractedDependencies,
            },
          }}
          theme={isDark ? amethyst : githubLight}
        >
          <div className="relative h-screen flex flex-col">
            {/* Fullscreen Toggle Button */}
            <div className="absolute top-3 right-3 z-20 bg-background/90 backdrop-blur-sm rounded-lg shadow-md">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-9 w-9 hover:bg-accent"
                title="Exit fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>

            <SandpackLayout className="!h-screen !border-0">
              <SandpackPreview
                showOpenInCodeSandbox={false}
                showRefreshButton={true}
                showRestartButton={true}
              />
            </SandpackLayout>
          </div>
        </SandpackProvider>
      </div>
    );
  }

  return (
    <div className={cn("sandpack-wrapper h-full w-full", className)} style={{ minHeight: 0, flex: '1 1 0%' }}>
      <SandpackProvider
        template="react-ts"
        files={sandpackFiles}
        options={{
          visibleFiles: ["/App.tsx"],
          activeFile: "/App.tsx",
          externalResources: [
            "https://cdn.tailwindcss.com",
          ],
        }}
        customSetup={{
          dependencies: {
            ...baseDependencies,
            ...extractedDependencies,
          },
        }}
        theme={isDark ? amethyst : githubLight}
      >
        <div className="sandpack-inner h-full w-full" style={{ minHeight: 0, flex: '1 1 0%' }}>
          {/* Fullscreen Toggle Button */}
          <div
            className={cn(
              "absolute top-3 right-3 z-20",
              isDark ? "bg-neutral-800/90" : "bg-white/90",
              "backdrop-blur-sm rounded-lg shadow-md",
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-9 w-9 hover:bg-accent"
              title="Enter fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          <SandpackLayout style={{ height: '100%', flex: '1 1 0%', minHeight: 0, border: 'none', borderRadius: 0 }}>
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton={true}
              showRestartButton={false}
              style={{ height: '100%', flex: '1 1 0%', minHeight: 0 }}
            />
          </SandpackLayout>
        </div>
      </SandpackProvider>
    </div>
  );
}
