"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import { StudioEditor, languageFor } from "@/components/studio/studio-editor";
import { PublishPanel } from "@/components/studio/publish-panel";
import type { SandpackApi } from "@/components/studio/sandpack-preview";
import type { PreviewFiles } from "@/lib/preview/files";
import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import {
  SHADCN_FILE_PATHS,
  SHADCN_UI_COMPONENTS,
} from "@/lib/preview/template/names";
import { collectNpmDependencies } from "@/lib/studio/deps";
import { projectPathFor } from "@/lib/studio/sandpack";
import { usePreviewCss } from "@/lib/studio/use-preview-css";
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

/** The reverse of `projectPathFor`: a project path back to its vendored file. */
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

/** A block the studio can insert, as served by /api/studio/blocks. */
type StudioBlock = {
  name: string;
  title: string;
  description: string;
  category: string;
  /** Primary exported component, e.g. `Hero`. */
  component: string;
  /** Project paths, ready to write into the workspace. */
  files: { path: string; content: string }[];
  /** The demo page that renders the block. */
  demo: string;
};

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

/* --------------------------------------------------------- the preview -- */

/**
 * Sandpack is a large client-only dependency, so it is code-split and never
 * rendered on the server — the studio still loads from HTML alone.
 */
const SandpackPreviewPane = dynamic(
  () => import("@/components/studio/sandpack-preview").then((mod) => mod.SandpackPreviewPane),
  { ssr: false }
);

export function ComponentStudio({
  slug,
  initial,
  initialCss,
  initialVendoredFiles,
}: {
  slug?: string;
  initial?: StudioInitial;
  /** The initial project's stylesheet, compiled by the server. */
  initialCss?: string;
  /** The vendored shadcn/ui sources the initial project reaches. */
  initialVendoredFiles?: PreviewFileInput[];
}) {
  const initialFiles = useMemo(() => initial?.files ?? starterFiles(), [initial]);
  const [files, setFiles] = useState<PreviewFiles>(initialFiles);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [activePath, setActivePath] = useState(DEFAULT_COMPONENT_PATH);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [debouncedFiles, setDebouncedFiles] = useState<PreviewFiles>(initialFiles);
  const [newFileName, setNewFileName] = useState("");
  /** The folder a new file is being created in — null means the project root. */
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "/components/ui": true,
  });
  const [showExplorer, setShowExplorer] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [installedPackages, setInstalledPackages] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.dependencies ?? []).map((name) => [name, ""]))
  );
  /** Which panel sits under the file tree. */
  const [panelTab, setPanelTab] = useState<"blocks" | "packages">("blocks");
  const [blockQuery, setBlockQuery] = useState("");
  const [blocks, setBlocks] = useState<StudioBlock[] | null>(null);
  const [insertingBlock, setInsertingBlock] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savingRef = useRef(false);
  const [registryFiles, setRegistryFiles] = useState<Record<string, string> | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  /** The live sandbox, and the project it was last handed. */
  const sandpackRef = useRef<SandpackApi | null>(null);
  const pushedRef = useRef<PreviewFiles | null>(null);

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
  /** Bumping this remounts the sandbox from scratch. */
  const [previewKey, setPreviewKey] = useState(0);

  // The preview opens on whatever theme the studio itself is wearing; the
  // toggle in its header still switches it by hand afterwards.
  useEffect(() => {
    if (previewThemeSynced.current || !resolvedTheme) return;
    previewThemeSynced.current = true;
    setPreviewTheme(resolvedTheme === "dark" ? "dark" : "light");
  }, [resolvedTheme]);

  const lastSaved = useRef(
    JSON.stringify(projectPayload(initialFiles, initial?.title ?? ""))
  );

  /** Serializes the live project; every save path (auto, manual, Ctrl+S)
   *  shares this one snapshot so none of them can save a stale copy. */
  const snapshot = useMemo(
    () => JSON.stringify(projectPayload(files, title, Object.keys(installedPackages))),
    [files, title, installedPackages]
  );
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const saveProject = useCallback(
    async (next: string) => {
      if (!slug || savingRef.current) return;
      if (next === lastSaved.current) return;

      savingRef.current = true;
      setSaveState("saving");
      try {
        const response = await fetch(`/api/components/${slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(JSON.parse(next)),
        });
        if (!response.ok) throw new Error("save failed");
        lastSaved.current = next;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      } finally {
        savingRef.current = false;
      }
    },
    [slug]
  );

  const saveClick = useCallback(() => {
    void saveProject(snapshotRef.current);
  }, [saveProject]);

  // Ctrl/Cmd+S saves immediately, like any editor muscle memory expects.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!slug) return;
        void saveProject(snapshotRef.current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slug, saveProject]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFiles(files), 450);
    return () => window.clearTimeout(id);
  }, [files]);

  // Drafts save themselves: after a quiet moment the project is written back,
  // so leaving the studio never loses work.
  useEffect(() => {
    if (!slug) return;
    if (snapshot === lastSaved.current) return;

    const id = window.setTimeout(() => void saveProject(snapshot), 1200);
    return () => window.clearTimeout(id);
  }, [snapshot, slug, saveProject]);

  const dirty = snapshot !== lastSaved.current;

  /**
   * The project the sandbox builds: the author's own files.
   *
   * The vendored shadcn/ui sources are not merged in here — the sandbox adds
   * them itself (`SandpackPreviewPane`), so this stays small enough to send to
   * the stylesheet compiler on every edit.
   */
  const previewFiles = debouncedFiles;

  // Styles are compiled on the server — Sandpack builds the JavaScript, and
  // the stylesheet it cannot produce itself is handed to it as `/styles.css`.
  // The project's own stylesheet arrives with the first render, so the sandbox
  // is built once, correctly styled.
  //
  // The same request reports the vendored shadcn/ui files the project reaches,
  // which is how the sandbox gets `@/components/ui/*` without the browser ever
  // downloading the registry.
  const { css: previewCss, vendored: previewVendored } = usePreviewCss(
    previewFiles,
    debouncedFiles[DEFAULT_STYLE_PATH],
    { initialCss, initialVendored: initialVendoredFiles }
  );

  /* -------------------------------------------- the sandbox, kept in step -- */

  /**
   * Mirrors a project change into the running sandbox.
   *
   * The editor, the explorer and the blocks panel all end up here: the sandbox
   * is the live project, so an edit shows up in the preview as it is typed
   * instead of after the save debounce. Only what actually changed is sent.
   */
  const syncSandbox = useCallback(
    (next: PreviewFiles, sandpack: SandpackApi) => {
      const previous = pushedRef.current ?? {};

      for (const [path, content] of Object.entries(next)) {
        if (previous[path] !== content) sandpack.updateFile(path, content);
      }
      for (const path of Object.keys(previous)) {
        if (!(path in next)) sandpack.deleteFile(path);
      }

      pushedRef.current = { ...next };
    },
    []
  );

  const filesRef = useRef(files);
  filesRef.current = files;

  const handleSandpackReady = useCallback(
    (sandpack: SandpackApi) => {
      // `useSandpack()` is not guaranteed to be referentially stable, so the
      // bridge can report the same sandbox more than once.
      if (sandpackRef.current === sandpack) return;
      sandpackRef.current = sandpack;
      // A fresh sandbox already holds the project it was built from; re-send
      // it so anything typed while it was booting is not lost.
      pushedRef.current = null;
      syncSandbox(filesRef.current, sandpack);
    },
    [syncSandbox]
  );

  useEffect(() => {
    const sandpack = sandpackRef.current;
    if (sandpack) syncSandbox(files, sandpack);
  }, [files, syncSandbox]);

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

  const filteredBlocks = useMemo(() => {
    if (!blocks) return [];
    const query = blockQuery.trim().toLowerCase();
    if (!query) return blocks;
    return blocks.filter((block) =>
      `${block.title} ${block.name} ${block.category}`.toLowerCase().includes(query)
    );
  }, [blocks, blockQuery]);

  /** Reload — throws the sandbox away and builds the project again. */
  const reloadPreview = useCallback(() => setPreviewKey((value) => value + 1), []);

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

  // The block library is small and only fetched once, so the panel is ready
  // the moment it is opened.
  useEffect(() => {
    if (blocks) return;
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/studio/blocks");
        const data = (await response.json()) as { blocks?: StudioBlock[] };
        if (alive) setBlocks(data.blocks ?? []);
      } catch {
        if (alive) setBlocks([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [blocks]);

  /**
   * 21st-style block insert: the block's files land under
   * /components/blocks/ (never colliding with the author's own code) and the
   * demo page is swapped to render the block, so the preview immediately
   * shows the composed result.
   */
  function insertBlock(block: StudioBlock) {
    if (insertingBlock) return;
    setInsertingBlock(block.name);
    try {
      setFiles((prev) => {
        const next = { ...prev };
        for (const file of block.files) next[file.path] = file.content;
        next[DEFAULT_DEMO_PATH] = block.demo;
        return next;
      });
      setActivePath(block.files[0]?.path ?? DEFAULT_DEMO_PATH);
    } finally {
      setInsertingBlock(null);
    }
  }

  const updateActive = useCallback(
    (value: string) => {
      setFiles((prev) => ({ ...prev, [activePath]: value }));
    },
    [activePath]
  );

  /** Opens the new-file field, optionally inside a folder. */
  function startNewFile(parent: string | null) {
    setNewFileParent(parent);
    setNewFileName("");
    setShowNewFile(true);
    // A file you just asked for should be visible, not hidden in a closed folder.
    if (parent) setCollapsed((prev) => ({ ...prev, [parent]: false }));
  }

  function createFile() {
    const raw = newFileName.trim();
    if (!raw) return;

    let path = raw.startsWith("/") ? raw : `${newFileParent ?? ""}/${raw}`;
    // Legacy projects nested everything under src/; keep writing at the root.
    path = path.replace(/^\/src\//, "/").replace(/\/{2,}/g, "/");
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
    setNewFileParent(null);
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

  /**
   * The inline "new file" field — shown at the project root, or inside the
   * folder whose `+` was clicked.
   */
  function renderNewFileField(parent: string | null, depth: number) {
    if (!showNewFile || newFileParent !== parent) return null;

    return (
      <div className="pt-2 pr-2 pb-1.5" style={{ paddingLeft: `${depth * 12 + 6}px` }}>
        <input
          autoFocus
          value={newFileName}
          onChange={(event) => setNewFileName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") createFile();
            if (event.key === "Escape") {
              setShowNewFile(false);
              setNewFileParent(null);
            }
          }}
          placeholder={parent ? "use-thing.ts" : "components/hero.tsx"}
          className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:border-primary"
        />
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          {parent ? `in ${parent}` : "project root"} · Enter to create · Esc to cancel
        </p>
      </div>
    );
  }

  function renderTree(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      if (node.type === "dir") {
        const isCollapsed = collapsed[node.path];
        return (
          <div key={node.path}>
            <div className="group/dir relative flex items-center">
              <button
                onClick={() =>
                  setCollapsed((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
                }
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1.5 pr-1 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
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
              <button
                onClick={() => startNewFile(node.path)}
                className="mr-1.5 shrink-0 opacity-0 transition group-hover/dir:opacity-100 focus-visible:opacity-100"
                title={`New file in ${node.name}`}
              >
                <FilePlus2 className="h-3 w-3 text-muted-foreground hover:text-primary" />
              </button>
            </div>

            {renderNewFileField(node.path, depth + 1)}

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
          </div>

          <div className="flex items-center gap-1.5">
            {slug ? (
              <Button
                variant={saveState === "error" ? "destructive" : "outline"}
                size="sm"
                className="rounded-full"
                disabled={saveState === "saving" || !dirty}
                onClick={saveClick}
                title="Save (Ctrl+S)"
              >
                {saveState === "saving" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : saveState === "error" ? (
                  <TriangleAlert className="mr-1.5 h-3.5 w-3.5" />
                ) : saveState === "saved" && !dirty ? (
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <FileCode2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                )}
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "error"
                    ? "Retry save"
                    : saveState === "saved" && !dirty
                      ? "Saved"
                      : "Save"}
              </Button>
            ) : null}
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
                  onClick={() => startNewFile(null)}
                  title="New file at the project root"
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

            {renderNewFileField(null, 0)}

            <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">
              {renderTree(tree)}
            </div>

            {/* One panel at the foot of the tree, split into two tabs. */}
            <div className="flex shrink-0 flex-col border-t border-border/70">
              <div className="flex items-center gap-1 px-2 pt-2 pb-1.5">
                <button
                  onClick={() => setPanelTab("blocks")}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors ${
                    panelTab === "blocks"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Blocks className="h-3 w-3" />
                  Blocks
                  {blocks && blocks.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                      {blocks.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setPanelTab("packages")}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors ${
                    panelTab === "packages"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Package className="h-3 w-3" />
                  Packages
                  {packageCount > 0 && (
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                      {packageCount}
                    </span>
                  )}
                </button>
              </div>

              {panelTab === "blocks" ? (
                <div className="px-3 pb-3">
                  <input
                    value={blockQuery}
                    onChange={(event) => setBlockQuery(event.target.value)}
                    placeholder="Search blocks"
                    className="mb-2 h-7 w-full rounded-md border bg-background px-2 text-[11px] outline-none focus:border-primary"
                  />
                  {!blocks ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading blocks…
                    </div>
                  ) : filteredBlocks.length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">
                      {blocks.length === 0 ? "No blocks available." : "No blocks match."}
                    </p>
                  ) : (
                    <ul className="max-h-56 space-y-0.5 overflow-auto">
                      {filteredBlocks.map((block) => (
                        <li key={block.name}>
                          <button
                            onClick={() => insertBlock(block)}
                            disabled={Boolean(insertingBlock)}
                            title={block.description || block.name}
                            className="group/block flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                          >
                            <Blocks className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-medium">
                                {block.title}
                              </span>
                              <span className="block truncate font-mono text-[10px] text-muted-foreground/70">
                                {block.name}
                              </span>
                            </span>
                            {insertingBlock === block.name ? (
                              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                            ) : (
                              <Plus className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/block:opacity-100" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground/70">
                    Inserting swaps the demo page for the block. Its files land in
                    components/blocks/ and save with your project.
                  </p>
                </div>
              ) : (
                <div className="px-3 pb-3">
                  {packageCount === 0 ? (
                    <p className="py-1 text-[11px] leading-4 text-muted-foreground">
                      Nothing yet. Packages appear the moment your code imports them.
                    </p>
                  ) : (
                    <ul className="max-h-56 space-y-1 overflow-auto">
                      {Object.entries(installedPackages).map(([name, version]) => (
                        <li
                          key={name}
                          className="group flex items-center justify-between gap-2 text-[11px]"
                        >
                          <code className="truncate font-mono text-foreground">{name}</code>
                          <div className="flex shrink-0 items-center gap-1.5">
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
                  <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground/70">
                    Imports are detected and installed automatically — there is nothing to add by
                    hand.
                  </p>
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
                title="Bundled in your browser by Sandpack — nothing runs on the server"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                browser sandbox
              </span>
            </div>

            {/* Combined Toolbar: Reloader, Theme Switcher, Resize Icons */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-full border bg-background/80 p-0.5 shadow-2xs backdrop-blur-xs">
                {/* Preview Reloader — rebuilds the sandbox from scratch. */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full"
                  onClick={reloadPreview}
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

          {/* Preview Canvas: edge to edge, no rounding — the sandbox owns the
              whole surface, including its own loading state. */}
          <div
            className={`flex min-h-0 flex-1 justify-center overflow-auto ${
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
              <SandpackPreviewPane
                key={previewKey}
                className="h-full w-full"
                files={previewFiles}
                vendoredFiles={previewVendored}
                compiledCss={previewCss ?? undefined}
                dependencies={Object.keys(installedPackages)}
                theme={previewTheme}
                onReady={handleSandpackReady}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
