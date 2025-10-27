"use client";

import React, { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  SandpackConsole,
} from "@codesandbox/sandpack-react";
import { githubLight, amethyst  } from "@codesandbox/sandpack-themes";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SandpackPreviewProps = {
  code: string;
  className?: string;
  showConsole?: boolean;
};

// Heuristic to find the primary component name and wrap it for Sandpack
function createAppFileFromCode(src: string) {
  // remove any export default to avoid duplicate defaults
  let sanitized = src.replace(/export\s+default\s+/g, "");

  // Inject React import if missing (needed for React.useState, etc.)
  const hasReactImport = /import\s+(?:\*\s+as\s+)?React\s+from\s+["']react["']/.test(sanitized) || /import\s+React\s*,/.test(sanitized);
  if (!hasReactImport) {
    sanitized = `import * as React from "react";\n` + sanitized;
  }

  const fnMatch = sanitized.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
  const constMatch = sanitized.match(/const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(/);
  const name = (fnMatch?.[1] || constMatch?.[1] || "GeneratedComponent").trim();

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

  const wrapper = `\n\n${defaultProps}\nexport default function App(){\n  return <${name} {...__defaultProps} />\n}`;
  return sanitized + wrapper;
}

export function SandpackRuntimePreview({ code, className, showConsole = false }: SandpackPreviewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isFullscreen, setIsFullscreen] = useState(false);

  const files = useMemo(() => {
    const appTsx = createAppFileFromCode(code);

    const indexTsx = `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport { initTwind } from "./twind";\nimport "./index.css";\n\n// Initialize Twind runtime Tailwind support (no CDN, no PostCSS)\ninitTwind();\n\nconst root = createRoot(document.getElementById("root")!);\nroot.render(<App />);`;

    const indexHtml = `<!doctype html>\n<html class=\"${isDark ? 'dark' : ''}\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <meta name=\"color-scheme\" content=\"light dark\" />\n    <title>Sandpack Preview</title>\n  </head>\n  <body class=\"min-h-screen w-full ${isDark ? 'bg-neutral-900' : 'bg-gray-50'}\">\n    <div id=\"root\"></div>\n  </body>\n</html>`;

    const indexCss = `/* Preview base styles and scroll behavior */
:root { color-scheme: light dark; }
html, body, #root { height: 100%; width: 100%; }
* { box-sizing: border-box; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; overflow: auto; margin: 0; }
#root { display: flex; min-height: 100%; min-width: 0; }
main, section, div { min-width: 0; }
/* Force full width by neutralizing container/max-w utilities inside sandboxed content */
.container { max-width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important; }
[class*="max-w-"] { max-width: 100% !important; }
.mx-auto { margin-left: 0 !important; margin-right: 0 !important; }
/* Ensure dark mode background/foreground harmonize with shadcn */
@media (prefers-color-scheme: dark){
  :root { color-scheme: dark; }
}
`;

    const twindTs = `import { setup } from '@twind/core'\nimport presetTailwind from '@twind/preset-tailwind'\n\nexport function initTwind(){\n  setup({\n    presets: [presetTailwind({ darkMode: 'class' })],\n    hash: false,\n  })\n}`;

    const pkgJson = `{\n  \"name\": \"sandpack-runtime\",\n  \"private\": true,\n  \"dependencies\": {\n    \"@twind/core\": \"^1.0.0-next.41\",\n    \"@twind/preset-tailwind\": \"^1.0.0-next.41\"\n  }\n}`;

    const cnUtil = `export function cn(...classes: Array<string | false | null | undefined>) {\n  return classes.filter(Boolean).join(' ');\n}`;

    const buttonTsx = `import React from 'react';\nimport { cn } from '../lib/cn';\nexport type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {\n  variant?: 'default' | 'outline';\n};\nexport function Button({ className, variant = 'default', ...props }: ButtonProps){\n  const base = 'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none';\n  const variants = {\n    default: 'bg-gray-900 text-white hover:bg-gray-800',\n    outline: 'border border-gray-300 hover:bg-gray-100'\n  };\n  return <button className={cn(base, variants[variant], className)} {...props} />;\n}`;

    const cardTsx = `import React from 'react';\nimport { cn } from '../lib/cn';\nexport function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('rounded-lg border bg-white text-gray-900 shadow-sm', className)} {...props} />;\n}\nexport function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('p-4 border-b', className)} {...props} />;\n}\nexport function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>){\n  return <h3 className={cn('text-lg font-semibold', className)} {...props} />;\n}\nexport function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>){\n  return <p className={cn('text-sm text-gray-500', className)} {...props} />;\n}\nexport function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('p-4', className)} {...props} />;\n}\nexport function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>){\n  return <div className={cn('p-4 border-t', className)} {...props} />;\n}`;

    const tsconfig = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["dom", "es2020"]
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
      "/ui/button.tsx": { code: buttonTsx },
      "/ui/card.tsx": { code: cardTsx },
    } as const;
  }, [code, isDark]);

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
              "lucide-react": "latest",
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
    <div className={cn("relative w-full h-full rounded-lg overflow-hidden border", className)}>
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
            "lucide-react": "latest",
            clsx: "latest",
            "class-variance-authority": "latest",
          },
        }}
        theme={isDark ? amethyst : githubLight}
      >
        <div className="relative w-full h-full flex flex-col">
          {/* Fullscreen Toggle Button */}
          <div className={cn(
            "absolute top-3 right-3 z-20",
            isDark ? "bg-neutral-800/90" : "bg-white/90",
            "backdrop-blur-sm rounded-lg shadow-md"
          )}>
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

          <SandpackLayout className="!h-full !border-0">
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