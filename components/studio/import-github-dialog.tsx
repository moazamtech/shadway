"use client";

import { useState } from "react";
import { Check, FolderOpen, Github, Loader2 } from "lucide-react";

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
 * Bringing a component in from a repository.
 *
 * A component that already exists somewhere — in a design system somebody
 * else maintains, in a template, in the repository of the person who wrote it
 * — should not have to be copied out file by file and pasted into the
 * editor. The repository is read, the files are listed, and the author picks
 * what to take.
 *
 * The picking is the point. A repository holds a whole application, and a
 * project holds one component; the dialog shows the files by the folder they
 * live in, deepest folder first, so a component's own folder comes before
 * the folder that contains it and the author can see what belongs together.
 *
 * Styles are listed but not offered: the studio's stylesheet is the author's
 * own, and a repository's `globals.css` would silently replace it.
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
  const [listed, setListed] = useState<Listed | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setListed(null);
    setPicked({});
    setError(null);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/studio/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setError(data.error ?? "That repository could not be read.");
        setListed(null);
        return;
      }
      setListed({
        owner: data.owner,
        repo: data.repo,
        ref: data.ref,
        tree: data.tree,
        groups: Array.isArray(data.groups) ? data.groups : [],
      });
      setPicked({});
    } catch {
      setError("The repository could not be reached.");
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
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

  const chosen = Object.values(picked).filter(Boolean).length;

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
            Import from a repository
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Paste a GitHub repository address. The component files it holds are
            listed here, and you choose what comes into the project.
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
              placeholder="https://github.com/owner/repository"
              aria-label="Repository address"
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
            disabled={!chosen || importing}
            onClick={() => void runImport()}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Import {chosen || ""} file{chosen === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
