"use client";

import { useEffect, useRef, useState } from "react";
import { LocalPreview } from "@/components/preview/local-preview";
import {
  buildPreviewFiles,
  type PreviewFileInput,
  type PreviewFiles,
} from "@/lib/preview/files";

export { buildPreviewFiles };
export type { PreviewFiles, PreviewFileInput };

/**
 * Live, in-browser preview. Used by the studio and quick-paste flow where the
 * source is still being edited. Published components on the feed use the
 * server-built bundle at /api/components/preview instead (built once).
 */
export function ComponentSandpackPreview({
  code,
  title,
  files,
  height = 200,
}: {
  code?: string;
  title: string;
  dependencies?: string[];
  files?: PreviewFiles;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const [previewFiles, setPreviewFiles] = useState<PreviewFileInput[]>([]);

  useEffect(() => {
    const source = files ?? code;
    if (!source) {
      setPreviewFiles([]);
      return;
    }
    setPreviewFiles(buildPreviewFiles(source));
  }, [files, code]);

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border bg-background">
      {mounted ? (
        <LocalPreview files={previewFiles} height={height} />
      ) : (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height }}
        >
          {title} preview
        </div>
      )}
    </div>
  );
}