"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  CircleCheck,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  Loader2,
  Rocket,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type PublishMeta = {
  title: string;
  description: string;
  tags: string;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
};

/**
 * Step 2 of publishing: describe the component, attach media, then publish.
 * Kept as its own route so the studio stays a pure editor.
 *
 * When a `slug` is present the component is updated in place — the record
 * keeps its slug, files and history instead of creating a second item.
 */
export function PublishPanel({
  slug,
  code,
  demoCode,
  extraFiles,
  dependencies,
  initialMeta,
  status = "draft",
  onBack,
}: {
  slug?: string;
  code: string;
  demoCode: string;
  extraFiles: { path: string; content: string; type: string }[];
  dependencies: string[];
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

  // The submission dialog: it reports the real pipeline phases, and a real
  // failure message lets the author go fix the code instead of guessing.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<
    "building" | "submitting" | "done" | "failed"
  >("building");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildWarning, setBuildWarning] = useState<string | null>(null);

  const preview = useMemo(() => code.slice(0, 1400), [code]);
  const isUpdate = status === "published";
  const registrySlug =
    slug ||
    meta.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    "your-slug";

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

  /**
   * The submission pipeline, mirroring how 21st.dev builds a block before it
   * can enter review: bundle -> verify -> submit. Each message the dialog
   * shows names what the pipeline is actually doing at that moment; a build
   * failure is the real compiler error, not a generic toast.
   */
  async function publish() {
    setPublishing(true);
    setBuildError(null);
    setBuildWarning(null);
    setError(null);
    setDialogOpen(true);
    setPhase("building");
    setPhaseMessage("Bundling component...");

    try {
      if (!code.trim()) throw new Error("Write your component before publishing.");
      if (!meta.title.trim()) throw new Error("Give your component a title.");

      // Build + screenshot: the component is compiled with the same bundler
      // customers will run, then rendered once in a headless browser so the
      // queue (and the marketplace card) shows a real capture.
      const buildResponse = await fetch("/api/studio/build-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          code,
          demoCode,
          files: extraFiles,
        }),
      });
      const buildData = await buildResponse.json();
      if (!buildResponse.ok) {
        throw new Error(buildData.error || "The component failed to build.");
      }
      if (buildData.warning) setBuildWarning(buildData.warning);

      setPhase("submitting");
      setPhaseMessage(
        meta.thumbnailUrl ? "Submitting for review..." : "Attaching preview and submitting..."
      );

      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: meta.title,
          description: meta.description,
          tags: meta.tags.split(",").map((t) => t.trim()).filter(Boolean),
          dependencies,
          category: meta.category,
          // A cover the author uploaded wins; otherwise the captured shot.
          thumbnailUrl: meta.thumbnailUrl || buildData.thumbnailUrl || "",
          videoUrl: meta.videoUrl,
          code,
          demoCode,
          files: extraFiles,
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
      setPhaseMessage("Done!");
      setTimeout(() => {
        if (data.item?.status === "published") {
          router.push(`/c/${data.item.slug}`);
        } else {
          router.push("/studio?submitted=1");
        }
      }, 700);
      return; // dialog self-closes on redirect; don't clobber the "done" state
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submission failed. Please try again.";
      setBuildError(message);
      setPhase("failed");
      setPhaseMessage("Submission failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Shadway
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <Badge variant="secondary">{isUpdate ? "Update" : "Submit"}</Badge>
          <Button variant="ghost" size="sm" className="ml-auto" asChild>
            <Link href="/studio">All components</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onBack}>
            Back to editor
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isUpdate ? "Update your component" : "Describe your component"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This becomes the card on the marketplace and the description agents read.
            </p>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Title
            <input
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Animated gradient button"
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            Description
            <textarea
              className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              placeholder="A button with an animated gradient border and loading state."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              Category
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
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

            <label className="block space-y-1 text-sm font-medium">
              Tags
              <input
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={meta.tags}
                onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
                placeholder="button, animation"
              />
            </label>
          </div>

          <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Submitting sends this component to the review queue. An admin approves
            it and decides whether it appears publicly or as an unlisted link —
            you'll find it under "In review" in your studio.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Media</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm">
                {uploading === "image" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {meta.thumbnailUrl ? "Cover ready" : "Upload cover"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadMedia(file, "image");
                  }}
                />
              </label>

              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm">
                {uploading === "video" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {meta.videoUrl ? "Video ready" : "Upload demo video"}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadMedia(file, "video");
                  }}
                />
              </label>
            </div>
            {meta.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.thumbnailUrl}
                alt="cover preview"
                className="h-32 w-52 rounded-lg object-cover"
              />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border">
            <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What gets published
            </div>
            <div className="space-y-3 p-4 text-xs">
              <div>
                <p className="text-muted-foreground">Registry item</p>
                <code className="mt-1 block break-all rounded bg-muted p-2">
                  /r/{registrySlug}
                </code>
              </div>
              <div>
                <p className="text-muted-foreground">Dependencies</p>
                <p className="mt-1">
                  {dependencies.length ? dependencies.join(", ") : "None detected"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Files</p>
                <p className="mt-1">
                  component + {demoCode ? "demo" : "auto demo"}
                  {extraFiles.length ? ` + ${extraFiles.length} helper` : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Source preview</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] leading-4">
                  {preview}
                </pre>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
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

      {/* The submission dialog — every label reflects a phase that really ran;
          nothing here is a fake timer. */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !publishing) { setDialogOpen(false); setPhase("building"); setPhaseMessage(""); } }}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[420px]"
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

          <div className="flex flex-col items-center gap-4 py-3 text-center">
            {phase === "building" || phase === "submitting" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{phaseMessage}</p>
                {phase === "building" && (
                  <p className="text-xs text-muted-foreground/70">
                    Compiling your project and capturing a preview — this takes a
                    moment.
                  </p>
                )}
              </>
            ) : phase === "done" ? (
              <>
                <CircleCheck className="h-8 w-8 text-emerald-500" />
                <p className="text-sm text-muted-foreground">{phaseMessage}</p>
                {buildWarning && (
                  <p className="max-w-[340px] rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-5 text-foreground">
                    {buildWarning}
                  </p>
                )}
              </>
            ) : (
              <>
                <TriangleAlert className="h-8 w-8 text-amber-500" />
                <p className="text-sm font-medium">
                  The build stopped so nothing broken enters the queue:
                </p>
                <p className="max-w-[340px] rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs leading-5 text-foreground">
                  {buildError}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDialogOpen(false);
                      setPhase("building");
                      setPhaseMessage("");
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export function FileIcon({ path }: { path: string }) {
  if (path.endsWith(".css")) return FileText;
  if (path.endsWith(".json")) return FileJson;
  return FileCode2;
}

export { Folder, ChevronRight, ChevronDown };