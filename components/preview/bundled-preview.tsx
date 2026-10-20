"use client";

import { useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { coverImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";
import { PREVIEW_BUILD_VERSION } from "@/lib/preview/version";

type Props = {
  slug: string;
  height?: number | string;
  className?: string;
  theme?: "light" | "dark";
  /**
   * The name of the built document — the hash the publish build was given.
   *
   * With it, the frame is asked for by name and the answer may be kept
   * forever; without it, the frame is asked for by slug and the browser has
   * to come back and ask whether it has changed.
   */
  version?: string;
  /**
   * The author's cover. Painted immediately, underneath the frame, so the
   * largest surface on the detail page is a picture of the component from the
   * first frame instead of a loader.
   */
  poster?: string;
};

/**
 * Renders a published component from its prebuilt bundle.
 *
 * The bundle is generated once at publish time, so this is a single GET with no
 * compiling in the browser and no per-card bundler. The URL names the build
 * version, so a frame produced by an older build is never served from a cache
 * that the new build cannot reach.
 *
 * What the reader sees while that GET is in flight is the difference between a
 * page that feels instantaneous and one that feels like it is thinking. It used
 * to be the words "Loading preview..." on a blank rectangle — at the size of the
 * detail preview, that is a white hole where the product should be. The order
 * is now: the cover if there is one, then the frame fading in over it, and only
 * when there is no cover a branded placeholder. The placeholder is the mark,
 * quietly pulsing, rather than text: it says who is loading, not what.
 */
export function BundledPreview({
  slug,
  height = 240,
  className,
  theme = "light",
  version,
  poster,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [loadedFrame, setLoadedFrame] = useState<string | null>(null);

  /**
   * The frame is named after what it shows.
   *
   * A new slug or a new theme is a new frame, and a new frame has not
   * loaded yet — so the poster has to come back while it arrives. Naming
   * the frame and remembering which one loaded keeps those two facts
   * together: the poster is under the frame whenever the frame that is on
   * screen is not the frame that finished loading.
   */
  const frameKey = `${slug}|${theme}|${version ?? PREVIEW_BUILD_VERSION}`;
  const loaded = loadedFrame === frameKey;

  /**
   * The address of the document.
   *
   * The build's own name goes into it when there is one, so the browser may
   * keep the answer: a URL that names its contents cannot be stale, so it
   * never has to be checked. Without a name the URL carries the builder's
   * version instead, and the browser asks — a round trip that answers "nothing
   * changed" every time.
   */
  const src = `/api/components/preview?slug=${encodeURIComponent(slug)}&theme=${theme}&v=${
    version ?? PREVIEW_BUILD_VERSION
  }`;

  const cover = coverImageUrl(poster);

  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height }}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            // The preview document has a transparent body, so the poster must
            // leave once the frame is painted — otherwise the component is
            // drawn on top of a screenshot of itself.
            loaded ? "opacity-0" : "opacity-100"
          )}
        />
      ) : null}

      {!loaded ? (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            cover
              ? "bg-background/45 backdrop-blur-[1.5px]"
              : "bg-gradient-to-br from-muted/40 via-background to-muted/20"
          )}
          aria-hidden="true"
        >
          <span className="animate-pulse">
            <BrandMark size={26} glow={false} />
          </span>
        </div>
      ) : null}

      <iframe
        key={frameKey}
        ref={frameRef}
        title={`${slug} preview`}
        src={src}
        onLoad={() => setLoadedFrame(frameKey)}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        className={cn(
          "relative h-full w-full border-0 bg-transparent transition-opacity duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
