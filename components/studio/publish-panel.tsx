"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { slugify, slugMessage, slugProblem } from "@/lib/component-slug";
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PreviewFiles } from "@/lib/preview/files";
import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import { CATEGORY_GROUPS, findGroup, findTag, normalizeGroup, tagsInGroup } from "@/lib/categories";
import { projectPayload, resolveComponentPath } from "@/lib/studio/project";
import { DEFAULT_DEMO_PATH } from "@/lib/studio/starter";
import { coverImageUrl } from "@/lib/images";

/**
 * The sandbox is the same engine the studio previews with, so what the author
 * approves here is literally the build the marketplace will serve. It is part
 * of the studio's bundle rather than a chunk fetched later, because a chunk
 * that appears changes the list of runtime chunks — which the browser is told
 * about by reloading the page, and a reload here tears the sandbox down.
 */
import { SandpackPreviewPane } from "@/components/studio/sandpack-preview";

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
    thumbnailUrl: "",
    videoUrl: "",
    ...initialMeta,
    // Normalized on the way in, after the spread, because a draft saved before
    // the taxonomy existed can arrive carrying "block" or "animation" or
    // "hero". The select below only ever offers the canonical groups, so a
    // legacy value would render the control with nothing selected and then
    // post the stale string back — the author sees one category and the
    // registry ships another.
    category: normalizeGroup(initialMeta?.category ?? "ui"),
  });
  /**
   * The kind of thing this is.
   *
   * The category says which shelf it goes on — the components or the marketing
   * blocks — and the sub-category says what kind of thing it is: a button, a
   * hero, a contact. A registry of "UI components" with nothing in it that
   * says what it is cannot be browsed by anyone who is not its author, so the
   * sub-category is not a nicety: it is what the shelf is made of, and
   * publishing asks for it.
   */
  const [subCategory, setSubCategory] = useState<string>(
    initialMeta?.tags
      ?.split(",")
      .map((tag) => tag.trim().toLowerCase())
      .find((tag) => tagsInGroup(normalizeGroup(initialMeta?.category ?? "ui")).some((known) => known.slug === tag)) ?? "",
  );
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

  /** The group the author picked, so the form can explain what it means. */
  const selectedGroup = findGroup(meta.category);

  /**
   * The tags field is a comma-separated string because that is what it has
   * always been — the free-text input, the `publish()` payload split and the
   * draft that reloads this page all speak that format. The picker below
   * therefore never owns a separate array; it reads this string and writes
   * this string back, so the two controls cannot drift into disagreeing about
   * what is tagged.
   */
  const tagList = useMemo(
    () =>
      meta.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [meta.tags]
  );

  /** Compared case-insensitively: a hand-typed `Button` is still a button. */
  const selectedTags = useMemo(
    () => new Set(tagList.map((tag) => tag.toLowerCase())),
    [tagList]
  );

  /**
   * The canonical tags for the chosen group. This is the whole point of the
   * taxonomy from an author's side: the group is an exclusive choice between
   * two things, so the many-valued field is where the specificity lives, and
   * the slugs are fixed (`pricing-section`) rather than whatever the author
   * typed (`Pricing section`), which is why a tag could not be linked to
   * before.
   */
  const groupTags = useMemo(() => tagsInGroup(meta.category), [meta.category]);

  /**
   * The kinds offered as extras: everything on the shelf except the one the
   * component is filed under.
   *
   * The sub-category is the file it goes in, and offering it again as a chip
   * would let the author say two things at once — filed under a button, and
   * filed under a hero — which the shelf cannot show.
   */
  const extraTags = useMemo(
    () => groupTags.filter((tag) => tag.slug !== subCategory),
    [groupTags, subCategory]
  );

  /**
   * The tags the record is stored with.
   *
   * The sub-category leads, because it is the file the component goes in, and
   * the rest follow as the words a reader would also look for. Both live in
   * the same list because the shelf, the link and the search all read the
   * tags: a component filed under a hero is found by the hero, and by
   * "announcement" as well.
   */
  const publishTags = useMemo(() => {
    const chosen = subCategory.trim().toLowerCase();
    const extras = tagList.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    return [...new Set([chosen, ...extras].filter(Boolean))];
  }, [subCategory, tagList]);

  /** Append or remove one slug, leaving the field's own format intact. */
  function toggleTag(slug: string) {
    setMeta((prev) => {
      const current = prev.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const key = slug.toLowerCase();
      const next = current.some((tag) => tag.toLowerCase() === key)
        ? current.filter((tag) => tag.toLowerCase() !== key)
        : [...current, slug];
      return { ...prev, tags: next.join(", ") };
    });
  }

  /**
   * File the component under a kind, and let go of the one it was under.
   *
   * A draft that was filed under a button and is now filed under a hero must
   * not still be tagged as a button, or the shelf offers it under both and the
   * fine way in stops being fine.
   */
  function chooseSubCategory(slug: string) {
    setSubCategory(slug);
    setMeta((prev) => {
      const current = prev.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const next = current.filter((tag) => {
        const known = findTag(tag);
        return !known || known.slug !== subCategory;
      });
      return { ...prev, tags: next.join(", ") };
    });
  }

  /**
   * The URL this component will live at, as an editable field.
   *
   * It used to be derived text: the draft's slug, or a title slugified inline
   * by a second copy of the rules that had drifted from the server's. So the
   * address an author ends up with — the one a stranger runs `shadcn add`
   * against — was decided in a route they never see, with no way to change it.
   *
   * The field holds what the author typed; `slugify` only suggests, and the
   * same helpers the server validates with are imported here so the sentence
   * under the input is the sentence the server would have refused with.
   */
  const [slugField, setSlugField] = useState(slug ?? "");
  const slugTouched = slugField !== (slug ?? "");

  const suggestedSlug = useMemo(
    () => slugify(meta.title) || slugify(slugField) || "your-component",
    [meta.title, slugField]
  );

  /** What will actually be published: what they typed, or the suggestion. */
  const registrySlug = (slugTouched ? slugify(slugField) : slug || suggestedSlug) || "your-slug";

  const slugIssue = slugMessage(slugProblem(registrySlug));

  /** A rename, which the server treats as the record's new identity. */
  const isRename = Boolean(slug) && registrySlug !== slug;

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
      if (!subCategory) {
        throw new Error(
          "Say what kind of thing it is — pick a sub-category — before publishing."
        );
      }
      if (slugIssue) throw new Error(slugIssue);

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
          /**
           * Two slugs, and the difference is the whole feature.
           *
           * `slug` is what the author wants the component to be *called* — the
           * field they just typed. `draftSlug` is the record this is an update
           * of, so the server can find the right document and move it rather
           * than looking the new name up, missing, and creating a second
           * component beside the original.
           */
          slug: registrySlug,
          draftSlug: slug,
          title: meta.title,
          description: meta.description,
          tags: publishTags,
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

      <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isUpdate ? "Update your component" : "Describe your component"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This becomes the card on the marketplace and the description agents read.
            </p>
          </div>

          <label className="block space-y-1.5 text-sm font-medium">
            Title
            <Input
              className="h-8"
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="Animated gradient button"
            />
          </label>

          {/* The address, editable. It sits under the title because it is part
              of the component's identity rather than its metadata: it is what a
              stranger types into `shadcn add`, and once a component is out in
              the world it is the URL people have already pasted into their own
              package.json. */}
          <div className="space-y-1.5 text-sm font-medium">
            <label htmlFor="publish-slug">Registry URL</label>
            <div className="flex h-8 items-center rounded-lg bg-transparent px-3 text-sm ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0 select-none text-muted-foreground/70">
                /r/
              </span>
              <input
                id="publish-slug"
                name="publish-slug"
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/50"
                value={slugTouched ? slugField : slug || suggestedSlug}
                placeholder={suggestedSlug}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={slugIssue ? true : undefined}
                aria-describedby="publish-slug-help"
                onChange={(e) => setSlugField(e.target.value)}
              />
              {slugTouched && slugField !== "" && registrySlug !== slugField ? (
                <button
                  type="button"
                  onClick={() => setSlugField("")}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Reset
                </button>
              ) : null}
            </div>
            <p
              id="publish-slug-help"
              className={cn(
                "text-xs font-normal",
                slugIssue ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {slugIssue ?? (
                <>
                  Install it with{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    npx shadcn@latest add {registrySlug}
                  </code>
                  {isRename ? (
                    <>
                      {" "}
                      · This changes the address — anything already pointing at{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                        /r/{slug}
                      </code>{" "}
                      will stop resolving.
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>

          <label className="block space-y-1.5 text-sm font-medium">
            Description
            <Textarea
              className="min-h-24"
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              placeholder="A button with an animated gradient border and loading state."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-medium">
              Category
              <Select
                value={meta.category}
                onValueChange={(value) => {
                  setMeta((prev) => ({ ...prev, category: value }));
                  // The sub-category belongs to a shelf, so changing the shelf
                  // takes it with it: a hero is not a button, and the two
                  // choices cannot be left disagreeing.
                  chooseSubCategory("");
                }}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_GROUPS.map((group) => (
                    <SelectItem key={group.slug} value={group.slug}>
                      {group.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* What the group means, under the control. A native <select>
                  shows one line per option and that line is also the closed
                  control's own label, so the explanation cannot live inside
                  the option without making the closed control unreadable. */}
              {selectedGroup && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {selectedGroup.description}
                </span>
              )}
            </label>

            <label className="block space-y-1.5 text-sm font-medium">
              Sub-category
              <Select
                value={subCategory}
                onValueChange={chooseSubCategory}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="What kind of thing is it?" />
                </SelectTrigger>
                <SelectContent>
                  {groupTags.map((tag) => (
                    <SelectItem key={tag.slug} value={tag.slug}>
                      {tag.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="block text-xs font-normal text-muted-foreground">
                {groupTags.length} kinds of{" "}
                {selectedGroup?.title.toLowerCase() ?? "thing"} — this is what
                the shelf is filed under.
              </span>
            </label>
          </div>

          {/* The other kinds, made clickable. The sub-category above is the
              file this goes in; these are the words a person would also look
              for, and picking one adds it to the record. The kind already
              chosen is not offered again, so the two controls cannot say two
              different things about what this is. */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedGroup?.title ?? "This component"} · {extraTags.length}{" "}
              other kinds. Add the ones that describe it too — pick one to add
              it, pick it again to drop it.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {extraTags.map((tag) => {
                const on = selectedTags.has(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTag(tag.slug)}
                    title={tag.slug}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
                      on
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {on && <CircleCheck className="h-3 w-3 text-primary" aria-hidden="true" />}
                    {tag.title}
                  </button>
                );
              })}
            </div>
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
                <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-transparent px-2.5 text-xs font-medium ring-1 ring-border transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent">
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

                <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-transparent px-2.5 text-xs font-medium ring-1 ring-border transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent">
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
                        src={coverImageUrl(meta.thumbnailUrl, 352)}
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
