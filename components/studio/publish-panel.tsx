"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  Circle,
  FileCode2,
  ImagePlus,
  Loader2,
  Moon,
  Rocket,
  Sun,
  TriangleAlert,
  Undo2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PreviewFiles } from "@/lib/preview/files";
import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import { projectPayload, resolveComponentPath } from "@/lib/studio/project";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";

/**
 * The sandbox is the same engine the studio previews with, so what the author
 * approves here is literally the build the marketplace will serve. Code-split
 * and client-only, like the studio's copy.
 */
const SandpackPreviewPane = dynamic(
  () =>
    import("@/components/studio/sandpack-preview").then(
      (mod) => mod.SandpackPreviewPane
    ),
  { ssr: false }
);

export type PublishMeta = {
  title: string;
  description: string;
  tags: string;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
};

type Phase = "building" | "submitting" | "done" | "failed";

/** The two things that really happen, in order, when a component is submitted. */
const STEPS = [
  {
    label: "Bundle and capture",
    hint: "Compiled with the same build the marketplace serves, then rendered once for the cover.",
  },
  {
    label: "Submit for review",
    hint: "An admin approves it, and decides whether it is listed publicly or as an unlisted link.",
  },
] as const;

/**
 * Step 2 of publishing: describe the component, attach media, then publish.
 * Kept as its own route so the studio stays a pure editor.
 *
 * When a `slug` is present the component is updated in place — the record
 * keeps its slug, files and history instead of creating a second item.
 */
export function PublishPanel({
  slug,
  files,
  compiledCss,
  vendoredFiles,
  dependencies,
  theme = "light",
  initialMeta,
  status = "draft",
  onBack,
}: {
  slug?: string;
  /** The whole project, so this page can show the real thing it is publishing. */
  files: PreviewFiles;
  compiledCss?: string;
  vendoredFiles?: PreviewFileInput[];
  dependencies: string[];
  theme?: "light" | "dark";
  initialMeta?: Partial<PublishMeta>;
  status?: "draft" | "pending" | "published" | "hidden" | "flagged";
  onBack?: () => void;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<PublishMeta>({
    title: "",
    description: "",
    tags: "",
    category: "ui",
    thumbnailUrl: "",
    videoUrl: "",
    ...initialMeta,
  });
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">(theme);

  // The submission dialog: it reports the real pipeline phases, and a real
  // failure message lets the author go fix the code instead of guessing.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("building");
  const [failedStep, setFailedStep] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildWarning, setBuildWarning] = useState<string | null>(null);

  /**
   * The exact payload that will be stored — the same object the editor's
   * autosave sends, so the file list, the component and the demo cannot
   * disagree with what the studio has open.
   */
  const payload = useMemo(
    () => projectPayload(files, meta.title, dependencies),
    [files, meta.title, dependencies]
  );

  const isUpdate = status === "published";
  const registrySlug =
    slug ||
    meta.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    "your-slug";

  /** The demo if the author kept one, otherwise the component itself. */
  const previewPage = useMemo(() => {
    if (files[DEFAULT_DEMO_PATH] !== undefined) return DEFAULT_DEMO_PATH;
    const component = resolveComponentPath(files);
    return files[component] !== undefined ? component : DEFAULT_DEMO_PATH;
  }, [files]);

  async function uploadMedia(file: File, kind: "image" | "video") {
    setUploading(kind);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const response = await fetch("/api/components/upload-media", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      setMeta((prev) => ({
        ...prev,
        [kind === "image" ? "thumbnailUrl" : "videoUrl"]: data.url,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  /** One dropzone for both: the file decides where it belongs. */
  function acceptFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    void uploadMedia(file, file.type.startsWith("video/") ? "video" : "image");
  }

  /**
   * The submission pipeline. Every message names what the pipeline is actually
   * doing at that moment; a build failure is the real compiler error, not a
   * generic toast.
   */
  async function publish() {
    setPublishing(true);
    setBuildError(null);
    setBuildWarning(null);
    setError(null);
    setDialogOpen(true);
    setPhase("building");
    setFailedStep(0);

    try {
      if (!payload.code.trim()) {
        throw new Error("Write your component before publishing.");
      }
      if (!meta.title.trim()) throw new Error("Give your component a title.");

      // Build + screenshot: the component is compiled with the same bundler
      // customers will run, then rendered once in a headless browser so the
      // queue (and the marketplace card) shows a real capture.
      const buildResponse = await fetch("/api/studio/build-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          code: payload.code,
          componentPath: payload.componentPath,
          demoCode: payload.demoCode,
          styleCode: payload.styleCode,
          files: payload.files,
        }),
      });
      const buildData = await buildResponse.json();
      if (!buildResponse.ok) {
        throw new Error(buildData.error || "The component failed to build.");
      }
      if (buildData.warning) setBuildWarning(buildData.warning);

      setPhase("submitting");
      setFailedStep(1);

      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: meta.title,
          description: meta.description,
          tags: meta.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          dependencies,
          category: meta.category,
          componentPath: payload.componentPath,
          styleCode: payload.styleCode,
          // A cover the author uploaded wins; otherwise the captured shot.
          thumbnailUrl: meta.thumbnailUrl || buildData.thumbnailUrl || "",
          videoUrl: meta.videoUrl,
          code: payload.code,
          demoCode: payload.demoCode,
          files: payload.files,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Sign in to publish. Open the login page, then try again.");
      }
      if (!response.ok) throw new Error(data.error || "Failed to publish component");

      // The server decides the final state: user submissions go straight to
      // the review queue, while an admin publish is live immediately.
      setPhase("done");
      setTimeout(() => {
        if (data.item?.status === "published") {
          router.push(`/c/${data.item.slug}`);
        } else {
          router.push("/studio?submitted=1");
        }
      }, 900);
      return; // dialog self-closes on redirect; don't clobber the "done" state
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submission failed. Please try again.";
      setBuildError(message);
      setPhase("failed");
    } finally {
      setPublishing(false);
    }
  }

  function closeDialog() {
    if (publishing) return;
    setDialogOpen(false);
    setPhase("building");
    setFailedStep(0);
    setBuildError(null);
  }

  /** Where each step stands right now — never a timer, only real progress. */
  function stepState(index: number): "pending" | "active" | "done" | "failed" {
    if (phase === "failed") {
      if (index < failedStep) return "done";
      if (index === failedStep) return "failed";
      return "pending";
    }
    if (phase === "done") return "done";
    if (phase === "building") return index === 0 ? "active" : "pending";
    return index === 0 ? "done" : "active";
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-2 px-4 lg:px-6">
          <Link
            href="/studio"
            className="text-sm font-semibold tracking-tight transition-colors hover:text-primary"
          >
            Shadway
          </Link>
          <span className="text-muted-foreground/40" aria-hidden="true">
            /
          </span>
          <span className="text-sm text-muted-foreground">Studio</span>
          <Badge variant="secondary" className="ml-1 rounded-md px-1.5 text-[10px]">
            {isUpdate ? "Update" : "Submit"}
          </Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" asChild>
              <Link href="/studio">All components</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-xs"
              onClick={onBack}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to editor
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isUpdate ? "Update your component" : "Describe your component"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This becomes the card on the marketplace and the description agents read.
            </p>
          </div>

          <label className="block space-y-1.5 text-sm font-medium">
            Title
            <input
              className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Animated gradient button"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium">
            Description
            <textarea
              className="min-h-24 w-full rounded-lg border border-border/60 bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              placeholder="A button with an animated gradient border and loading state."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium">
              Category
              <select
                className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60"
                value={meta.category}
                onChange={(e) => setMeta({ ...meta, category: e.target.value })}
              >
                <option value="ui">UI</option>
                <option value="block">Block</option>
                <option value="marketing">Marketing</option>
                <option value="animation">Animation</option>
                <option value="form">Form</option>
                <option value="data">Data</option>
              </select>
            </label>

            <label className="block space-y-1.5 text-sm font-medium">
              Tags
              <input
                className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60"
                value={meta.tags}
                onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
                placeholder="button, animation"
              />
            </label>
          </div>

          {/* Media — one dropzone, because a cover and a demo video are the
              same gesture; the file's own type decides which it is. */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Media</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The cover is what the marketplace card shows. Skip it and the frame
                captured at publish time is used instead.
              </p>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                acceptFiles(event.dataTransfer.files);
              }}
              className={`rounded-xl border border-dashed p-4 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] ${
                dragging
                  ? "border-primary/60 bg-accent/50"
                  : "border-border/70 bg-muted/20"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent">
                  {uploading === "image" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  {meta.thumbnailUrl ? "Replace cover" : "Upload cover"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => acceptFiles(e.target.files)}
                  />
                </label>

                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent">
                  {uploading === "video" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Video className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  {meta.videoUrl ? "Replace video" : "Upload demo video"}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => acceptFiles(e.target.files)}
                  />
                </label>

                <span className="text-[11px] text-muted-foreground/70">
                  or drop a file here
                </span>
              </div>

              {(meta.thumbnailUrl || meta.videoUrl) && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {meta.thumbnailUrl && (
                    <figure className="group relative overflow-hidden rounded-lg border border-border/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={meta.thumbnailUrl}
                        alt="Cover preview"
                        className="h-28 w-44 object-cover"
                      />
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-medium text-white">
                        Cover
                      </figcaption>
                      <button
                        onClick={() =>
                          setMeta((prev) => ({ ...prev, thumbnailUrl: "" }))
                        }
                        className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                        title="Remove cover"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </figure>
                  )}

                  {meta.videoUrl && (
                    <figure className="group relative overflow-hidden rounded-lg border border-border/60">
                      <video
                        src={meta.videoUrl}
                        muted
                        loop
                        playsInline
                        className="h-28 w-44 object-cover"
                      />
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] font-medium text-white">
                        Demo video
                      </figcaption>
                      <button
                        onClick={() => setMeta((prev) => ({ ...prev, videoUrl: "" }))}
                        className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                        title="Remove video"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </figure>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* The component itself, built by the same engine the marketplace
              uses — the author decides with the real thing in front of them. */}
          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="flex h-9 items-center gap-2 border-b border-border/60 bg-muted/40 px-3">
              <span className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Final preview
              </span>
              <span
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70"
                title="Bundled in the browser by the same engine the marketplace serves"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px] shadow-emerald-500/20" />
                live
              </span>
              <button
                onClick={() =>
                  setPreviewTheme((value) => (value === "light" ? "dark" : "light"))
                }
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={`Switch to ${previewTheme === "light" ? "dark" : "light"} theme`}
              >
                {previewTheme === "light" ? (
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Moon className="h-3.5 w-3.5 text-sky-400" />
                )}
              </button>
            </div>
            <div className="h-[300px] bg-background">
              {compiledCss === undefined ? (
                <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Compiling styles…
                </div>
              ) : (
                <SandpackPreviewPane
                  className="h-full w-full"
                  files={files}
                  vendoredFiles={vendoredFiles}
                  compiledCss={compiledCss}
                  dependencies={dependencies}
                  theme={previewTheme}
                  page={previewPage}
                />
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              What gets published
            </div>
            <div className="space-y-3.5 p-4 text-xs">
              <div>
                <p className="text-muted-foreground">Registry item</p>
                <code className="mt-1 block rounded-md bg-muted px-2 py-1.5 font-mono break-all">
                  /r/{registrySlug}
                </code>
              </div>
              <div>
                <p className="text-muted-foreground">Component file</p>
                <p className="mt-1 flex items-center gap-1.5 font-mono break-all">
                  <FileCode2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {payload.componentPath.replace(/^\//, "")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Dependencies</p>
                <p className="mt-1 font-mono">
                  {dependencies.length ? dependencies.join(", ") : "None detected"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Files</p>
                <p className="mt-1">
                  component + {payload.demoCode ? "demo" : "auto demo"}
                  {payload.files.length
                    ? ` + ${payload.files.length} helper${payload.files.length === 1 ? "" : "s"}`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Submitting sends this component to the review queue. An admin approves
            it and decides whether it appears publicly or as an unlisted link —
            you&apos;ll find it under &quot;In review&quot; in your studio.
          </p>

          <Button
            className="w-full rounded-lg"
            size="lg"
            disabled={publishing || !meta.title.trim()}
            onClick={publish}
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {isUpdate ? "Submit update for review" : "Submit for review"}
          </Button>
        </aside>
      </div>

      {/* The submission dialog — every row is a phase that really ran, and the
          error is the compiler's own message. Nothing here is a fake timer. */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[440px]"
          onInteractOutside={(event) => publishing && event.preventDefault()}
          onEscapeKeyDown={(event) => publishing && event.preventDefault()}
        >
          <DialogTitle>
            {phase === "failed"
              ? "Submission failed"
              : phase === "done"
                ? "Submitted for review"
                : "Building your project"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {phase === "failed"
              ? "The component could not be submitted."
              : "Your component is being built and submitted for review."}
          </DialogDescription>

          <div className="space-y-4 py-1">
            <ol className="space-y-3.5">
              {STEPS.map((step, index) => {
                const state = stepState(index);
                return (
                  <li key={step.label} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        state === "done"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                          : state === "active"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : state === "failed"
                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                              : "border-border/60 text-muted-foreground/40"
                      }`}
                    >
                      {state === "done" ? (
                        <CircleCheck className="h-3 w-3" />
                      ) : state === "active" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : state === "failed" ? (
                        <TriangleAlert className="h-3 w-3" />
                      ) : (
                        <Circle className="h-2.5 w-2.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-[13px] font-medium ${
                          state === "pending" ? "text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        {step.hint}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {phase === "done" && buildWarning && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-5 text-foreground">
                {buildWarning}
              </p>
            )}

            {phase === "failed" && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium">
                  The build stopped so nothing broken enters the queue:
                </p>
                <p className="max-h-40 overflow-auto rounded-md bg-muted/70 px-2.5 py-2 font-mono text-[11px] leading-5 text-foreground">
                  {buildError}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      closeDialog();
                      onBack?.();
                    }}
                  >
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    Back to editor
                  </Button>
                  <Button size="sm" onClick={() => void publish()}>
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
