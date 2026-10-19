"use client";

import { useEffect, useRef, useState } from "react";

import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";

/**
 * The project's compiled Tailwind stylesheet.
 *
 * Sandpack builds the JavaScript in the browser, but the stylesheet comes from
 * the server: Tailwind v4 has to read the project's own `globals.css` and the
 * design system's custom variants and utilities, which the in-browser build
 * cannot do. The request is debounced, and the last good stylesheet is kept
 * while the next one compiles, so the preview never flashes unstyled.
 *
 * Two details matter:
 *
 * - Requests are keyed by the *content* of the project, not by the object.
 *   Callers rebuild their file map on every render, so a naive `useEffect`
 *   would abort and restart the request forever and the stylesheet would never
 *   land. The key is only remembered once a compile has actually succeeded.
 * - `initialCss` lets the caller start with a stylesheet it already has (the
 *   studio page compiles the project it is about to hand over). The sandbox is
 *   then built once, correctly styled, instead of being built unstyled and
 *   patched afterwards — a stylesheet that was empty at boot is not re-read.
 *
 * The effect is deliberately self-contained: it owns its timer and its
 * cancellation, and nothing outside it can cancel the work. React invokes
 * effects twice in development (StrictMode), and an effect whose pending work
 * can be cancelled by a *different* effect's cleanup leaves the request dead on
 * the second pass — a blank preview with no error anywhere.
 */

/** The identity of a compile request. */
function compileKey(files: Record<string, string>, styleCode: string | undefined) {
  return JSON.stringify([
    styleCode ?? "",
    Object.entries(files).map(([path, content]) => ({ path, content })),
  ]);
}

export type PreviewCssOptions = {
  /** A stylesheet the caller already compiled for exactly these files. */
  initialCss?: string;
  /**
   * The vendored shadcn/ui sources that same compile resolved.
   *
   * They travel with the stylesheet because they come from the same walk of
   * the project's imports — and because the browser has no other way to learn
   * them without downloading the whole registry.
   */
  initialVendored?: PreviewFileInput[];
  /** How long to wait after the last change before compiling. */
  delay?: number;
};

export function usePreviewCss(
  files: Record<string, string>,
  styleCode: string | undefined,
  { initialCss, initialVendored, delay = 350 }: PreviewCssOptions = {}
) {
  const [css, setCss] = useState<string | null>(initialCss ?? null);
  const [vendored, setVendored] = useState<PreviewFileInput[]>(initialVendored ?? []);
  const [error, setError] = useState<string | null>(null);

  /** The project whose stylesheet `css` holds. */
  const compiled = useRef<string | null>(
    // A stylesheet that arrived with the first render is already current.
    initialCss === undefined ? null : compileKey(files, styleCode)
  );

  /**
   * The last project a compile was *attempted* for, successful or not.
   *
   * Only `compiled` used to be checked, so a failed compile looked identical to
   * a never-compiled one and the next render tried again — and the next. Callers
   * rebuild their file map every render, so a project whose stylesheet cannot be
   * built (a `@apply` of a class that does not exist, a missing theme, an empty
   * `globals.css`) turned into a request storm against the compile endpoint, one
   * per render, for as long as the author sat on the error. Keying the attempt
   * instead means a failure is retried when the project *changes*, which is the
   * only thing that can fix it, and not merely when React re-renders.
   */
  const attempted = useRef<string | null>(compiled.current);

  useEffect(() => {
    const key = compileKey(files, styleCode);
    if (key === compiled.current || key === attempted.current) return;
    attempted.current = key;

    const entries = Object.entries(files).map(([path, content]) => ({
      path,
      content,
    }));
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/studio/preview-css", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ files: entries, styleCode }),
          });

          if (!response.ok) {
            throw new Error(`Stylesheet compile failed (${response.status})`);
          }

          const data = (await response.json()) as {
            css?: string;
            vendored?: PreviewFileInput[];
          };
          if (cancelled) return;

          compiled.current = key;
          setCss(typeof data.css === "string" ? data.css : "");
          if (Array.isArray(data.vendored)) setVendored(data.vendored);
          setError(null);
        } catch (err) {
          if (cancelled) return;

          /**
           * The last good stylesheet is *kept*, not cleared.
           *
           * It used to `setCss("")`, on the reasoning that unstyled beats never
           * rendering — but the preview renders either way; the sandbox only
           * loses its CSS. And the loss was total and silent: neither caller
           * read `error`, so a transient 500 left the whole preview unstyled
           * with nothing on screen to say why, and the author was left staring
           * at a broken-looking component with no way to connect it to the
           * stylesheet they had just broken.
           *
           * A stylesheet that is one edit behind is nearly free — the preview
           * keeps its layout, its colours and its spacing, and the only thing
           * missing is the class the author has not committed yet. An empty
           * one takes all of it away. So the stale sheet is held, the error is
           * reported, and the next edit to the project retries the compile.
           *
           * `compiled.current` is deliberately left alone: it names the project
           * the *retained* stylesheet was built from, and pretending the failed
           * one landed would pin the studio to a broken project forever.
           */
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [files, styleCode, delay]);

  return { css, vendored, error, ready: css !== null };
}
