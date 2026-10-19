"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Github, Globe, ImageUp, Loader2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AVATAR_ACCEPT,
  avatarMessage,
  avatarProblem,
  type AvatarProblem,
} from "@/lib/profile-avatar";
import {
  MAX_BIO_LENGTH,
  normalizeBio,
  normalizeGithub,
  normalizeTwitter,
  normalizeWebsite,
  type ProfileFieldResult,
} from "@/lib/profile-links";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export type ProfileFormProps = {
  name: string;
  handle: string;
  avatar: string;
  bio: string;
  website: string;
  twitter: string;
  github: string;
  /**
   * Whether this deployment has an image bucket. Passed from the server page
   * so the picker can be greyed out with an explanation instead of letting the
   * author pick a photo and then fail.
   */
  uploadsEnabled: boolean;
};

/** Matches the fallback on the public profile, so the two never disagree. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ProfileForm({
  name,
  handle,
  avatar,
  bio,
  website,
  twitter,
  github,
  uploadsEnabled,
}: ProfileFormProps) {
  const { update } = useSession();
  const router = useRouter();
  const [bioDraft, setBioDraft] = useState(bio);
  const [websiteDraft, setWebsiteDraft] = useState(website);
  const [twitterDraft, setTwitterDraft] = useState(twitter);
  const [githubDraft, setGithubDraft] = useState(github);

  /**
   * Two copies of the picture, because one of them has to be a lie for a
   * moment. `savedAvatar` is what the account actually holds; `draftAvatar` is
   * what the form is showing. Choosing a file puts a local object URL into the
   * draft immediately — a profile picture is the one field on this page people
   * expect to change *now*, and a spinner with no visible result reads as a
   * broken button. The gap between the two is what the Revert button closes.
   */
  const [savedAvatar, setSavedAvatar] = useState(avatar);
  const [draftAvatar, setDraftAvatar] = useState(avatar);
  /** "Remove photo" is a draft like any other: it lands when Save is pressed. */
  const [photoCleared, setPhotoCleared] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState<{
    kind: "error";
    message: string;
  } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const savedAvatarRef = useRef(avatar);
  const objectUrlRef = useRef<string | null>(null);

  // Kept in step with the saved value in an effect rather than during render:
  // the ref is only ever read from an event handler, and writing it while
  // rendering is what the React compiler rules are about.
  useEffect(() => {
    savedAvatarRef.current = savedAvatar;
  }, [savedAvatar]);

  /**
   * Object URLs are not garbage collected — a browser holds the blob alive
   * until the document goes away, and this form is re-entered every time the
   * author changes their picture. Revoking on replace and on unmount is what
   * stops a settings session from pinning twenty megabytes of phone photos.
   */
  function releaseObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  useEffect(() => releaseObjectUrl, []);

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed.");
      }

      // The endpoint already wrote the account, so this stops being a draft and
      // becomes what is stored. Cloudinary returns a fresh versioned URL for a
      // replaced asset, so there is no cache-buster to append here.
      setSavedAvatar(data.url);
      setDraftAvatar(data.url);
      setPhotoCleared(false);
      setAvatarNotice(null);
      setStatus({ kind: "success", message: "Profile photo updated." });
      /**
       * The nav, the sidebar and this page all read the photo from the session,
       * and the session was minted before this file existed. Asking for a
       * refresh re-runs the `jwt` callback, which re-reads the account — so the
       * new picture appears everywhere without a sign-out.
       */
      void update();
      router.refresh();
    } catch (error) {
      /**
       * Put back what is actually stored. Leaving the failed local preview up
       * would be the worst outcome: the author walks away believing they have a
       * new picture that nothing anywhere has heard of.
       */
      setDraftAvatar(savedAvatarRef.current);
      setAvatarNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
      releaseObjectUrl();
    }
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately, or picking the same file twice in a row fires no
    // change event and the button looks stuck.
    event.target.value = "";
    if (!file) return;

    /**
     * In the browser, before the request. A five megabyte phone photo is the
     * common case here, not the exotic one, and uploading it to be refused at
     * the far end costs the author a spinner and nothing else.
     */
    const problem: AvatarProblem | null = avatarProblem(file);
    if (problem) {
      setAvatarNotice({ kind: "error", message: avatarMessage(problem) });
      return;
    }

    releaseObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setDraftAvatar(objectUrl);
    setAvatarNotice(null);
    void uploadAvatar(file);
  }

  const preview = draftAvatar || "";
  const canRevert = !uploading && (photoCleared || draftAvatar !== savedAvatar);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "idle" });

    /**
     * Same functions the server runs, on the same values, before anything is
     * sent. This is not belt-and-braces: it is the only thing that lets the
     * live preview under each field be a promise rather than a guess.
     *
     * Normalised once, into `values`, rather than once to validate and again to
     * build the body. Calling `normalizeBio(bioDraft)` twice is not merely
     * wasteful — it means the value on screen was validated and the value sent
     * was validated separately, and any normaliser that is not a pure function
     * makes those two different. `ProfileFieldResult` is a discriminated union,
     * so the narrowing has to happen at the call site: `.find(r => !r.ok)` gives
     * back a union, and reading `.message` off it does not compile — which is
     * the type system saying, correctly, that a result may be a success.
     */
    const problems: string[] = [];
    const take = (label: string, result: ProfileFieldResult): string => {
      if (result.ok) return result.value;
      problems.push(`${label}: ${result.message}`);
      return "";
    };

    const values = {
      bio: take("Bio", normalizeBio(bioDraft)),
      website: take("Website", normalizeWebsite(websiteDraft)),
      twitter: take("X", normalizeTwitter(twitterDraft)),
      github: take("GitHub", normalizeGithub(githubDraft)),
    };

    /**
     * Every problem at once, not the first one. The author has spent a minute
     * on four fields; telling them about one bad URL, letting them fix it, and
     * then revealing the second is a queue they did not ask to stand in.
     */
    if (problems.length > 0) {
      setStatus({ kind: "error", message: problems.join(" · ") });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { ...values };
      // Only ever the empty string: a new picture is uploaded, not written.
      if (photoCleared && savedAvatar) body.avatar = "";

      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data?.error || "Failed to update profile.",
        });
        return;
      }

      // Adopt exactly what the server stored, so the fields show the canonical
      // forms from here on rather than whatever shape they were typed in.
      if (data?.item) {
        setBioDraft(data.item.bio ?? "");
        setWebsiteDraft(data.item.website ?? "");
        setTwitterDraft(data.item.twitter ?? "");
        setGithubDraft(data.item.github ?? "");
        if (typeof data.item.avatar === "string") {
          setSavedAvatar(data.item.avatar);
          setDraftAvatar(data.item.avatar);
        }
      }
      setPhotoCleared(false);
      setStatus({ kind: "success", message: "Profile updated." });
      // Removing the photo is saved by this request, not by the upload route,
      // so the session has to be told here too.
      void update();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Public profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Visible to anyone who opens{" "}
          {handle ? (
            <Link
              href={`/u/${handle}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              @{handle}
            </Link>
          ) : (
            "your public profile"
          )}
          .
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {status.kind === "success" ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">
            {status.message}
          </div>
        ) : null}
        {status.kind === "error" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {status.message}
          </div>
        ) : null}

        {/* Picture */}
        <div className="space-y-2">
          <Label>Profile photo</Label>
          <div className="flex items-center gap-4">
            <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-well ring-1 ring-border">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">
                  {initials(name || handle)}
                </span>
              )}
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </span>
              ) : null}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={AVATAR_ACCEPT}
                onChange={onPickFile}
                className="sr-only"
                disabled={!uploadsEnabled || uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!uploadsEnabled || uploading}
                onClick={() => fileInput.current?.click()}
              >
                <ImageUp />
                {savedAvatar ? "Replace photo" : "Upload photo"}
              </Button>

              {savedAvatar && !photoCleared ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => {
                    setDraftAvatar("");
                    setPhotoCleared(true);
                    setAvatarNotice(null);
                  }}
                >
                  <Trash2 />
                  Remove
                </Button>
              ) : null}

              {canRevert ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftAvatar(savedAvatarRef.current);
                    setPhotoCleared(false);
                    setAvatarNotice(null);
                  }}
                >
                  <Undo2 />
                  Revert
                </Button>
              ) : null}
            </div>
          </div>

          {avatarNotice ? (
            <p className="text-xs text-destructive">{avatarNotice.message}</p>
          ) : null}
          {!uploadsEnabled ? (
            <p className="text-xs text-muted-foreground">
              Image uploads are not configured on this deployment. Everything
              else on this card still saves.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Photos save as soon as they upload — nothing else waits for the
              button.
            </p>
          )}
          {photoCleared ? (
            <p className="text-xs text-muted-foreground">
              Your profile will fall back to initials once you save.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-bio">Bio</Label>
          <Textarea
            id="profile-bio"
            value={bioDraft}
            onChange={(e) => setBioDraft(e.target.value)}
            maxLength={MAX_BIO_LENGTH}
            rows={3}
            placeholder="One or two lines about what you build."
          />
          <p className="text-xs text-muted-foreground">
            {bioDraft.length} / {MAX_BIO_LENGTH}
          </p>
        </div>

        <LinkField
          id="profile-website"
          label="Website"
          icon={<Globe />}
          placeholder="example.com"
          hint="A bare host is stored as https://example.com."
          value={websiteDraft}
          onChange={setWebsiteDraft}
          result={normalizeWebsite(websiteDraft)}
        />

        <LinkField
          id="profile-twitter"
          label="X (Twitter)"
          icon={<span className="text-xs font-semibold">@</span>}
          placeholder="@ada or ada"
          hint="Stored as https://x.com/ada."
          value={twitterDraft}
          onChange={setTwitterDraft}
          result={normalizeTwitter(twitterDraft)}
        />

        <LinkField
          id="profile-github"
          label="GitHub"
          icon={<Github />}
          placeholder="@ada or github.com/ada"
          hint="Stored as https://github.com/ada."
          value={githubDraft}
          onChange={setGithubDraft}
          result={normalizeGithub(githubDraft)}
        />

        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}

/**
 * A link field that shows what it is about to store.
 *
 * The live line is the point of the component: these three values are rendered
 * as `href` on a page anybody can read, so the author is owed the canonical
 * form before they press Save rather than a surprise afterwards. When the field
 * does not hold, it shows the exact sentence the server will refuse with —
 * both come from `lib/profile-links`.
 */
function LinkField({
  id,
  label,
  icon,
  placeholder,
  hint,
  value,
  onChange,
  result,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  result: ProfileFieldResult;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="url"
        spellCheck={false}
        aria-invalid={!result.ok || undefined}
      />
      {result.ok ? (
        <p className="truncate text-xs text-muted-foreground">
          {result.value ? (
            <>
              Saves as{" "}
              <span className="font-mono text-foreground">{result.value}</span>
            </>
          ) : (
            hint
          )}
        </p>
      ) : (
        <p className="text-xs text-destructive">{result.message}</p>
      )}
    </div>
  );
}