"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Blocks,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Package,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Search,
  Smartphone,
  Sun,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalPreview, type PreviewFileInput } from "@/components/preview/local-preview";
import { StudioEditor, languageFor } from "@/components/studio/studio-editor";
import { PublishPanel } from "@/components/studio/publish-panel";
import { useStudioSandbox, type SandboxStatus } from "@/components/studio/use-sandbox";
import { buildPreviewFiles, type PreviewFiles } from "@/lib/preview/files";
import {
  SHADCN_FILE_PATHS,
  SHADCN_UI_COMPONENTS,
} from "@/lib/preview/template/names";
import { collectNpmDependencies } from "@/lib/studio/sandbox/deps";
import {
  DEFAULT_COMPONENT_PATH,
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_PATH,
  starterFiles,
} from "@/lib/studio/starter";

export type StudioInitial = {
  title: string;
  description: string;
  tags: string[];
  category: string;
  visibility: "public" | "unlisted";
  /** `pending` is included because a published component can be re-published
   *  as pending review while its draft is being edited. */
  status: "draft" | "pending" | "published" | "hidden" | "flagged";
  files: PreviewFiles;
  dependencies?: string[];
};

/* ------------------------------------------------------- shadcn/ui files -- */

/** Where a vendored file lives in the project: `ui/button.tsx` -> `components/ui/button.tsx`. */
function projectPathFor(vendored: string) {
  return vendored.startsWith("ui/") ? `/components/${vendored}` : `/${vendored}`;
}

/** The reverse: a project path back to its vendored file. */
const VENDORED_BY_PROJECT_PATH = new Map(
  SHADCN_FILE_PATHS.map((vendored) => [projectPathFor(vendored), vendored])
);

/** Every file the registry ships, as project paths. */
const REGISTRY_PATHS: string[] = SHADCN_FILE_PATHS.map(projectPathFor);

let registryFilesPromise: Promise<Record<string, string>> | null = null;

/**
 * The vendored sources are ~230KB, so they are code-split and only fetched
 * the first time someone opens one of the files.
 */
function loadRegistryFiles(): Promise<Record<string, string>> {
  registryFilesPromise ??= import("@/lib/preview/template/bundle").then(
    (module) => module.SHADCN_FILES
  );
  return registryFilesPromise;
}

/** How a project file is classified in the published registry item. */
function fileTypeFor(path: string) {
  if (path.startsWith("/components/ui/")) return "registry:ui";
  if (path.startsWith("/hooks/")) return "registry:hook";
  if (path.startsWith("/lib/")) return "registry:lib";
  if (path.startsWith("/components/")) return "registry:component";
  return "registry:file";
}

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

/** The shape both autosave and publish send to the server. */
function projectPayload(files: PreviewFiles, title: string, dependencies: string[] = []) {
  const extraFiles = Object.entries(files)
    .filter(
      ([path]) =>
        path !== DEFAULT_COMPONENT_PATH &&
        path !== DEFAULT_DEMO_PATH &&
        path !== DEFAULT_STYLE_PATH
    )
    .map(([path, content]) => ({
      path: path.replace(/^\//, ""),
      content,
      type: fileTypeFor(path),
    }));

  return {
    title,
    code: files[DEFAULT_COMPONENT_PATH] || "",
    demoCode: files[DEFAULT_DEMO_PATH] || "",
    styleCode: files[DEFAULT_STYLE_PATH] ?? "",
    files: extraFiles,
    dependencies,
  };
}

/* ------------------------------------------------- sandbox status cards -- */

/** Shown while the dev server installs and boots. */
function SandboxBootCard({ status, logs }: { status: SandboxStatus; logs: string[] }) {
  const label =
    status === "connecting"
      ? "Starting your Next.js dev server…"
      : status === "seeding"
        ? "Writing your project to the dev server…"
        : "Installing dependencies and starting the Next.js dev server…";
  const tail = logs.slice(-7);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
      {tail.length > 0 && (
        <pre className="max-h-40 w-full max-w-md overflow-hidden rounded-lg border bg-muted/30 p-3 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
          {tail.join("\n")}
        </pre>
      )}
    </div>
  );
}

/** Shown when the dev server could not be started — retry, or stay local. */
function SandboxErrorCard({
  detail,
  logs,
  onRetry,
  onUseLocal,
}: {
  detail: string | null;
  logs: string[];
  onRetry: () => void;
  onUseLocal: () => void;
}) {
  const tail = logs.slice(-7);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="h-5 w-5 text-amber-500" />
      <p className="max-w-sm text-xs text-muted-foreground">
        {detail ?? "The dev-server sandbox could not be started."}
      </p>
      {tail.length > 0 && (
        <pre className="max-h-40 w-full max-w-md overflow-hidden rounded-lg border bg-muted/30 p-3 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
          {tail.join("\n")}
        </pre>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-full px-3 text-xs"
          onClick={onRetry}
        >
          <RefreshCw className="mr-1.5 h-3 w-3" />
          Retry
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 rounded-full px-3 text-xs"
          onClick={onUseLocal}
        >
          Use local preview
        </Button>
      </div>
    </div>
  );
}

export function ComponentStudio({
  slug,
  initial,
}: {
  slug?: string;
  initial?: StudioInitial;
}) {
  const initialFiles = useMemo(() => initial?.files ?? starterFiles(), [initial]);
  const [files, setFiles] = useState<PreviewFiles>(initialFiles);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [activePath, setActivePath] = useState(DEFAULT_COMPONENT_PATH);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [debouncedFiles, setDebouncedFiles] = useState<PreviewFiles>(initialFiles);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "/components/ui": true,
  });
  const [showExplorer, setShowExplorer] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [packageInput, setPackageInput] = useState("");
  const [installedPackages, setInstalledPackages] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.dependencies ?? []).map((name) => [name, ""]))
  );
  const [resolving, setResolving] = useState(false);
  const [showPackages, setShowPackages] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [registryFiles, setRegistryFiles] = useState<Record<string, string> | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  // Auto-detect newly imported packages from debouncedFiles
  useEffect(() => {
    const fileList = Object.entries(debouncedFiles).map(([p, content]) => ({ path: p, content }));
    const detected = collectNpmDependencies(fileList);
    const missing = detected.filter(
      (pkg) =>
        !installedPackages[pkg] &&
        pkg !== "next" &&
        pkg !== "react" &&
        pkg !== "react-dom" &&
        pkg !== "react/jsx-runtime"
    );

    if (missing.length === 0) return;

    for (const pkg of missing) {
      void (async () => {
        try {
          const res = await fetch(`/api/registry/resolve-package?name=${encodeURIComponent(pkg)}`);
          if (res.ok) {
            const data = await res.json();
            setInstalledPackages((prev) => ({ ...prev, [pkg]: data.version || "latest" }));
          } else {
            setInstalledPackages((prev) => ({ ...prev, [pkg]: "latest" }));
          }
        } catch {
          setInstalledPackages((prev) => ({ ...prev, [pkg]: "latest" }));
        }
      })();
    }
  }, [debouncedFiles, installedPackages]);

  function removePackage(name: string) {
    setInstalledPackages((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  const { resolvedTheme } = useTheme();
  const previewThemeSynced = useRef(false);
  const previewFrame = useRef<HTMLIFrameElement | null>(null);
  const [forceLocalPreview, setForceLocalPreview] = useState(false);
  const {
    status: sandboxStatus,
    previewURL: sandboxPreviewURL,
    logs: sandboxLogs,
    detail: sandboxDetail,
    reloadKey: sandboxReloadKey,
    syncFiles: syncSandboxFiles,
    reconnect: reconnectSandbox,
  } = useStudioSandbox({ slug });

  // The preview opens on whatever theme the studio itself is wearing; the
  // toggle in its header still switches it by hand afterwards.
  useEffect(() => {
    if (previewThemeSynced.current || !resolvedTheme) return;
    previewThemeSynced.current = true;
    setPreviewTheme(resolvedTheme === "dark" ? "dark" : "light");
  }, [resolvedTheme]);

  // The dev server renders in an iframe; the theme rides over as a message
  // (and is re-sent whenever the iframe reloads).
  const sendPreviewTheme = useCallback(() => {
    if (!sandboxPreviewURL) return;
    previewFrame.current?.contentWindow?.postMessage(
      { type: "shadway:theme", theme: previewTheme },
      "*"
    );
  }, [previewTheme, sandboxPreviewURL]);

  useEffect(() => {
    sendPreviewTheme();
  }, [sendPreviewTheme]);

  const lastSaved = useRef(
    JSON.stringify(projectPayload(initialFiles, initial?.title ?? ""))
  );

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFiles(files), 450);
    return () => window.clearTimeout(id);
  }, [files]);

  // Mirror the project into the dev-server sandbox — its Next.js dev server
  // recompiles from these writes.
  useEffect(() => {
    if (sandboxStatus !== "installing" && sandboxStatus !== "ready") return;
    void syncSandboxFiles(debouncedFiles);
  }, [sandboxStatus, syncSandboxFiles, debouncedFiles]);

  // Drafts save themselves: after a quiet moment the project is written back,
  // so leaving the studio never loses work.
  useEffect(() => {
    if (!slug) return;

    const payload = projectPayload(files, title, Object.keys(installedPackages));
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSaved.current) return;

    const id = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/components/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("save failed");
        lastSaved.current = snapshot;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);

    return () => window.clearTimeout(id);
  }, [files, title, slug, installedPackages]);

  const previewFiles: PreviewFileInput[] = useMemo(
    () => buildPreviewFiles(debouncedFiles),
    [debouncedFiles]
  );

  // The explorer shows the whole shadcn/ui folder beside the author's files,
  // the way an installed shadcn project looks — vendored files are marked
  // until they are copied into the project.
  const tree = useMemo(() => {
    const keys: Record<string, string> = {};
    for (const path of REGISTRY_PATHS) keys[path] = "";
    return buildTree({ ...keys, ...files });
  }, [files]);

  const vendoredActive = useMemo(
    () =>
      files[activePath] === undefined
        ? VENDORED_BY_PROJECT_PATH.get(activePath)
        : undefined,
    [files, activePath]
  );

  const activeCode =
    files[activePath] ??
    (vendoredActive && registryFiles ? registryFiles[vendoredActive] ?? "" : "");
  const packageCount = Object.keys(installedPackages).length;

  /** Which pane the preview area shows right now. */
  const previewMode: "sandbox" | "boot" | "error" | "local" = forceLocalPreview
    ? "local"
    : sandboxPreviewURL
      ? "sandbox"
      : sandboxStatus === "connecting" ||
          sandboxStatus === "seeding" ||
          sandboxStatus === "installing"
        ? "boot"
        : sandboxStatus === "error"
          ? "error"
          : "local";

  const handleSandboxRetry = useCallback(() => {
    setForceLocalPreview(false);
    reconnectSandbox();
  }, [reconnectSandbox]);

  /** Opens a file — vendored ones load the registry chunk on first access. */
  async function openFile(path: string) {
    if (files[path] !== undefined || !VENDORED_BY_PROJECT_PATH.has(path)) {
      setActivePath(path);
      return;
    }
    setOpeningPath(path);
    try {
      setRegistryFiles(await loadRegistryFiles());
      setActivePath(path);
    } finally {
      setOpeningPath(null);
    }
  }

  /** Copies a vendored file into the project so it can be edited and saved. */
  async function materialize(path: string) {
    const vendored = VENDORED_BY_PROJECT_PATH.get(path);
    if (!vendored || files[path] !== undefined) return;
    const sources = registryFiles ?? (await loadRegistryFiles());
    setRegistryFiles(sources);
    const content = sources[vendored];
    if (content === undefined) return;
    setFiles((prev) => ({ ...prev, [path]: content }));
  }

  const updateActive = useCallback(
    (value: string) => {
      setFiles((prev) => ({ ...prev, [activePath]: value }));
    },
    [activePath]
  );

  function createFile() {
    const raw = newFileName.trim();
    if (!raw) return;

    let path = raw.startsWith("/") ? raw : `/${raw}`;
    // Legacy projects nested everything under src/; keep writing at the root.
    path = path.replace(/^\/src\//, "/");
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
    if (
      path === DEFAULT_COMPONENT_PATH ||
      path === DEFAULT_DEMO_PATH ||
      path === DEFAULT_STYLE_PATH
    )
      return;
    setFiles((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    if (activePath === path) setActivePath(DEFAULT_COMPONENT_PATH);
  }

  /** Writes a ready-to-use import for a shadcn/ui component into the source. */
  function insertImport(name: string) {
    const item = SHADCN_UI_COMPONENTS.find((entry) => entry.name === name);
    if (!item) return;
    const primary = item.exports[0];
    const line = `import { ${primary} } from "${item.path}";`;

    setFiles((prev) => {
      const current = prev[DEFAULT_COMPONENT_PATH] ?? "";
      if (current.includes(`from "${item.path}"`)) return prev;

      const lines = current.split("\n");
      let index = 0;
      if (/^\s*["']use (client|server)["'];?\s*$/.test(lines[0] ?? "")) index = 1;
      while (index < lines.length && lines[index].startsWith("import ")) index++;

      const next = [...lines.slice(0, index), line, ...lines.slice(index)];
      return { ...prev, [DEFAULT_COMPONENT_PATH]: next.join("\n") };
    });
    setActivePath(DEFAULT_COMPONENT_PATH);
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
      const isVendored =
        files[node.path] === undefined && VENDORED_BY_PROJECT_PATH.has(node.path);
      const removable =
        !isVendored &&
        node.path !== DEFAULT_COMPONENT_PATH &&
        node.path !== DEFAULT_DEMO_PATH;

      return (
        <div key={node.path} className="group/file relative flex items-center">
          {isActive && (
            <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
          )}
          <button
            onClick={() => void openFile(node.path)}
            className={`flex flex-1 items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors ${
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            } ${isVendored ? "opacity-80" : ""}`}
            style={{ paddingLeft: `${depth * 12 + 22}px` }}
            title={
              isVendored
                ? "Ships with shadcn/ui — copy it into your project to edit it"
                : undefined
            }
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
            <span className="truncate">{node.name}</span>
            {isVendored && (
              <span className="ml-auto shrink-0 text-[9px] tracking-wider text-muted-foreground/60 uppercase">
                ui
              </span>
            )}
          </button>
          {isVendored ? (
            <button
              onClick={() => void materialize(node.path)}
              className="mr-1.5 opacity-0 transition group-hover/file:opacity-100"
              title="Copy into project"
            >
              <Plus className="h-3 w-3 text-muted-foreground hover:text-primary" />
            </button>
          ) : (
            removable && (
              <button
                onClick={() => deleteFile(node.path)}
                className="mr-1.5 opacity-0 transition group-hover/file:opacity-100"
                title="Delete file"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            )
          )}
        </div>
      );
    });
  }

  if (publishing) {
    return (
      <PublishPanel
        slug={slug}
        code={files[DEFAULT_COMPONENT_PATH] || ""}
        demoCode={files[DEFAULT_DEMO_PATH] || ""}
        extraFiles={projectPayload(files, title).files}
        dependencies={Object.keys(installedPackages)}
        initialMeta={
          initial
            ? {
                title,
                description: initial.description,
                tags: initial.tags.join(", "),
                category: initial.category,
                visibility: initial.visibility,
              }
            : { title }
        }
        status={initial?.status ?? "draft"}
        onBack={() => setPublishing(false)}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="relative shrink-0">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              asChild
              title="All components"
            >
              <Link href="/studio">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <span className="hidden text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase sm:inline">
              Studio
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled component"
              className="h-8 w-full min-w-0 max-w-[280px] rounded-md border border-transparent bg-transparent px-2 text-sm font-medium outline-none transition-colors hover:border-border focus:border-border focus:bg-background"
            />
            {slug && saveState !== "idle" && (
              <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex">
                {saveState === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving…
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-primary" />
                    Saved
                  </>
                )}
                {saveState === "error" && (
                  <span className="text-destructive">Save failed</span>
                )}
              </span>
            )}
            <div className="hidden items-center gap-1 border-l pl-2 sm:flex">
              <Button
                variant={showExplorer ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setShowExplorer((v) => !v)}
                title={showExplorer ? "Hide file tree" : "Show file tree"}
              >
                {showExplorer ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
              <Button
                variant={showEditor ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setShowEditor((v) => !v)}
                title={showEditor ? "Hide code editor" : "Show code editor"}
              >
                <Code2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => {
                setFiles(initialFiles);
                if (initial) setTitle(initial.title);
              }}
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
              {initial?.status === "published" ? "Update" : "Publish"}
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-border to-transparent" />
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Explorer */}
        {showExplorer && (
          <aside className="relative flex w-60 shrink-0 flex-col border-r bg-muted/20">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/70 px-3">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Explorer
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewFile((v) => !v)}
                  title="New file"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setShowExplorer(false)}
                  title="Close file tree"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
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
                    <ul className="mt-2.5 max-h-40 space-y-1 overflow-auto">
                      {Object.entries(installedPackages).map(([name, version]) => (
                        <li
                          key={name}
                          className="group flex items-center justify-between gap-2 text-[11px]"
                        >
                          <code className="truncate font-mono text-foreground">{name}</code>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-muted-foreground/70">{version || "latest"}</span>
                            <button
                              onClick={() => removePackage(name)}
                              className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                              title={`Remove ${name}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Editor */}
        {showEditor && (
          <section className="relative flex min-w-0 flex-1 flex-col border-r">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/70 px-3">
              <div className="flex min-w-0 items-center gap-2">
                {(() => {
                  const { Icon, tone } = iconFor(activePath);
                  return <Icon className={`h-3.5 w-3.5 ${tone}`} />;
                })()}
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {activePath}
                </span>
                {vendoredActive && (
                  <>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      shadcn/ui
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 rounded-full px-2 text-[11px]"
                      onClick={() => void materialize(activePath)}
                      title="Editing already copies it in — this does it in one click"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Copy into project
                    </Button>
                  </>
                )}
                {openingPath && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowEditor(false)}
                title="Collapse code editor"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              {openingPath ? (
                <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading shadcn/ui file…
                </div>
              ) : (
                <StudioEditor
                  path={activePath}
                  value={activeCode}
                  language={languageFor(activePath)}
                  onChange={updateActive}
                  projectFiles={files}
                  packages={Object.keys(installedPackages)}
                />
              )}
            </div>
          </section>
        )}

        {/* Preview */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
            <div className="flex items-center gap-2">
              {!showExplorer && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 rounded-md px-2 text-[11px]"
                  onClick={() => setShowExplorer(true)}
                  title="Show file explorer"
                >
                  <PanelLeft className="h-3 w-3" />
                  <span>Files</span>
                </Button>
              )}
              {!showEditor && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 rounded-md px-2 text-[11px]"
                  onClick={() => setShowEditor(true)}
                  title="Show code editor"
                >
                  <Code2 className="h-3 w-3" />
                  <span>Code</span>
                </Button>
              )}
              <span className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Preview
              </span>
              <span
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                title={
                  previewMode === "sandbox"
                    ? "Running on a real Next.js dev server"
                    : "Browser-side preview"
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    previewMode === "sandbox" ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                {previewMode === "sandbox" ? "dev server" : "local preview"}
              </span>
            </div>

            {/* Combined Toolbar: Reloader, Theme Switcher, Resize Icons */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-full border bg-background/80 p-0.5 shadow-2xs backdrop-blur-xs">
                {/* Sandbox Reloader */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => {
                    setForceLocalPreview(false);
                    reconnectSandbox();
                  }}
                  title="Reload preview"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>

                {/* Theme Switcher */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => setPreviewTheme(previewTheme === "light" ? "dark" : "light")}
                  title={`Switch to ${previewTheme === "light" ? "dark" : "light"} theme`}
                >
                  {previewTheme === "light" ? (
                    <Sun className="h-3 w-3 text-amber-500" />
                  ) : (
                    <Moon className="h-3 w-3 text-sky-400" />
                  )}
                </Button>

                <span className="mx-0.5 h-3 w-px bg-border/80" />

                {/* Responsive Viewport Resize Icons */}
                <Button
                  variant={viewport === "desktop" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => setViewport("desktop")}
                  title="Desktop (full view)"
                >
                  <Monitor className="h-3 w-3" />
                </Button>
                <Button
                  variant={viewport === "mobile" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => setViewport("mobile")}
                  title="Mobile (390px)"
                >
                  <Smartphone className="h-3 w-3" />
                </Button>

                <span className="mx-0.5 h-3 w-px bg-border/80" />

                {/* Fullscreen Toggle (collapses explorer & editor) */}
                <Button
                  variant={!showExplorer && !showEditor ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={() => {
                    if (!showExplorer && !showEditor) {
                      setShowExplorer(true);
                      setShowEditor(true);
                    } else {
                      setShowExplorer(false);
                      setShowEditor(false);
                    }
                  }}
                  title={!showExplorer && !showEditor ? "Exit full screen preview" : "Full screen preview"}
                >
                  {!showExplorer && !showEditor ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview Canvas: Edge-to-edge full width and height, NO rounding */}
          <div
            className={`flex min-h-0 flex-1 justify-center overflow-auto bg-background ${
              viewport === "mobile" ? "items-center bg-muted/20 p-4" : "p-0"
            }`}
          >
            <div
              className={`h-full w-full overflow-hidden transition-all ${
                viewport === "mobile"
                  ? "w-[390px] max-h-[844px] rounded-2xl border bg-background shadow-xl"
                  : "rounded-none border-0"
              }`}
            >
              {previewMode === "sandbox" && sandboxPreviewURL ? (
                <iframe
                  key={sandboxReloadKey}
                  ref={previewFrame}
                  src={sandboxPreviewURL}
                  onLoad={sendPreviewTheme}
                  title="Component preview"
                  className="h-full w-full border-0 bg-background"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                />
              ) : previewMode === "boot" &&
                (sandboxStatus === "connecting" ||
                  sandboxStatus === "seeding" ||
                  sandboxStatus === "installing") ? (
                <SandboxBootCard status={sandboxStatus} logs={sandboxLogs} />
              ) : previewMode === "error" ? (
                <SandboxErrorCard
                  detail={sandboxDetail}
                  logs={sandboxLogs}
                  onRetry={handleSandboxRetry}
                  onUseLocal={() => setForceLocalPreview(true)}
                />
              ) : (
                <LocalPreview
                  files={previewFiles}
                  entry={DEFAULT_DEMO_PATH}
                  theme={previewTheme}
                  height="100%"
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
