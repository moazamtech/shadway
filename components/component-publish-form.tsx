"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ComponentPreview } from "@/components/component-preview";

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
      const response = await fetch("/api/components/upload-media", { method: "POST", body: formData });
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
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <input
              className="h-10 w-full rounded-lg border bg-background px-3"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Category</span>
            <select
              className="h-10 w-full rounded-lg border bg-background px-3"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="ui">UI</option>
              <option value="marketing">Marketing</option>
              <option value="animation">Animation</option>
              <option value="form">Form</option>
              <option value="data">Data</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            className="min-h-20 w-full rounded-lg border bg-background p-3"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Tags (comma separated)</span>
          <input
            className="h-10 w-full rounded-lg border bg-background px-3"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">npm dependencies (comma separated)</span>
          <input
            className="h-10 w-full rounded-lg border bg-background px-3"
            value={dependencies}
            onChange={(event) => setDependencies(event.target.value)}
            placeholder="framer-motion, lucide-react"
          />
        </label>

        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Marketplace media</p>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Thumbnail image</span>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadMedia(file, "image");
              }}
            />
          </label>
          {thumbnailUrl && (
            <img src={thumbnailUrl} alt="Thumbnail preview" className="h-32 w-full rounded-lg object-cover" />
          )}

          <label className="space-y-1 text-sm">
            <span className="font-medium">Preview video (optional)</span>
            <input
              type="file"
              accept="video/*"
              className="block w-full text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadMedia(file, "video");
              }}
            />
          </label>
          {videoUrl && (
            <video src={videoUrl} className="h-32 w-full rounded-lg object-cover" controls />
          )}
          {uploadingMedia && <p className="text-xs text-muted-foreground">Uploading media...</p>}
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Component code (TSX)</span>
          <textarea
            className="min-h-80 w-full rounded-lg border bg-background p-3 font-mono text-xs"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visibility === "unlisted"}
              onChange={(event) => setVisibility(event.target.checked ? "unlisted" : "public")}
            />
            Unlisted
          </label>
          <Button disabled={submitting} type="submit">
            {submitting ? "Publishing..." : "Publish component"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border p-3">
          <h2 className="mb-3 text-sm font-semibold">Live preview</h2>
          {code.trim() ? (
            <ComponentPreview
              code={code}
              title={title || "New component"}
              height={240}
            />
          ) : (
            <div className="flex h-44 items-center justify-center rounded-lg border text-sm text-muted-foreground">
              Paste code to preview
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
