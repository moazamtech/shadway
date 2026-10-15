"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  Loader2,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PublishMeta = {
  title: string;
  description: string;
  tags: string;
  category: string;
  visibility: "public" | "unlisted";
  thumbnailUrl: string;
  videoUrl: string;
};

/**
 * Step 2 of publishing: describe the component, attach media, then publish.
 * Kept as its own route so the studio stays a pure editor.
 */
export function PublishPanel({
  code,
  demoCode,
  extraFiles,
  dependencies,
  onBack,
}: {
  code: string;
  demoCode: string;
  extraFiles: { path: string; content: string; type: string }[];
  dependencies: string[];
  onBack?: () => void;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<PublishMeta>({
    title: "",
    description: "",
    tags: "",
    category: "ui",
    visibility: "public",
    thumbnailUrl: "",
    videoUrl: "",
  });
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => code.slice(0, 1400), [code]);

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

  async function publish() {
    setPublishing(true);
    setError(null);
    try {
      if (!code.trim()) throw new Error("Write your component before publishing.");
      if (!meta.title.trim()) throw new Error("Give your component a title.");

      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          description: meta.description,
          tags: meta.tags.split(",").map((t) => t.trim()).filter(Boolean),
          dependencies,
          category: meta.category,
          visibility: meta.visibility,
          thumbnailUrl: meta.thumbnailUrl,
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
      router.push(`/c/${data.item.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish component");
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
          <Badge variant="secondary">Publish</Badge>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onBack}>
            Back to editor
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Describe your component</h1>
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

          <label className="block space-y-1 text-sm font-medium">
            Visibility
            <select
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={meta.visibility}
              onChange={(e) =>
                setMeta({ ...meta, visibility: e.target.value as "public" | "unlisted" })
              }
            >
              <option value="public">Public — listed in the marketplace</option>
              <option value="unlisted">Unlisted — installable by link only</option>
            </select>
          </label>

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
                  /r/{meta.title ? meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "your-slug" : "your-slug"}
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
            Publish component
          </Button>
        </aside>
      </div>
    </main>
  );
}

export function FileIcon({ path }: { path: string }) {
  if (path.endsWith(".css")) return FileText;
  if (path.endsWith(".json")) return FileJson;
  return FileCode2;
}

export { Folder, ChevronRight, ChevronDown };