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
  }

  .sandpack-inner {
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    flex: 1 !important;
    min-height: 0 !important;
  }

  .sp-layout {
    width: 100% !important;
    height: 100% !important;
    flex: 1 !important;
    min-height: 559% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .sp-preview {
    flex: 1 !important;
    min-height: 0 !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  .sp-preview-iframe {
    flex: 1 !important;
    min-height: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
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
  code: string;
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

function rewriteSandboxImports(src: string) {
  // Sandpack bundlers don't consistently respect TS path aliases. Rewrite common @/ imports to relative paths.
  const replacements: Array<[RegExp, string]> = [
    [/from\s+["']@\/lib\/utils["']/g, 'from "./lib/utils"'],
    [/from\s+["']@\/lib\/cn["']/g, 'from "./lib/cn"'],
    [/from\s+["']@\/components\/ui\//g, 'from "./components/ui/'],
  ];
  let out = src;
  for (const [pattern, value] of replacements)
    out = out.replace(pattern, value);
  return out;
}

function rewriteLucideImports(src: string) {
  // lucide-react does not include brand icons; rewrite common brand requests to safe equivalents.
  const aliasMap: Record<string, string> = {
    // Common "missing" icon names (vary across lucide versions)
    Coin: "Coins",
    Dog: "PawPrint",
    Cat: "PawPrint",
    PartyPopper: "Sparkles",

    Discord: "MessageCircle",
    Telegram: "Send",
    Instagram: "Camera",
    Twitter: "Twitter",
  };

  const jsxUsed = new Set<string>();
  const tagRegex = /<([A-Z][A-Za-z0-9_]*)\b/g;
  for (const match of src.matchAll(tagRegex)) {
    if (match[1]) jsxUsed.add(match[1]);
  }

  return src.replace(
    /import\s*{\s*([\s\S]*?)\s*}\s*from\s*["']lucide-react["']\s*;?/g,
    (_full, rawImports) => {
      const parts = String(rawImports)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const seenLocals = new Set<string>();
      const rewritten: string[] = [];

      for (const part of parts) {
        const asMatch = part.match(/^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/);
        const importedName = (asMatch?.[1] || part).trim();
        const localName = (asMatch?.[2] || part).trim();

        // Drop unused icons to avoid importing non-existent/huge lists.
        if (!jsxUsed.has(localName)) continue;

        const mappedImport = aliasMap[importedName] || importedName;
        const mappedLocal = localName;

        // Avoid duplicate local bindings (causes "Identifier has already been declared")
        if (seenLocals.has(mappedLocal)) continue;
        seenLocals.add(mappedLocal);

        if (mappedImport === mappedLocal) rewritten.push(mappedImport);
        else rewritten.push(`${mappedImport} as ${mappedLocal}`);
      }

      if (rewritten.length === 0) return "";

      // Keep imports reasonably small; if too many, keep the first N (already filtered by usage)
      const capped = rewritten.slice(0, 40);
      return `import { ${capped.join(", ")} } from "lucide-react";`;
    },
  );
}

function hasIdentifierDeclaration(src: string, name: string) {
  const patterns: Array<RegExp> = [
    new RegExp(String.raw`^\s*import\s+[^;]*\b${name}\b[^;]*;?`, "m"),
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

  const neededLucideIcons = ["Check"];

  const missingLines: string[] = [];

  for (const entry of neededShadcn) {
    if (
      isJsxTagUsed(src, entry.tag) &&
      !hasIdentifierDeclaration(src, entry.tag)
    ) {
      missingLines.push(entry.importLine);
    }
  }

  for (const iconName of neededLucideIcons) {
    if (
      isJsxTagUsed(src, iconName) &&
      !hasIdentifierDeclaration(src, iconName)
    ) {
      missingLines.push(`import { ${iconName} } from "lucide-react";`);
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
  src = injectMissingImports(src);
  src = rewriteSandboxImports(src);
  src = rewriteLucideImports(src);
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
class __SandpackErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }>{
  constructor(props: { children: React.ReactNode }){
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error){
    return { error };
  }
  render(){
    if (this.state.error){
      return (
        <div className="min-h-screen w-full bg-background text-foreground p-6">
          <div className="mx-auto max-w-2xl rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
            <h2 className="text-base font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The preview crashed while rendering the generated component.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
{String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){
  const Comp: any = ${name};
  return (
    <__SandpackErrorBoundary>
      <div className="min-h-screen w-full bg-background text-foreground">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">
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
    </__SandpackErrorBoundary>
  );
}`;
  return sanitized + wrapper;
}

export function SandpackRuntimePreview({
  code,
  className,
  showConsole = false,
}: SandpackPreviewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isFullscreen, setIsFullscreen] = useState(false);

  React.useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = sandpackStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const files = useMemo(() => {
    const appTsx = createAppFileFromCode(code);

    const indexTsx = `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport { initTwind } from "./twind";\nimport "./index.css";\n\n// Initialize Twind runtime Tailwind support (no CDN, no PostCSS)\ninitTwind();\n\nconst root = createRoot(document.getElementById("root")!);\nroot.render(<App />);`;

    const indexHtml = `<!doctype html>\n<html class=\"${isDark ? "dark" : ""}\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <meta name=\"color-scheme\" content=\"${isDark ? "dark" : "light"}\" />\n    <title>Sandpack Preview</title>\n  </head>\n  <body class=\"min-h-screen w-full\">\n    <div id=\"root\"></div>\n  </body>\n</html>`;

    const indexCss = `/* Shadcn Color Scheme Variables */
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
  --ring: 0 0% 63.9%;
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

/* Base styles */
* {
  box-sizing: border-box;
  border-color: hsl(var(--border));
}

html {
  color-scheme: light dark;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
  overflow: auto;
}

/* Hide scrollbars (keep scroll) */
html, body {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar {
  display: none;
}

html, body, #root {
  height: 100%;
  width: 100%;
}

#root {
  display: flex;
  min-height: 100%;
  min-width: 0;
}

main, section, div {
  min-width: 0;
}

/* Utility classes for Shadcn colors */
.bg-background { background-color: hsl(var(--background)); }
.bg-foreground { background-color: hsl(var(--foreground)); }
.bg-card { background-color: hsl(var(--card)); }
.bg-card-foreground { background-color: hsl(var(--card-foreground)); }
.bg-popover { background-color: hsl(var(--popover)); }
.bg-popover-foreground { background-color: hsl(var(--popover-foreground)); }
.bg-primary { background-color: hsl(var(--primary)); }
.bg-primary-foreground { background-color: hsl(var(--primary-foreground)); }
.bg-secondary { background-color: hsl(var(--secondary)); }
.bg-secondary-foreground { background-color: hsl(var(--secondary-foreground)); }
.bg-muted { background-color: hsl(var(--muted)); }
.bg-muted-foreground { background-color: hsl(var(--muted-foreground)); }
.bg-accent { background-color: hsl(var(--accent)); }
.bg-accent-foreground { background-color: hsl(var(--accent-foreground)); }
.bg-destructive { background-color: hsl(var(--destructive)); }
.bg-destructive-foreground { background-color: hsl(var(--destructive-foreground)); }

.text-background { color: hsl(var(--background)); }
.text-foreground { color: hsl(var(--foreground)); }
.text-card { color: hsl(var(--card)); }
.text-card-foreground { color: hsl(var(--card-foreground)); }
.text-popover { color: hsl(var(--popover)); }
.text-popover-foreground { color: hsl(var(--popover-foreground)); }
.text-primary { color: hsl(var(--primary)); }
.text-primary-foreground { color: hsl(var(--primary-foreground)); }
.text-secondary { color: hsl(var(--secondary)); }
.text-secondary-foreground { color: hsl(var(--secondary-foreground)); }
.text-muted { color: hsl(var(--muted)); }
.text-muted-foreground { color: hsl(var(--muted-foreground)); }
.text-accent { color: hsl(var(--accent)); }
.text-accent-foreground { color: hsl(var(--accent-foreground)); }
.text-destructive { color: hsl(var(--destructive)); }
.text-destructive-foreground { color: hsl(var(--destructive-foreground)); }

.border-border { border-color: hsl(var(--border)); }
.border-input { border-color: hsl(var(--input)); }

.ring-ring { --tw-ring-color: hsl(var(--ring)); }

/* Opacity modifiers */
.bg-primary\/90 { background-color: hsl(var(--primary) / 0.9); }
.bg-primary\/80 { background-color: hsl(var(--primary) / 0.8); }
.bg-secondary\/80 { background-color: hsl(var(--secondary) / 0.8); }
.bg-accent\/90 { background-color: hsl(var(--accent) / 0.9); }

/* Force full width */
.container {
  max-width: 100% !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}

[class*="max-w-"] {
  max-width: 100% !important;
}

.mx-auto {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
`;

    const twindTs = `import { setup } from '@twind/core'\nimport presetTailwind from '@twind/preset-tailwind'\n\nexport function initTwind(){\n  setup({\n    presets: [presetTailwind({ darkMode: 'class' })],\n    hash: false,\n  })\n}`;

    const pkgJson = `{\n  \"name\": \"sandpack-runtime\",\n  \"private\": true,\n  \"dependencies\": {\n    \"@twind/core\": \"^1.0.0-next.41\",\n    \"@twind/preset-tailwind\": \"^1.0.0-next.41\"\n  }\n}`;

    const cnUtil = `export function cn(...classes: Array<string | false | null | undefined>) {\n  return classes.filter(Boolean).join(' ');\n}`;

    const utilsTs = `import { cn } from "./cn";\n\nexport { cn };\n`;

    const buttonTsx = `import React from 'react';\nimport { cn } from '../lib/cn';\nexport type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {\n  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';\n  size?: 'default' | 'sm' | 'lg' | 'icon';\n};\nexport function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps){\n  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none';\n  const variants = {\n    default: 'bg-primary text-primary-foreground hover:bg-primary/90',\n    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',\n    outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',\n    ghost: 'hover:bg-accent hover:text-accent-foreground',\n    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'\n  };\n  const sizes = {\n    default: 'h-10 px-4 py-2',\n    sm: 'h-9 px-3 rounded-md',\n    lg: 'h-11 px-8 rounded-md',\n    icon: 'h-10 w-10'\n  };\n  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;\n}`;

    const cardTsx = `import React from 'react';\nimport { cn } from '../lib/cn';\nexport function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />;\n}\nexport function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;\n}\nexport function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>){\n  return <h3 className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;\n}\nexport function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>){\n  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;\n}\nexport function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('p-6 pt-0', className)} {...props} />;\n}\nexport function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;\n}`;

    const componentsButtonTsx = `export { Button } from "../../ui/button";\nexport type { ButtonProps } from "../../ui/button";\n`;

    const componentsCardTsx = `export * from "../../ui/card";\n`;

    const componentsBadgeTsx = `import React from 'react';\nimport { cn } from '../../lib/cn';\nexport type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' };\nexport function Badge({ className, variant = 'default', ...props }: BadgeProps){\n  const base = 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';\n  const variants = {\n    default: 'border-transparent bg-primary text-primary-foreground',\n    secondary: 'border-transparent bg-secondary text-secondary-foreground',\n    destructive: 'border-transparent bg-destructive text-destructive-foreground',\n    outline: 'text-foreground'\n  };\n  return <span className={cn(base, variants[variant], className)} {...props} />;\n}\n`;

    const componentsInputTsx = `import React from 'react';\nimport { cn } from '../../lib/cn';\nexport type InputProps = React.InputHTMLAttributes<HTMLInputElement>;\nexport const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {\n  return (\n    <input\n      ref={ref}\n      type={type}\n      className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}\n      {...props}\n    />\n  );\n});\nInput.displayName = 'Input';\n`;

    const componentsTextareaTsx = `import React from 'react';\nimport { cn } from '../../lib/cn';\nexport type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;\nexport const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {\n  return (\n    <textarea\n      ref={ref}\n      className={cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)}\n      {...props}\n    />\n  );\n});\nTextarea.displayName = 'Textarea';\n`;

    const componentsSeparatorTsx = `import React from 'react';\nimport { cn } from '../../lib/cn';\nexport type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical'; decorative?: boolean };\nexport function Separator({ className, orientation = 'horizontal', decorative = true, ...props }: SeparatorProps){\n  return (\n    <div\n      role={decorative ? 'none' : 'separator'}\n      aria-orientation={orientation}\n      className={cn(orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', 'shrink-0 bg-border', className)}\n      {...props}\n    />\n  );\n}\n`;

    const tsconfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["dom", "es2020"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}`;

    return {
      "/App.tsx": { code: appTsx },
      "/index.tsx": { code: indexTsx },
      "/index.css": { code: indexCss },
      "/index.html": { code: indexHtml },
      "/twind.ts": { code: twindTs },
      "/package.json": { code: pkgJson },
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
    } as const;
  }, [code, isDark, SANDBOX_TRANSFORM_VERSION]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <SandpackProvider
          template="react-ts"
          files={files}
          options={{
            visibleFiles: ["/App.tsx"],
            activeFile: "/App.tsx",
          }}
          customSetup={{
            dependencies: {
              react: "latest",
              "react-dom": "latest",
              "lucide-react": "0.544.0",
              clsx: "latest",
              "class-variance-authority": "latest",
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
    <div className={cn("sandpack-wrapper", className)}>
      <SandpackProvider
        template="react-ts"
        files={files}
        options={{
          visibleFiles: ["/App.tsx"],
          activeFile: "/App.tsx",
        }}
        customSetup={{
          dependencies: {
            react: "latest",
            "react-dom": "latest",
            "lucide-react": "0.544.0",
            clsx: "latest",
            "class-variance-authority": "latest",
          },
        }}
        theme={isDark ? amethyst : githubLight}
      >
        <div className="sandpack-inner">
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

          <SandpackLayout className="sp-layout">
            <SandpackPreview
              showOpenInCodeSandbox={true}
              showRefreshButton={true}
              showRestartButton={true}
            />
          </SandpackLayout>
        </div>
      </SandpackProvider>
    </div>
  );
}
