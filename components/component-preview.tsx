"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DevServerPreview } from "@/components/preview/dev-server-preview";
import { buildPreviewFiles, type PreviewFiles } from "@/lib/preview/files";

export { buildPreviewFiles };
export type { PreviewFiles };

/**
 * Inline preview of a component that is still being written.
 *
 * It runs on the same real Next.js dev server as every other preview on the
 * site — nothing is emulated — and it waits until it scrolls into view, so a
 * page full of previews does not boot a server for every card at once.
 */
export function ComponentPreview({
  code,
  title,
  files,
  entryFile,
  height = 200,
  isDarkTheme = true,
}: {
  code?: string;
  title: string;
  files?: PreviewFiles;
  entryFile?: string;
  height?: number;
  isDarkTheme?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const projectFiles = useMemo<Record<string, string> | null>(() => {
    const source = files ?? code;
    if (!source) return null;
    return Object.fromEntries(
      buildPreviewFiles(source).map((file) => [file.path, file.content])
    );
  }, [files, code]);

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-lg border bg-background"
      style={{ height }}
    >
      {visible && projectFiles ? (
        <DevServerPreview
          code={code}
          files={projectFiles}
          entryFile={entryFile}
          isDarkTheme={isDarkTheme}
          className="h-full w-full"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          {title} preview
        </div>
      )}
    </div>
  );
}
