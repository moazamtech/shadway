"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Check,
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
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Smartphone,
  Sun,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioEditor, languageFor } from "@/components/studio/studio-editor";
import { PublishPanel } from "@/components/studio/publish-panel";
import type { PreviewFiles } from "@/lib/preview/files";
import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import { SHADCN_FILE_PATHS } from "@/lib/preview/template/names";
import { collectNpmDependencies, sandboxPackageVersion } from "@/lib/studio/deps";
import { projectPathFor } from "@/lib/studio/sandpack";
import { usePreviewCss } from "@/lib/studio/use-preview-css";
import {
  DEFAULT_DEMO_PATH,
  DEFAULT_STYLE_PATH,
  starterFiles,
} from "@/lib/studio/starter";
import {
  projectPayload,
  resolveComponentPath,
  retargetImports,
} from "@/lib/studio/project";

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
  /** Where the author keeps the component inside `files`. */
  componentPath?: string;
  dependencies?: string[];
};

/* ------------------------------------------------------- shadcn/ui files -- */

/**
 * The small square icon button used throughout the studio chrome.
 *
 * One definition keeps every control in the header, the explorer and the
 * preview toolbar the same size, radius and hover treatment.
 */
const ICON_BUTTON =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

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
  // Open the component the author actually keeps — they may have renamed it.
  const [activePath, setActivePath] = useState(() =>
    initial?.componentPath && initialFiles[initial.componentPath] !== undefined
      ? initial.componentPath
      : resolveComponentPath(initialFiles)
  );
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [debouncedFiles, setDebouncedFiles] = useState<PreviewFiles>(initialFiles);
  const [newFileName, setNewFileName] = useState("");
  /** The folder a new file is being created in — null means the project root. */
  const [newFileParent, setNewFileParent] = useState<string | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  /** The file whose name is being edited in the tree, if any. */
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    "/components/ui": true,
  });
  const [showExplorer, setShowExplorer] = useState(true);
  const [showEditor, setShowEditor] = useState(true);
  const [installedPackages, setInstalledPackages] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.dependencies ?? []).map((name) => [name, ""]))
  );
  /** The detected-packages panel at the foot of the tree. */
  const [showPackages, setShowPackages] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const savingRef = useRef(false);
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

    // Add the package right away, so the sandbox reinstalls the moment the
    // author's code mentions it rather than after the registry round trip.
    // The version is refined in the background: `latest` for anything unknown,
    // the pinned range for the packages this site is built against.
    setInstalledPackages((prev) => {
      const next = { ...prev };
      for (const pkg of missing) {
        if (!next[pkg]) next[pkg] = sandboxPackageVersion(pkg);
      }
      return next;
    });

    for (const pkg of missing) {
      void (async () => {
        try {
          const res = await fetch(`/api/registry/resolve-package?name=${encodeURIComponent(pkg)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.version) {
              setInstalledPackages((prev) => ({ ...prev, [pkg]: data.version }));
            }
          }
        } catch {
          // Keep the optimistic version; the sandbox already installed it.
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

  /**
   * Editor-wide shortcuts.
   *
   * - Ctrl/Cmd+S — save now, the muscle memory every editor shares.
   * - Ctrl/Cmd+Enter — rebuild the preview sandbox from scratch.
   *
   * Undo and redo (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z) are Monaco's own bindings and
   * are deliberately left alone; they act on the active file's model, which is
   * what the author expects.
   */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        if (slug) void saveProject(snapshotRef.current);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        setPreviewKey((value) => value + 1);
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
   * The project the stylesheet is compiled from.
   *
   * Debounced, because the compile is a round trip to the real Tailwind
   * compiler. The sandbox itself is fed the *live* project instead, so typing
   * lands in the preview immediately while the stylesheet follows behind.
   *
   * The vendored shadcn/ui sources are not merged in here — the sandbox adds
   * them itself (`SandpackPreviewPane`), so this stays small enough to send to
   * the stylesheet compiler on every edit.
   */

  // Styles are compiled on the server — Sandpack builds the JavaScript, and
  // the stylesheet it cannot produce itself is handed to it as `/styles.css`.
  // The project's own stylesheet arrives with the first render, so the sandbox
  // is built once, correctly styled.
  //
  // The same request reports the vendored shadcn/ui files the project reaches,
  // which is how the sandbox gets `@/components/ui/*` without the browser ever
  // downloading the registry.
  const {
    css: previewCss,
    vendored: previewVendored,
    error: previewCssError,
  } = usePreviewCss(debouncedFiles, debouncedFiles[DEFAULT_STYLE_PATH], {
    initialCss,
    initialVendored: initialVendoredFiles,
  });

  /* -------------------------------------------- the sandbox, kept in step -- */

  /**
   * The preview is driven from here, not from a callback.
   *
   * `SandpackPreviewPane` is given the live project and writes whatever changed
   * into the running sandbox itself — see the note there on why the project can
   * never be handed over as a prop. That is what makes an edit show up as it is
   * typed rather than after the save debounce.
   */
  const installedNames = useMemo(
    () => Object.keys(installedPackages),
    [installedPackages]
  );

  /**
   * The page the preview renders.
   *
   * Normally the author's `app/page.tsx`. If they deleted it, the component is
   * rendered directly rather than leaving the pane blank — the demo is a
   * convenience, and losing it should not cost the preview.
   */
  const previewPage = useMemo(() => {
    if (files[DEFAULT_DEMO_PATH] !== undefined) return DEFAULT_DEMO_PATH;
    const component = resolveComponentPath(files);
    return files[component] !== undefined ? component : DEFAULT_DEMO_PATH;
  }, [files]);

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

  function startRename(path: string) {
    setRenamingPath(path);
    setRenameValue(path.slice(path.lastIndexOf("/") + 1));
  }

  /**
   * Renames — or moves — a file, and takes its importers with it.
   *
   * The value is a file name, or a path from the project root when it contains
   * a `/`. Imports that resolved to the old path are rewritten to the new one,
   * so renaming the component cannot leave the demo pointing at a file that no
   * longer exists.
   */
  function commitRename(from: string) {
    const raw = renameValue.trim();
    setRenamingPath(null);
    setRenameValue("");
    if (!raw || files[from] === undefined) return;

    const directory = from.slice(0, from.lastIndexOf("/"));
    let to = raw.includes("/")
      ? `/${raw.replace(/^\/+/, "")}`
      : `${directory}/${raw}`;
    to = to.replace(/^\/src\//, "/").replace(/\/{2,}/g, "/");
    if (!/\.[a-z0-9]+$/i.test(to)) to += from.slice(from.lastIndexOf("."));

    if (to === from || files[to] !== undefined) return;

    // Retarget against the map as it was, so the old path still resolves.
    const retargeted = retargetImports(files, from, to);
    const content = retargeted[from];
    const next = { ...retargeted };
    delete next[from];
    next[to] = content;

    setFiles(next);
    if (activePath === from) setActivePath(to);
  }

  function deleteFile(path: string) {
    // The stylesheet is the project's theme, not a component file: without it
    // the preview is unstyled rather than simply empty.
    if (path === DEFAULT_STYLE_PATH) return;

    const next = { ...files };
    delete next[path];
    setFiles(next);

    if (activePath === path) {
      const fallback = resolveComponentPath(next);
      setActivePath(
        next[fallback] !== undefined ? fallback : Object.keys(next).sort()[0] ?? path
      );
    }
  }

  /**
   * The inline "new file" field — shown at the project root, or inside the
   * folder whose `+` was clicked.
   */
  function renderNewFileField(parent: string | null, depth: number) {
    if (!showNewFile || newFileParent !== parent) return null;

    return (
      <div className="pt-1.5 pr-2 pb-1" style={{ paddingLeft: `${depth * 12 + 6}px` }}>
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
          spellCheck={false}
          className="h-7 w-full rounded-md border border-primary/60 bg-background px-2 font-mono text-[11px] outline-none ring-2 ring-primary/15"
        />
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {parent ? `in ${parent}` : "project root"} · ↵ create · esc cancel
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
                className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md pr-1 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                style={{ paddingLeft: `${depth * 12 + 6}px` }}
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform ${
                    isCollapsed ? "" : "rotate-90"
                  }`}
                />
                <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{node.name}</span>
              </button>
              <button
                onClick={() => startNewFile(node.path)}
                className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition hover:bg-accent hover:text-primary group-hover/dir:opacity-100 focus-visible:opacity-100"
                title={`New file in ${node.name}`}
              >
                <FilePlus2 className="h-3 w-3" />
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

      if (renamingPath === node.path) {
        return (
          <div
            key={node.path}
            className="py-0.5 pr-1.5"
            style={{ paddingLeft: `${depth * 12 + 22}px` }}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onBlur={() => commitRename(node.path)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename(node.path);
                if (event.key === "Escape") {
                  setRenamingPath(null);
                  setRenameValue("");
                }
              }}
              placeholder="name.tsx"
              spellCheck={false}
              className="h-7 w-full rounded-md border border-primary/60 bg-background px-2 font-mono text-[11px] outline-none ring-2 ring-primary/15"
            />
          </div>
        );
      }

      return (
        <div key={node.path} className="group/file relative flex items-center">
          <button
            onClick={() => void openFile(node.path)}
            className={`flex h-7 flex-1 items-center gap-2 rounded-md pr-2 text-left text-[13px] transition-colors ${
              isActive
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
            style={{ paddingLeft: `${depth * 12 + 22}px` }}
            title={
              isVendored
                ? "Ships with shadcn/ui — copy it into your project to edit it"
                : undefined
            }
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isVendored ? "opacity-60" : tone}`} />
            <span className="truncate">{node.name}</span>
            {isVendored && (
              <span className="ml-auto shrink-0 text-[9px] tracking-wider text-muted-foreground/50 uppercase">
                ui
              </span>
            )}
          </button>
          {isVendored ? (
            <button
              onClick={() => void materialize(node.path)}
              className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition hover:bg-accent hover:text-primary group-hover/file:opacity-100 focus-visible:opacity-100"
              title="Copy into project"
            >
              <Plus className="h-3 w-3" />
            </button>
          ) : (
            <>
              <button
                onClick={() => startRename(node.path)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition hover:bg-accent hover:text-foreground group-hover/file:opacity-100 focus-visible:opacity-100"
                title="Rename or move"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => deleteFile(node.path)}
                className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition hover:bg-accent hover:text-destructive group-hover/file:opacity-100 focus-visible:opacity-100"
                title="Delete file"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      );
    });
  }

  if (publishing) {
    return (
      <PublishPanel
        slug={slug}
        files={files}
        compiledCss={previewCss ?? undefined}
        vendoredFiles={previewVendored}
        dependencies={Object.keys(installedPackages)}
        theme={previewTheme}
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
      {/* Header — breadcrumb on the left, project actions on the right. */}
      <header className="relative z-20 flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            asChild
            title="All components"
          >
            <Link href="/studio">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="ml-1 hidden text-[11px] font-medium tracking-[0.16em] text-muted-foreground/70 uppercase sm:inline">
            Studio
          </span>
          <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted-foreground/40 sm:inline" />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled component"
            spellCheck={false}
            className="h-7 w-full min-w-0 max-w-[300px] rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none transition-colors hover:border-border/70 focus:border-border focus:bg-accent/40"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {/* Save state — a quiet status pill, click to save now. */}
          {slug ? (
            <button
              onClick={saveClick}
              disabled={saveState === "saving" || !dirty}
              title="Save (Ctrl+S)"
              className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors ${
                saveState === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : dirty
                    ? "border-border bg-background text-foreground hover:bg-accent"
                    : "border-transparent text-muted-foreground"
              }`}
            >
              {saveState === "saving" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : saveState === "error" ? (
                <TriangleAlert className="h-3 w-3" />
              ) : dirty ? (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              ) : (
                <Check className="h-3 w-3 text-emerald-500" />
              )}
              {saveState === "saving"
                ? "Saving"
                : saveState === "error"
                  ? "Retry"
                  : dirty
                    ? "Save"
                    : "Saved"}
            </button>
          ) : null}

          <span className="mx-0.5 hidden h-4 w-px bg-border/60 sm:block" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => {
              setFiles(initialFiles);
              if (initial) setTitle(initial.title);
            }}
            title="Reset files"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-3 text-[12px] shadow-xs"
            onClick={() => setPublishing(true)}
          >
            <Rocket className="h-3.5 w-3.5" />
            {initial?.status === "published" ? "Update" : "Publish"}
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* File explorer — the project plus the shadcn/ui sources it can
            reach, marked until they are copied into the project. */}
        {showExplorer && (
          <aside className="relative flex w-60 shrink-0 flex-col border-r border-border/60 bg-muted/20">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-2.5">
              <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Files
              </span>
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {Object.keys(files).length}
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  className={ICON_BUTTON}
                  onClick={() => startNewFile(null)}
                  title="New file"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                </button>
                <button
                  className={ICON_BUTTON}
                  onClick={() => setShowExplorer(false)}
                  title="Hide files"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {renderNewFileField(null, 0)}

            <div className="min-h-0 flex-1 overflow-auto px-1.5 py-1.5">
              {renderTree(tree)}
            </div>

            {/* Detected packages — the sandbox installs what the code imports,
                so this is a read-only view of what is actually running. */}
            <div className="shrink-0 border-t border-border/60">
              <button
                onClick={() => setShowPackages((value) => !value)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:text-foreground"
              >
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform ${
                    showPackages ? "rotate-90" : ""
                  }`}
                />
                <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Packages
                </span>
                {packageCount > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                    {packageCount}
                  </span>
                )}
              </button>

              {showPackages && (
                <div className="px-3 pb-3">
                  {packageCount === 0 ? (
                    <p className="text-[11px] leading-4 text-muted-foreground/80">
                      Nothing yet — packages appear here the moment your code imports them.
                    </p>
                  ) : (
                    <ul className="max-h-52 space-y-0.5 overflow-auto">
                      {Object.entries(installedPackages).map(([name, version]) => (
                        <li
                          key={name}
                          className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/50"
                        >
                          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
                            {name}
                          </code>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                            {version || sandboxPackageVersion(name)}
                          </span>
                          <button
                            onClick={() => removePackage(name)}
                            className="shrink-0 text-muted-foreground/50 opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                            title={`Remove ${name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Code editor */}
        {showEditor && (
          <section className="relative flex min-w-0 flex-1 flex-col border-r border-border/60">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-2.5">
              {(() => {
                const { Icon, tone } = iconFor(activePath);
                const segments = activePath.split("/").filter(Boolean);
                const filename = segments.pop() ?? activePath;
                return (
                  <>
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
                    <span className="flex min-w-0 items-baseline gap-1 font-mono text-[11px]">
                      {segments.length > 0 && (
                        <span className="truncate text-muted-foreground/60">
                          /{segments.join("/")}/
                        </span>
                      )}
                      <span className="shrink-0 text-foreground">{filename}</span>
                    </span>
                  </>
                );
              })()}

              {vendoredActive && (
                <>
                  <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    shadcn/ui
                  </span>
                  <button
                    onClick={() => void materialize(activePath)}
                    className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Editing already copies it in — this does it in one click"
                  >
                    <Plus className="h-3 w-3" />
                    Copy in
                  </button>
                </>
              )}
              {openingPath && (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              )}

              <button
                className={`${ICON_BUTTON} ml-auto`}
                onClick={() => setShowEditor(false)}
                title="Hide editor"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
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
                  onSave={saveClick}
                  onRun={reloadPreview}
                  projectFiles={files}
                  packages={Object.keys(installedPackages)}
                />
              )}
            </div>
          </section>
        )}

        {/* Preview */}
        <section className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {!showExplorer && (
                <button
                  className="flex h-6 items-center gap-1 rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setShowExplorer(true)}
                  title="Show files"
                >
                  <PanelLeft className="h-3 w-3" />
                  Files
                </button>
              )}
              {!showEditor && (
                <button
                  className="flex h-6 items-center gap-1 rounded-md border border-border/70 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setShowEditor(true)}
                  title="Show code"
                >
                  <Code2 className="h-3 w-3" />
                  Code
                </button>
              )}
              <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Preview
              </span>
              <span
                className="hidden items-center gap-1.5 text-[10px] text-muted-foreground/80 sm:flex"
                title="Bundled in your browser by Sandpack — nothing runs on the server"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px] shadow-emerald-500/20" />
                live
              </span>
            </div>

            {/* Preview controls — one segmented control, hairline dividers. */}
            <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5 shadow-2xs">
              <button
                className={ICON_BUTTON}
                onClick={reloadPreview}
                title="Reload preview (Ctrl+Enter)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                className={ICON_BUTTON}
                onClick={() =>
                  setPreviewTheme(previewTheme === "light" ? "dark" : "light")
                }
                title={`Switch to ${previewTheme === "light" ? "dark" : "light"} theme`}
              >
                {previewTheme === "light" ? (
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-sky-400" />
                )}
              </button>

              <span className="mx-0.5 h-3.5 w-px bg-border/60" />

              <button
                className={`${ICON_BUTTON} ${
                  viewport === "desktop" ? "bg-accent text-foreground" : ""
                }`}
                onClick={() => setViewport("desktop")}
                title="Desktop"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                className={`${ICON_BUTTON} ${
                  viewport === "mobile" ? "bg-accent text-foreground" : ""
                }`}
                onClick={() => setViewport("mobile")}
                title="Mobile (390px)"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>

              <span className="mx-0.5 h-3.5 w-px bg-border/60" />

              <button
                className={`${ICON_BUTTON} ${
                  !showExplorer && !showEditor ? "bg-accent text-foreground" : ""
                }`}
                onClick={() => {
                  if (!showExplorer && !showEditor) {
                    setShowExplorer(true);
                    setShowEditor(true);
                  } else {
                    setShowExplorer(false);
                    setShowEditor(false);
                  }
                }}
                title={
                  !showExplorer && !showEditor
                    ? "Exit full screen preview"
                    : "Full screen preview"
                }
              >
                {!showExplorer && !showEditor ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Preview canvas — the sandbox owns the whole surface, including its
              own loading state. */}
          <div
            className={`relative flex min-h-0 flex-1 justify-center overflow-auto ${
              viewport === "mobile" ? "items-center bg-muted/20 p-4" : "p-0"
            }`}
          >
            <div
              className={`overflow-hidden transition-[width,max-height,border-radius,box-shadow] duration-200 ease-out ${
                viewport === "mobile"
                  ? "h-full max-h-[844px] w-[390px] rounded-2xl border border-border/60 bg-background shadow-xl"
                  : "h-full w-full"
              }`}
            >
              <SandpackPreviewPane
                key={previewKey}
                className="h-full w-full"
                files={files}
                vendoredFiles={previewVendored}
                compiledCss={previewCss ?? undefined}
                dependencies={installedNames}
                theme={previewTheme}
                page={previewPage}
              />
            </div>

            {/*
             * A stylesheet that would not compile.

             * The hook keeps the last good stylesheet when a compile fails, so
             * the preview stays *almost* right — and that is exactly what makes
             * it hard to notice. The class the author has just added is the one
             * missing, everything else looks deliberate, and without this the
             * only symptom is a component that is subtly not what they wrote.

             * So it says so, in the place the author is already looking, and
             * names the likely cause: a `globals.css` that will not compile is
             * almost always an `@apply` of a utility that does not exist, which
             * is a mistake in the file being edited right now.
             */}
            {previewCssError ? (
              <div
                role="status"
                className="absolute inset-x-0 bottom-0 z-10 border-t border-destructive/25 bg-destructive/8 px-4 py-2 text-xs text-destructive backdrop-blur-sm"
              >
                <span className="font-medium">Stylesheet not updated.</span>{" "}
                {previewCssError} The preview is showing your last compiling
                version — an <code className="font-mono">@apply</code> of a class
                that does not exist is the usual cause.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
