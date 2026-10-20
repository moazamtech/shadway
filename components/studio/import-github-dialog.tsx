"use client";

import { useState } from "react";
import { Check, FileCode2, FolderOpen, Github, Loader2, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Bringing a component in from somewhere else.
 *
 * A component that already exists — in a design system somebody else
 * maintains, in a template, in the repository of the person who wrote it, on
 * a registry this site does not run — should not have to be copied out file
 * by file and pasted into the editor. The source is read, the files are
 * listed, and the author picks what to take.
 *
 * A repository and a registry are two ways of saying the same thing, and the
 * studio takes both from one place. A repository holds a whole application
 * and a project holds one component, so the repository's files are listed by
 * the folder they live in, deepest folder first, and the author chooses from
 * them. A registry item is a single component described in full, so there is
 * nothing to choose between: what the item declares is what comes in.
 *
 * Styles are listed but not offered: the studio's stylesheet is the author's
 * own, and a repository's `globals.css` would silently replace it.
 *
 * What lands is the same either way. The component file goes to the path the
 * author chose for it, a demo goes to the demo page, and the packages the
 * imported code imports are installed by the sandbox, because the studio
 * reads its package list out of the code it holds.
 */

type Group = { directory: string; files: string[] };
type Tree = { components: string[]; demos: string[]; styles: string[]; others: number };

type Listed = {
  owner: string;
  repo: string;
  ref: string;
  tree: Tree;
  groups: Group[];
};

type ImportedFile = { path: string; content: string };

/** A file of a registry item, as the item describes it. */
type RegistryFile = {
  path: string;
  content: string;
  type?: string;
  target?: string;
};

type RegistryItem = {
  name: string;
  type?: string;
  files: RegistryFile[];
  dependencies?: string[];
  registryDependencies?: string[];
  skipped?: { path: string; reason: string }[];
};

/** The page a demo is rendered by. */
const DEMO_PATH = "/app/page.tsx";

/**
 * Where a file from the repository lands in the project.
 *
 * The project's own paths are `/app/...` and `/components/...`, and the
 * editor, the bundler and the registry all speak those. A repository has its
 * own layout — `src/components/ui/button.tsx`, `blocks/hero.tsx`,
 * `app/page.tsx` — so the path is rewritten to the project's shape rather
 * than imported as it is, because a file at `/src/components/...` is not
 * something the project's `@/` alias can reach.
 */
export function projectPathFor(repoPath: string): string {
  const normalized = repoPath.replace(/^\.\//, "").replace(/\\/g, "/");
  const componentsAt = normalized.lastIndexOf("components/");
  if (componentsAt >= 0) {
    return `/components/${normalized.slice(componentsAt + "components/".length)}`;
  }
  if (/(^|\/)app\/page\.tsx$/.test(normalized)) {
    return "/app/page.tsx";
  }
  const base = normalized.split("/").filter(Boolean).pop() ?? "imported.tsx";
  return `/components/${base}`;
}

/**
 * Which kind of source an address names.
 *
 * A registry item lives at `<registry>/r/<name>`, and a repository lives at
 * `github.com/<owner>/<repo>`. The host is what tells them apart, so the
 * studio does not have to ask which of the two the author meant before it
 * has read anything.
 */
function importKindFor(value: string): "github" | "registry" {
  const raw = value.trim();
  if (!raw) return "github";

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return "github";
  }

  const host = url.hostname.toLowerCase();
  if (host === "github.com" || host === "www.github.com") return "github";
  return "registry";
}

/**
 * The registry's tree, and the studio's.
 *
 * A registry keeps its items in a tree of its own — `registry/new-york-v4/
 * ui/button.tsx`, `blocks/sidebar-01/components/nav-main.tsx` — and the
 * studio has one layout: `app/` for the page, `components/` for the
 * component, `hooks/` and `lib/` for what travels with it. A file that keeps
 * the registry's path lands somewhere the project's `@/` alias cannot reach,
 * so the two trees are translated into each other.
 *
 * A block keeps a folder of its own, because two blocks can hold files with
 * the same name and a flattened one would put both at the same path.
 */
function projectPathForRegistryPath(inner: string, asModule: boolean): string {
  const segments = inner.split("/").filter(Boolean);
  if (!segments.length) return "";

  const [head, ...rest] = segments;

  if (head === "ui") return `/components/ui/${rest.join("/")}`;
  if (head === "hooks") return `/hooks/${rest.join("/")}`;
  if (head === "lib") return `/lib/${rest.join("/")}`;
  if (head === "components") return `/components/${rest.join("/")}`;
  if (head === "app") return `/app/${rest.join("/")}`;

  if (head === "blocks" && rest[0]) {
    const [block, ...inside] = rest;
    if (inside[0] === "page.tsx" && !asModule) return DEMO_PATH;
    if (inside[0] === "components") {
      return `/components/${block}/${inside.slice(1).join("/")}`;
    }
    return `/components/${block}/${inside.join("/")}`;
  }

  if (head === "examples" && !asModule) return DEMO_PATH;
  if (head === "charts") return `/components/${rest.join("/")}`;

  return `/components/${segments[segments.length - 1]}`;
}

/**
 * What a registry file is, read from what the item says about it.
 *
 * The type is the item's own word for the file, and a path that ends in
 * `page.tsx` is a page whatever it is called. A stylesheet is neither: the
 * studio's stylesheet is the author's own, and a registry's would replace it.
 */
function registryFileKind(file: RegistryFile): "demo" | "style" | "other" {
  const type = (file.type ?? "").toLowerCase();
  if (type === "registry:page" || type === "registry:example") return "demo";
  if (type === "registry:style" || type === "registry:theme") return "style";
  if (/(^|\/)page\.tsx$/.test(file.path.toLowerCase())) return "demo";
  if (/\.(css|scss|postcss)$/.test(file.path.toLowerCase())) return "style";
  return "other";
}

/**
 * The registry's own aliases, rewritten into the studio's.
 *
 * A shadcn-style registry addresses its primitives through its own tree
 * (`@/registry/new-york-v4/ui/accordion`), which is a path into the registry
 * and not into the project. Left as they are, the imported file imports a
 * module that does not exist, and the preview answers with an error the
 * author has no way to read. The studio's primitives live at
 * `@/components/ui/…`, so the tree is rewritten onto it.
 */
function rewriteRegistryImports(content: string): string {
  return content.replace(
    /(["'])@\/registry\/[^/"']+\/([^"']+)\1/g,
    (match, quote: string, rest: string) => {
      const mapped = projectPathForRegistryPath(rest, true).replace(/\.(tsx?|jsx?)$/, "");
      if (!mapped) return match;
      return `${quote}@${mapped}${quote}`;
    }
  );
}

/**
 * The files a registry item brings into the project.
 *
 * A `target` is the item's own answer to where the file goes, and it wins
 * over everything else: it is the path the registry's own installer would
 * write. A file without one is placed by the shape of its path, and a demo
 * is placed at the demo page, which is the one file in the project that a
 * registry item is allowed to replace.
 */
function projectFilesForRegistryItem(item: RegistryItem): ImportedFile[] {
  const files: ImportedFile[] = [];
  let demoTaken = false;

  for (const file of item.files ?? []) {
    const kind = registryFileKind(file);
    if (kind === "style") continue;

    let path: string;
    // A target is written the way the registry's own installer reads it, and
    // `~/` is the project's root there.
    const target = (file.target ?? "").replace(/^~\//, "").replace(/^\/+/, "");
    if (
      target &&
      !target.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      path = `/${target}`;
    } else if (kind === "demo" && !demoTaken) {
      path = DEMO_PATH;
      demoTaken = true;
    } else {
      const inner = file.path.replace(/^\/+/, "").replace(/^registry\/[^/]+\//, "");
      path = projectPathForRegistryPath(inner, true) || `/components/${file.path}`;
    }

    // The demo page is one page, and the second demo does not take it.
    if (path === DEMO_PATH) demoTaken = true;

    files.push({ path, content: rewriteRegistryImports(file.content) });
  }

  return files;
}

export function ImportGithubDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the files to add, already in the project's paths. */
  onImport: (files: ImportedFile[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<"github" | "registry">("github");
  const [listed, setListed] = useState<Listed | null>(null);
  const [item, setItem] = useState<RegistryItem | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setListed(null);
    setItem(null);
    setPicked({});
    setError(null);
  }

  /**
   * The repository's files, listed.
   *
   * The tree is not downloaded: a repository tree is cheap to fetch and
   * expensive to read file by file, so the author picks first and the
   * contents are pulled only for the files they chose.
   */
  async function loadRepository() {
    const response = await fetch("/api/studio/import-github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {
      throw new Error("That repository could not be reached.");
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "That repository could not be read.");
    }
    setListed({
      owner: data.owner,
      repo: data.repo,
      ref: data.ref,
      tree: data.tree,
      groups: Array.isArray(data.groups) ? data.groups : [],
    });
    setPicked({});
  }

  /**
   * A registry item, read whole.
   *
   * An item is one component described in full, so there is nothing to pick
   * between: the item's files are what the studio shows, and the author
   * decides whether to take the lot of it.
   */
  async function loadRegistry() {
    const response = await fetch("/api/studio/import-registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {
      throw new Error("That registry could not be reached.");
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "That registry item could not be read.");
    }
    setItem({
      name: data.name,
      type: data.type,
      files: Array.isArray(data.files) ? data.files : [],
      dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
      registryDependencies: Array.isArray(data.registryDependencies)
        ? data.registryDependencies
        : [],
      skipped: Array.isArray(data.skipped) ? data.skipped : [],
    });
  }

  async function load() {
    const kind = importKindFor(url);
    setSource(kind);
    setLoading(true);
    setError(null);
    setListed(null);
    setItem(null);
    try {
      if (kind === "registry") {
        await loadRegistry();
      } else {
        await loadRepository();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : kind === "registry"
            ? "That registry item could not be read."
            : "That repository could not be reached."
      );
    } finally {
      setLoading(false);
    }
  }

  /** The chosen files, read from the repository. */
  async function runRepositoryImport() {
    if (!listed) return;
    const paths = Object.keys(picked).filter((path) => picked[path]);
    if (!paths.length) return;

    setImporting(true);
    setError(null);
    try {
      const response = await fetch("/api/studio/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, paths }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setError(data.error ?? "The files could not be read.");
        return;
      }
      const files = (Array.isArray(data.files) ? data.files : []).map(
        (file: { path: string; content: string }) => ({
          path: projectPathFor(file.path),
          content: file.content,
        }),
      );
      if (files.length) onImport(files);
      onOpenChange(false);
      reset();
    } catch {
      setError("The files could not be read.");
    } finally {
      setImporting(false);
    }
  }

  /** The item's files, taken whole. */
  function runRegistryImport() {
    if (!item) return;
    const files = projectFilesForRegistryItem(item);
    if (!files.length) {
      setError("That item has no files that can be brought into the project.");
      return;
    }
    onImport(files);
    onOpenChange(false);
    reset();
  }

  const chosen = Object.values(picked).filter(Boolean).length;
  const registryFiles = item ? projectFilesForRegistryItem(item) : [];
  const count = source === "registry" ? registryFiles.length : chosen;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl bg-popover p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" aria-hidden="true" />
            Import a component
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Paste a repository address or the address of a registry item. The
            component files it holds are listed here, and you choose what
            comes into the project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && url.trim()) void load();
              }}
              placeholder="https://github.com/owner/repository  ·  https://registry.example/r/name"
              aria-label="Repository or registry address"
              spellCheck={false}
              className="font-mono text-sm"
            />
            <Button type="button" onClick={() => void load()} disabled={loading || !url.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Read
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {listed ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {listed.owner}/{listed.repo} · {listed.ref} ·{" "}
                {listed.tree.components.length} component
                {listed.tree.components.length === 1 ? "" : "s"} ·{" "}
                {listed.tree.demos.length} demo
                {listed.tree.demos.length === 1 ? "" : "s"}
              </p>

              {listed.groups.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  That repository has no component files in it.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {listed.groups.map((group) => (
                    <div key={group.directory} className="border-b border-border/40 last:border-b-0">
                      <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                        <FolderOpen className="h-3 w-3" aria-hidden="true" />
                        <span className="truncate">{group.directory}</span>
                      </div>
                      {group.files.map((file) => {
                        const isDemo = /(^|\/)app\/page\.tsx$/.test(file);
                        return (
                          <label
                            key={file}
                            className="flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-muted/40"
                          >
                            <Checkbox
                              checked={Boolean(picked[file])}
                              onCheckedChange={(checked) =>
                                setPicked((current) => ({
                                  ...current,
                                  [file]: checked === true,
                                }))
                              }
                              aria-label={file}
                            />
                            <span className="truncate font-mono text-xs">{file}</span>
                            {isDemo ? (
                              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                                replaces the demo page
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {listed.tree.styles.length ? (
                <p className="text-xs text-muted-foreground">
                  The repository also has {listed.tree.styles.length} stylesheet
                  {listed.tree.styles.length === 1 ? "" : "s"}. They are not
                  imported: the stylesheet in this project is yours.
                </p>
              ) : null}
            </div>
          ) : null}

          {item ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {item.name}
                {item.type ? ` · ${item.type}` : ""} · {registryFiles.length} file
                {registryFiles.length === 1 ? "" : "s"}
                {item.dependencies?.length
                  ? ` · ${item.dependencies.length} package${item.dependencies.length === 1 ? "" : "s"}`
                  : ""}
              </p>

              {registryFiles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  That item has no files that can be brought into the project.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {registryFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center gap-2.5 border-b border-border/40 px-3 py-1.5 text-sm last:border-b-0"
                    >
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate font-mono text-xs">{file.path}</span>
                      {file.path === DEMO_PATH ? (
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          replaces the demo page
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {item.dependencies?.length ? (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Package className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>
                    The item needs {item.dependencies.join(", ")}. The studio
                    installs the packages the imported code imports, so these
                    come in with the files.
                  </span>
                </p>
              ) : null}

              {item.skipped?.length ? (
                <p className="text-xs text-muted-foreground">
                  {item.skipped.length} file{item.skipped.length === 1 ? "" : "s"} did not come
                  in: {item.skipped.map((file) => `${file.path} (${file.reason})`).join(", ")}.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={!count || importing}
            onClick={() => {
              if (source === "registry") runRegistryImport();
              else void runRepositoryImport();
            }}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Import {count || ""} file{count === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
