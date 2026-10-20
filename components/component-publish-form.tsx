"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComponentPreview } from "@/components/component-preview";
import { cn } from "@/lib/utils";

/**
 * Publishing a component without the studio.
 *
 * The studio is the tool; this is the shortcut — paste the source, give it a
 * name, and it is in the registry. The fields are the app's fields, so a
 * person who has used the settings page has used this one.
 *
 * The cover and the demo loop are the two pictures a listing is judged on,
 * so they are asked for here rather than left to be captured later: the cover
 * is what the card shows, and the loop is what the card plays on hover.
 */
export function ComponentPublishForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [category, setCategory] = useState("ui");
  const [visibility, setVisibility] = useState<"public" | "unlisted">("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadMedia(file: File, kind: "image" | "video") {
    setUploadingMedia(true);
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
      if (kind === "image") setThumbnailUrl(data.url);
      else setVideoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media upload failed");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          code,
          description,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          dependencies: dependencies.split(",").map((dep) => dep.trim()).filter(Boolean),
          thumbnailUrl,
          videoUrl,
          category,
          visibility,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to publish component");
      }

      router.push(`/c/${data.item.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish component");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="publish-title">Title</Label>
            <Input
              id="publish-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Animated gradient button"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="publish-category">Category</Label>
            <div className="flex h-8 items-center gap-1.5 rounded-lg px-1 ring-1 ring-border">
              {["ui", "marketing", "animation", "form", "data"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  aria-pressed={category === option}
                  className={cn(
                    "h-6 rounded-md px-2 text-xs font-medium capitalize transition-colors",
                    category === option
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="publish-description">Description</Label>
          <Textarea
            id="publish-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What it is, and what it is for."
            className="min-h-20"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="publish-tags">Tags</Label>
            <Input
              id="publish-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="button, gradient, animation"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="publish-dependencies">npm dependencies</Label>
            <Input
              id="publish-dependencies"
              value={dependencies}
              onChange={(event) => setDependencies(event.target.value)}
              placeholder="framer-motion, lucide-react"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <p className="text-sm font-medium">Marketplace media</p>
          <p className="-mt-2 text-xs text-muted-foreground">
            The cover is what the card shows. The loop is what the card plays
            when the pointer arrives.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="group flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-border/70 p-3 transition-colors hover:border-foreground/25 hover:bg-muted/40">
              <span className="flex items-center gap-2 text-xs font-medium">
                <ImageUp className="h-3.5 w-3.5" aria-hidden="true" />
                Cover image
              </span>
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl}
                  alt="The cover you uploaded"
                  className="h-24 w-full rounded-md object-cover"
                />
              ) : (
                <span className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  PNG, JPEG or WebP
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadMedia(file, "image");
                }}
              />
            </label>

            <label className="group flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-border/70 p-3 transition-colors hover:border-foreground/25 hover:bg-muted/40">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Demo loop
              </span>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  className="h-24 w-full rounded-md object-cover"
                  muted
                  loop
                  playsInline
                />
              ) : (
                <span className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  MP4 or WebM, up to 10 MB
                </span>
              )}
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadMedia(file, "video");
                }}
              />
            </label>
          </div>

          {uploadingMedia ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Uploading…
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="publish-code">Component source (TSX)</Label>
          <Textarea
            id="publish-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            className="min-h-72 font-mono text-xs leading-relaxed"
            required
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visibility === "unlisted"}
              onChange={(event) =>
                setVisibility(event.target.checked ? "unlisted" : "public")
              }
              className="size-3.5 rounded border-border accent-[var(--primary)]"
            />
            Unlisted — published, but not in the feed
          </label>
          <Button disabled={submitting} type="submit">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Publishing…
              </>
            ) : (
              "Publish component"
            )}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 lg:sticky lg:top-6">
        <div className="rounded-xl border border-border/60 p-3">
          <h2 className="mb-3 text-sm font-medium">Live preview</h2>
          {code.trim() ? (
            <ComponentPreview
              code={code}
              title={title || "New component"}
              height={240}
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Paste the source to see it
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          This is the quick way in. The{" "}
          <Link
            href="/studio"
            className="underline underline-offset-4 hover:no-underline"
          >
            studio
          </Link>{" "}
          builds the component, catches the errors and captures the cover for
          you.
        </p>
      </div>
    </form>
  );
}
