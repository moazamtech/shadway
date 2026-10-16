"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import {
  collectNpmDependencies,
  sandboxPackageVersion,
} from "@/lib/studio/deps";
import { buildSandpackProject } from "@/lib/studio/sandpack";

/**
 * The one place a project is turned into a running sandbox.
 *
 * Sandpack bundles the project in the browser — on the author's own machine —
 * and renders it in an iframe. The host runs nothing: no dev server, no
 * compiler, no per-editor process. That is what keeps the studio affordable
 * however many people have it open.
 *
 * The project handed to Sandpack is assembled by exactly the same code the
 * publish build and the stylesheet compiler use, so what the author sees while
 * writing is what they publish:
 *
 * - Their own files, plus every vendored shadcn/ui source they import, followed
 *   transitively. `@/components/ui/button` is a real file, like an installed
 *   shadcn project — and only the components actually used are pulled in, so
 *   the sandbox installs nothing it will not run. That walk happens on the
 *   server and arrives as `vendoredFiles`; the registry is never shipped here.
 * - The compiled stylesheet, injected as `/styles.css`. Tailwind is compiled by
 *   the real compiler on the server (see `/api/studio/preview-css`); until it
 *   arrives the sandbox is not mounted at all, so the first build is the styled
 *   one.
 *
 * The styled entry point is used on purpose: it is what sizes the iframe and
 * draws the bundler's own progress and error overlays.
 */

/**
 * Packages the sandbox already provides.
 *
 * React comes with the template. `next` is deliberately excluded: the project
 * imports `next/image`, `next/link` and friends, and installing the real
 * framework into a plain React sandbox is both enormous and useless — the
 * shims in `lib/studio/sandpack` are what those specifiers resolve to.
 */
const SANDBOX_PROVIDED = new Set(["react", "react-dom", "next"]);

/** The live sandbox, as handed to the studio. */
export type SandpackApi = ReturnType<typeof useSandpack>["sandpack"];

/**
 * Hands the running sandbox to the studio.
 *
 * The file explorer and the code editor write through this rather than waiting
 * for a prop round-trip, so an edit reaches the preview as it is typed. The
 * sandbox is the live project; the studio's state stays the document that gets
 * saved and published.
 */
function SandboxBridge({
  onReady,
}: {
  onReady?: (sandpack: SandpackApi) => void;
}) {
  const { sandpack } = useSandpack();

  // Keep the newest callback without making the effect depend on it — the
  // studio passes a fresh closure often enough to matter.
  const latest = useRef(onReady);
  latest.current = onReady;

  /**
   * `useSandpack()` returns a brand-new wrapper object on every render, so an
   * effect keyed on `sandpack` fires on every render — and since reporting the
   * sandbox writes files into it, that is an infinite loop.
   *
   * What actually means "a new sandbox" is a new provider, and the provider is
   * remounted through `key`. So one report per mount is exactly right.
   */
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current || !latest.current) return;
    reported.current = true;
    latest.current(sandpack);
  }, [sandpack]);

  return null;
}

type Props = {
  /** The author's project, keyed by `/`-rooted path. */
  files: Record<string, string>;
  /**
   * The vendored shadcn/ui sources the project reaches, keyed by project path.
   *
   * Resolved on the server from the same import walk that compiles the
   * stylesheet — see `/api/studio/preview-css`. The registry itself never
   * reaches the browser: it is a couple of hundred kilobytes and the sandbox
   * only mounts the files an import chain actually touches.
   */
  vendoredFiles?: PreviewFileInput[];
  /**
   * The compiled project stylesheet, injected as `/styles.css`.
   *
   * Left undefined while it is still compiling: the sandbox waits for it, so
   * a preview is never built against an empty stylesheet.
   */
  compiledCss?: string;
  /** Extra npm packages the project needs, e.g. ones installed by hand. */
  dependencies?: string[];
  theme: "light" | "dark";
  /** The page `/App.tsx` renders. Defaults to `/app/page.tsx`. */
  page?: string;
  /** Bumping this remounts the sandbox from scratch. */
  reloadKey?: number;
  /** Called with the live sandbox once it is running. */
  onReady?: (sandpack: SandpackApi) => void;
  className?: string;
};

export function SandpackPreviewPane({
  files,
  vendoredFiles,
  compiledCss,
  dependencies,
  theme,
  page,
  reloadKey = 0,
  onReady,
  className,
}: Props) {
  /**
   * The author's files plus the vendored shadcn/ui sources they import.
   *
   * A file the author supplied themselves always wins, which is what makes
   * "copy a component into the project and edit it" behave the way an
   * installed shadcn project does.
   */
  const sources = useMemo(() => {
    const byPath = new Map<string, PreviewFileInput>();

    for (const file of vendoredFiles ?? []) {
      byPath.set(file.path, {
        path: file.path.startsWith("/") ? file.path : `/${file.path}`,
        content: file.content,
      });
    }
    for (const [path, content] of Object.entries(files)) {
      byPath.set(path.startsWith("/") ? path : `/${path}`, {
        path: path.startsWith("/") ? path : `/${path}`,
        content,
      });
    }

    return [...byPath.values()];
  }, [files, vendoredFiles]);

  const project = useMemo(
    () =>
      buildSandpackProject({
        files: Object.fromEntries(
          sources.map((file) => [file.path, file.content])
        ),
        compiledCss,
        theme,
        page,
      }),
    [sources, compiledCss, theme, page]
  );

  /**
   * Every package the sandbox must install — including the ones only the
   * vendored shadcn/ui sources import (`radix-ui`, `lucide-react`), which the
   * author's own files never mention.
   */
  const customSetup = useMemo(() => {
    const names = [
      ...new Set([...collectNpmDependencies(sources), ...(dependencies ?? [])]),
    ].sort();

    return {
      dependencies: Object.fromEntries(
        names
          .filter((name) => name && !SANDBOX_PROVIDED.has(name))
          .map((name) => [name, sandboxPackageVersion(name)])
      ),
    };
  }, [sources, dependencies]);

  // No stylesheet yet: rendering the sandbox now would build it without one,
  // and the sandbox does not re-read a stylesheet that was empty at boot.
  if (compiledCss === undefined) return null;

  return (
    <SandpackProvider
      key={reloadKey}
      template="react-ts"
      files={project.files}
      customSetup={customSetup}
      theme={theme}
      options={{
        recompileMode: "delayed",
        recompileDelay: 400,
        autorun: true,
        autoReload: true,
      }}
      style={{ height: "100%" }}
    >
      {/* `entry` is deliberately left alone. Sandpack's `react-ts` template
          boots from its own `/index.tsx`, which mounts `/App.tsx` into
          `#root`; pointing the entry at `/App.tsx` instead renders a module
          that only exports a component, and the frame stays empty. */}
      <SandpackPreview
        className={className}
        style={{ height: "100%", width: "100%", background: "transparent" }}
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        showNavigator={false}
      />

      <SandboxBridge onReady={onReady} />
    </SandpackProvider>
  );
}
