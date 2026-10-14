"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  Loader2,
  Monitor,
  Moon,
  Rocket,
  RotateCcw,
  Smartphone,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LocalPreview, type PreviewFileInput } from "@/components/preview/local-preview";
import { buildPreviewFiles, type PreviewFiles } from "@/components/component-sandpack-preview";

type StudioFile = { path: string; label: string; group: string };

const GROUP_LABELS: Record<string, string> = {
  components: "src/components",
  ui: "src/components/ui",
  lib: "src/lib",
  root: "src",
};

const STARTER_FILES: PreviewFiles = {
  "/src/components/component.tsx": `import { Button } from "@/components/ui/button";

export default function MyComponent() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center bg-background p-10">
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Your shadcn component</h2>
        <p className="text-sm text-muted-foreground">
          Edit component.tsx and the preview updates instantly.
        </p>
        <Button>Get started</Button>
      </div>
    </div>
  );
}
`,
  "/src/App.tsx": `import MyComponent from "./components/component";

export default function App() {
  return <MyComponent />;
}
`,
  "/src/index.css": `:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --border: 240 5.9% 90%;
  --radius: 0.5rem;
}
`,
  "/src/lib/utils.ts": `export function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}
`,
  "/src/components/ui/button.tsx": `import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent",
  };
  const sizes = { default: "h-10 px-4", sm: "h-9 px-3", lg: "h-11 px-6" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
`,
};

const FILE_LIST: StudioFile[] = [
  { path: "/src/components/component.tsx", label: "component.tsx", group: "components" },
  { path: "/src/App.tsx", label: "App.tsx", group: "root" },
  { path: "/src/index.css", label: "index.css", group: "root" },
  { path: "/src/lib/utils.ts", label: "utils.ts", group: "lib" },
  { path: "/src/components/ui/button.tsx", label: "button.tsx", group: "ui" },
];

function fileIcon(path: string) {
  if (path.endsWith(".css")) return FileText;
  if (path.endsWith(".json")) return FileJson;
  return FileCode2;
}

export type PublishMeta = {
  title: string;
  description: string;
  tags: string;
  dependencies: string;
  category: string;
  visibility: "public" | "unlisted";
  thumbnailUrl: string;
  videoUrl: string;
};

export function ComponentStudio() {
  const router = useRouter();
  const [files, setFiles] = useState<PreviewFiles>(STARTER_FILES);
  const [activePath, setActivePath] = useState("/src/components/component.tsx");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [debouncedFiles, setDebouncedFiles] = useState<PreviewFiles>(STARTER_FILES);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [meta, setMeta] = useState<PublishMeta>({
    title: "",
    description: "",
    tags: "",
    dependencies: "",
    category: "ui",
    visibility: "public",
    thumbnailUrl: "",
    videoUrl: "",
  });

  // Debounce preview rebuilds so typing stays smooth.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFiles(files), 450);
    return () => window.clearTimeout(id);
  }, [files]);

  const previewFiles: PreviewFileInput[] = useMemo(
    () => buildPreviewFiles(debouncedFiles),
    [debouncedFiles]
  );

  const activeCode = files[activePath] ?? "";
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const updateActive = useCallback(
    (value: string) => {
      setFiles((prev) => ({ ...prev, [activePath]: value }));
    },
    [activePath]
  );

  const grouped = useMemo(() => {
    return FILE_LIST.reduce<Record<string, StudioFile[]>>((acc, file) => {
      (acc[file.group] ||= []).push(file);
      return acc;
    }, {});
  }, []);

  async function uploadMedia(file: File, kind: "image" | "video") {
    setUploading(kind);
    setPublishError(null);
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
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const componentCode = files["/src/components/component.tsx"] || "";
      const demoCode = files["/src/App.tsx"] || "";

      if (!componentCode.trim()) {
        throw new Error("Write your component in component.tsx before publishing.");
      }

      const extraFiles = Object.entries(files)
        .filter(([path]) => path.startsWith("/src/lib/") || path.startsWith("/src/hooks/"))
        .map(([path, content]) => ({
          path: path.replace(/^\/src\//, ""),
          content,
          type: path.includes("/hooks/") ? "registry:hook" : "registry:lib",
        }));

      const response = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          description: meta.description,
          tags: meta.tags.split(",").map((t) => t.trim()).filter(Boolean),
          dependencies: meta.dependencies.split(",").map((d) => d.trim()).filter(Boolean),
          category: meta.category,
          visibility: meta.visibility,
          thumbnailUrl: meta.thumbnailUrl,
          videoUrl: meta.videoUrl,
          code: componentCode,
          demoCode,
          files: extraFiles,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to publish component");
      router.push(`/c/${data.item.slug}`);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Failed to publish component");
    } finally {
      setPublishing(false);
    }
  }

  function onEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      const el = event.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${activeCode.slice(0, start)}  ${activeCode.slice(end)}`;
      updateActive(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void publish();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Shadway
          </Link>
          <Badge variant="secondary">Studio</Badge>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Edit your component, preview it live, then publish to the registry.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewTheme(previewTheme === "light" ? "dark" : "light")}
          >
            {previewTheme === "light" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to publish</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[210px_minmax(0,1fr)_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r bg-muted/30 lg:flex">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Files
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group} className="mb-3">
                <p className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                  <ChevronRight className="h-3 w-3" />
                  <Folder className="h-3 w-3" />
                  {GROUP_LABELS[group] ?? group}
                </p>
                {list.map((file) => {
                  const Icon = fileIcon(file.path);
                  const isActive = file.path === activePath;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setActivePath(file.path)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{file.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col border-r">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="truncate font-mono text-xs text-muted-foreground">{activePath}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiles(STARTER_FILES)}
              title="Reset all files"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <textarea
            ref={editorRef}
            value={activeCode}
            onChange={(event) => updateActive(event.target.value)}
            onKeyDown={onEditorKeyDown}
            spellCheck={false}
            className="min-h-[420px] flex-1 resize-none bg-[#0d0d0d] p-4 font-mono text-[13px] leading-6 text-zinc-200 outline-none"
          />
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Live preview
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant={viewport === "desktop" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewport("desktop")}
                title="Desktop"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={viewport === "mobile" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewport("mobile")}
                title="Mobile"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted/40 p-3">
            <div
              className={`h-full overflow-hidden rounded-xl border bg-background shadow-sm ${
                viewport === "mobile" ? "w-[390px]" : "w-full"
              }`}
            >
              <LocalPreview
                files={previewFiles}
                entry="/src/App.tsx"
                theme={previewTheme}
                height="100%"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="border-t bg-background">
        <div className="grid gap-3 p-4 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-medium">
            Title
            <input
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Animated gradient button"
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            Category
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
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
          <label className="space-y-1 text-xs font-medium">
            Tags
            <input
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={meta.tags}
              onChange={(e) => setMeta({ ...meta, tags: e.target.value })}
              placeholder="button, animation"
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            npm dependencies
            <input
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={meta.dependencies}
              onChange={(e) => setMeta({ ...meta, dependencies: e.target.value })}
              placeholder="framer-motion"
            />
          </label>
        </div>

        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[minmax(0,2fr)_auto]">
          <div className="space-y-3">
            <label className="block space-y-1 text-xs font-medium">
              Description
              <input
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                placeholder="A short description shown on the card and used by agents."
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs">
                {uploading === "image" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Rocket className="h-3.5 w-3.5" />
                )}
                {meta.thumbnailUrl ? "Cover set" : "Cover image"}
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

              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs">
                {uploading === "video" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Rocket className="h-3.5 w-3.5" />
                )}
                {meta.videoUrl ? "Video set" : "Demo video"}
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

              {meta.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meta.thumbnailUrl}
                  alt="cover"
                  className="h-9 w-16 rounded-md object-cover"
                />
              )}
            </div>

            {publishError && (
              <p className="text-xs text-destructive">{publishError}</p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-xs"
              value={meta.visibility}
              onChange={(e) =>
                setMeta({ ...meta, visibility: e.target.value as "public" | "unlisted" })
              }
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
            </select>
            <Button disabled={publishing || !meta.title.trim()} onClick={publish}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}