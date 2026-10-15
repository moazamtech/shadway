"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  Loader2,
  Monitor,
  Moon,
  Package,
  RotateCcw,
  Rocket,
  Smartphone,
  Sun,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalPreview, type PreviewFileInput } from "@/components/preview/local-preview";
import { StudioEditor, languageFor } from "@/components/studio/studio-editor";
import { PublishPanel } from "@/components/studio/publish-panel";
import { buildPreviewFiles, type PreviewFiles } from "@/lib/preview/files";

const STARTER_FILES: PreviewFiles = {
  "/src/components/component.tsx": `import { Button } from "@/components/ui/button";

export default function MyComponent() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center bg-background p-10">
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Your shadcn component</h2>
        <p className="text-sm text-muted-foreground">
          Edit component.tsx and the preview updates instantly.
        </p>
        <Button>Get started</Button>
      </div>
    </div>
  );
}
`,
  "/src/App.tsx": `import MyComponent from "./components/component";

export default function App() {
  return <MyComponent />;
}
`,
  "/src/index.css": `:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --border: 240 5.9% 90%;
  --radius: 0.5rem;
}
`,
  "/src/lib/utils.ts": `export function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}
`,
  "/src/components/ui/button.tsx": `import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent",
  };
  const sizes = { default: "h-10 px-4", sm: "h-9 px-3", lg: "h-11 px-6" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
`,
};

function iconFor(path: string) {
  if (path.endsWith(".css")) return { Icon: FileText, tone: "text-sky-400" };
  if (path.endsWith(".json")) return { Icon: FileJson, tone: "text-amber-400" };
  if (path.includes("/components/ui/")) return { Icon: FileCode2, tone: "text-emerald-400" };
  return { Icon: FileCode2, tone: "text-primary" };
}

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
};

/** Builds a nested tree so folders expand and collapse like a real IDE. */
function buildTree(files: Record<string, string>): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };

  for (const path of Object.keys(files)) {
    const segments = path.split("/").filter(Boolean);
    let cursor = root;

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      const currentPath = "/" + segments.slice(0, index + 1).join("/");

      if (isLast) {
        cursor.children!.push({ name: segment, path: currentPath, type: "file" });
        return;
      }

      let next = cursor.children!.find(
        (child) => child.type === "dir" && child.name === segment
      );
      if (!next) {
        next = { name: segment, path: currentPath, type: "dir", children: [] };
        cursor.children!.push(next);
      }
      cursor = next;
    });
  }

  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sort(node.children);
    });
    return nodes;
  };

  return sort(root.children!);
}

export function ComponentStudio() {
  const [files, setFiles] = useState<PreviewFiles>(STARTER_FILES);
  const [activePath, setActivePath] = useState("/src/components/component.tsx");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [debouncedFiles, setDebouncedFiles] = useState<PreviewFiles>(STARTER_FILES);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [packageInput, setPackageInput] = useState("");
  const [installedPackages, setInstalledPackages] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);
  const [showPackages, setShowPackages] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFiles(files), 450);
    return () => window.clearTimeout(id);
  }, [files]);

  const previewFiles: PreviewFileInput[] = useMemo(
    () => buildPreviewFiles(debouncedFiles),
    [debouncedFiles]
  );

  const tree = useMemo(() => buildTree(files), [files]);
  const activeCode = files[activePath] ?? "";
  const packageCount = Object.keys(installedPackages).length;

  const updateActive = useCallback(
    (value: string) => {
      setFiles((prev) => ({ ...prev, [activePath]: value }));
    },
    [activePath]
  );

  function createFile() {
    const raw = newFileName.trim();
    if (!raw) return;

    let path = raw.startsWith("/")
      ? raw
      : raw.startsWith("src/")
        ? `/${raw}`
        : `/src/${raw}`;
    if (!/\.(tsx?|jsx?|css)$/.test(path)) path += ".tsx";
    if (files[path]) return;

    const name = path.split("/").pop()!.replace(/\.(tsx?|jsx?)$/, "");
    setFiles((prev) => ({
      ...prev,
      [path]: `export default function ${name.replace(/[^a-zA-Z0-9]/g, "")}() {
  return <div className="p-6 text-sm text-muted-foreground">New component</div>;
}
`,
    }));
    setActivePath(path);
    setNewFileName("");
    setShowNewFile(false);
  }

  function deleteFile(path: string) {
    if (path === "/src/components/component.tsx" || path === "/src/App.tsx") return;
    setFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (activePath === path) setActivePath("/src/components/component.tsx");
  }

  async function installPackage() {
    const raw = packageInput.trim().replace(/^["']|["']$/g, "");
    if (!raw) return;
    const pkgName = raw.split("@")[0];
    if (!pkgName) return;

    setResolving(true);
    try {
      const res = await fetch(
        `/api/registry/resolve-package?name=${encodeURIComponent(pkgName)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setInstalledPackages((prev) => ({ ...prev, [pkgName]: data.version }));
      setPackageInput("");
    } catch {
      /* offline */
    } finally {
      setResolving(false);
    }
  }

  const extraFiles = useMemo(
    () =>
      Object.entries(files)
        .filter(([path]) => path.startsWith("/src/lib/") || path.startsWith("/src/hooks/"))
        .map(([path, content]) => ({
          path: path.replace(/^\/src\//, ""),
          content,
          type: path.includes("/hooks/") ? "registry:hook" : "registry:lib",
        })),
    [files]
  );

  function renderTree(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      if (node.type === "dir") {
        const isCollapsed = collapsed[node.path];
        return (
          <div key={node.path}>
            <button
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
              }
              className="group flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              )}
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {!isCollapsed && node.children && renderTree(node.children, depth + 1)}
          </div>
        );
      }

      const { Icon, tone } = iconFor(node.path);
      const isActive = node.path === activePath;
      const removable =
        node.path !== "/src/components/component.tsx" && node.path !== "/src/App.tsx";

      return (
        <div key={node.path} className="group/file relative flex items-center">
          {isActive && (
            <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
          )}
          <button
            onClick={() => setActivePath(node.path)}
            className={`flex flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors ${
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
            style={{ paddingLeft: `${depth * 12 + 22}px` }}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
            <span className="truncate">{node.name}</span>
          </button>
          {removable && (
            <button
              onClick={() => deleteFile(node.path)}
              className="mr-1.5 opacity-0 transition group-hover/file:opacity-100"
              title="Delete file"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      );
    });
  }

  if (publishing) {
    return (
      <PublishPanel
        code={files["/src/components/component.tsx"] || ""}
        demoCode={files["/src/App.tsx"] || ""}
        extraFiles={extraFiles}
        dependencies={Object.keys(installedPackages)}
        onBack={() => setPublishing(false)}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="relative shrink-0">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-serif text-base tracking-tight">
              Shadway
            </Link>
            <span className="h-3 w-px bg-border" />
            <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Studio
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setPreviewTheme(previewTheme === "light" ? "dark" : "light")}
              title="Toggle preview theme"
            >
              {previewTheme === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setFiles(STARTER_FILES)}
              title="Reset files"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="rounded-full pl-3"
              onClick={() => setPublishing(true)}
            >
              <Rocket className="mr-1.5 h-3.5 w-3.5" />
              Publish
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[248px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Explorer */}
        <aside className="hidden min-h-0 flex-col bg-muted/20 lg:flex">
          <div className="flex h-10 shrink-0 items-center justify-between px-3">
            <span className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Explorer
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => setShowNewFile((v) => !v)}
              title="New file"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {showNewFile && (
            <div className="px-3 pb-3">
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFile();
                  if (e.key === "Escape") setShowNewFile(false);
                }}
                placeholder="hooks/use-thing.ts"
                className="h-8 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:border-primary"
              />
              <Button size="sm" className="mt-2 h-7 w-full rounded-md text-xs" onClick={createFile}>
                Create file
              </Button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">
            {renderTree(tree)}
          </div>

          {/* Packages */}
          <div className="border-t border-border/70">
            <button
              onClick={() => setShowPackages((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              {showPackages ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Package className="h-3 w-3" />
              Packages
              {packageCount > 0 && (
                <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {packageCount}
                </span>
              )}
            </button>

            {showPackages && (
              <div className="px-3 pb-3">
                <input
                  value={packageInput}
                  onChange={(e) => setPackageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void installPackage();
                  }}
                  placeholder="Add npm package"
                  className="h-8 w-full rounded-md border bg-background px-2.5 text-xs outline-none focus:border-primary"
                />
                <Button
                  size="sm"
                  className="mt-2 h-7 w-full rounded-md text-xs"
                  disabled={resolving || !packageInput.trim()}
                  onClick={() => void installPackage()}
                >
                  {resolving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Install"
                  )}
                </Button>

                {packageCount > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {Object.entries(installedPackages).map(([name, version]) => (
                      <li
                        key={name}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <code className="truncate text-foreground">{name}</code>
                        <span className="shrink-0 text-muted-foreground">{version}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Editor */}
        <section className="relative flex min-h-0 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 px-4">
            {(() => {
              const { Icon, tone } = iconFor(activePath);
              return <Icon className={`h-3.5 w-3.5 ${tone}`} />;
            })()}
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {activePath}
            </span>
          </div>
          <div className="min-h-0 flex-1 border-t border-border/70">
            <StudioEditor
              path={activePath}
              value={activeCode}
              language={languageFor(activePath)}
              onChange={updateActive}
              projectFiles={files}
              packages={Object.keys(installedPackages)}
            />
          </div>
        </section>

        {/* Preview */}
        <section className="relative flex min-h-0 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between px-4">
            <span className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Preview
            </span>
            <div className="flex items-center gap-0.5 rounded-full border p-0.5">
              <Button
                variant={viewport === "desktop" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => setViewport("desktop")}
                title="Desktop"
              >
                <Monitor className="h-3 w-3" />
              </Button>
              <Button
                variant={viewport === "mobile" ? "secondary" : "ghost"}
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => setViewport("mobile")}
                title="Mobile"
              >
                <Smartphone className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted/20 p-4">
            <div
              className={`h-full overflow-hidden rounded-xl border bg-background shadow-sm transition-all ${
                viewport === "mobile" ? "w-[390px]" : "w-full"
              }`}
            >
              <LocalPreview
                files={previewFiles}
                entry="/src/App.tsx"
                theme={previewTheme}
                height="100%"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}