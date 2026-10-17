"use client";

import { useEffect, useRef, useState } from "react";

import { PREVIEW_BUILD_VERSION } from "@/lib/preview/version";

type Props = {
  slug: string;
  height?: number | string;
  className?: string;
  theme?: "light" | "dark";
};

/**
 * Renders a published component from its prebuilt bundle.
 *
 * The bundle is generated once at publish time, so this is a single GET with no
 * compiling in the browser and no per-card bundler. The URL names the build
 * version, so a frame produced by an older build is never served from a cache
 * that the new build cannot reach.
 */
export function BundledPreview({ slug, height = 240, className, theme = "light" }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [slug, theme]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height, overflow: "hidden" }}
    >
      <iframe
        key={`${slug}|${theme}|${PREVIEW_BUILD_VERSION}`}
        ref={frameRef}
        title={`${slug} preview`}
        src={`/api/components/preview?slug=${encodeURIComponent(slug)}&theme=${theme}&v=${PREVIEW_BUILD_VERSION}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height: "100%", border: 0, background: "transparent" }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background text-xs text-muted-foreground">
          Loading preview...
        </div>
      )}
    </div>
  );
}