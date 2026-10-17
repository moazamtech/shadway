"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { buildSandpackProject, type SandpackFiles } from "@/lib/studio/sandpack";

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
 * ## Why the project is pushed, never passed
 *
 * Sandpack's provider resets *its entire state* — files, dependencies and the
 * bundler client with them — whenever the identity of its `files`, `customSetup`
 * or `template` prop changes. A caller who rebuilds those objects on every
 * render therefore tears the sandbox down on every render: the bundler restarts
 * forever, the loading screen never clears, and edits never land.
 *
 * So the provider is given a project exactly once, frozen for the life of the
 * mount, and every later change is delivered as a compile sent straight to the
 * running client. Remounting is the only way to change the boot project, which
 * is the semantics a "reload the preview" button actually wants — and it is
 * also what happens when the dependency set changes, since a new package has to
 * be installed before it can be imported.
 *
 * ## Why the compile is sent by hand
 *
 * Sandpack's own editor hot-loads by writing into provider state with
 * `updateFile`; an effect inside the provider then forwards the provider's file
 * map to the bundler as a compile. Our editor is Monaco, outside Sandpack, so
 * nothing does that writing for us — the pane has to send the compile itself.
 *
 * It sends the same call that effect sends, `client.updateSandbox`, and the same
 * payload: the provider's *complete* file map with the current project overlaid.
 * That matters, because `updateSandbox` merges at the top level — `files` is
 * replaced wholesale, not merged per path. A compile carrying only the author's
 * files would drop the template's `/index.tsx`, and the frame would go blank on
 * the first keystroke. Seeding from the provider's own map keeps the entry
 * module, the injected `/package.json` and the template's `index.html` in place.
 *
 * The upside over `updateFile` is that a whole project is one compile rather
 * than one per file, and it does not depend on the client's `status` flag —
 * which is what makes it robust when a bundler is still coming up.
 *
 * ## Why the compile names a channel it was not given
 *
 * A compile is addressed to a channel id, and the bundler answers on the id it
 * last saw registered. React runs effects twice on mount in development, and
 * Sandpack builds a bundler client from an effect, so two clients are
 * constructed over the one iframe — each with its own random id, each
 * registering on the same `initialized`. The bundler keeps the last
 * registration; `sandpack.clients` keeps whichever `await` settled last. They
 * are frequently not the same client.
 *
 * A compile sent on the other id is dropped without a word: no error, no reply,
 * no recompile, and the client's status never leaves `initializing`. So the
 * pane listens to the bundler's own replies, learns the id it is answering on,
 * and adopts it before compiling. The reply then matches the client's channel
 * and the compile is a normal one.
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

/** The template the sandbox runs. Also what a manual compile has to name. */
const SANDBOX_TEMPLATE = "react-ts";

/** Stable for the life of the page — a new object would reset the provider. */
const PROVIDER_STYLE = { height: "100%" } as const;

/**
 * Start the bundler as soon as the provider mounts.
 *
 * The default (`lazy`) waits for the preview to scroll into view. In the studio
 * it is always on screen, so the wait only delays the first build.
 */
const PROVIDER_OPTIONS = { autorun: true, initMode: "immediate" } as const;

const PREVIEW_STYLE = {
  height: "100%",
  width: "100%",
  background: "transparent",
} as const;

/** The live sandbox, as handed to the bridge that drives it. */
type SandpackApi = ReturnType<typeof useSandpack>["sandpack"];

/**
 * The running bundler client, as far as this file is concerned.
 *
 * `sandpack.clients` is public — it is what `useSandpackClient` hands out — but
 * only these two members are used here.
 */
type SandboxClient = {
  updateSandbox: (setup: {
    files: Record<string, { code: string }>;
    template?: string;
  }) => void;
  /** The channel this client's messages carry. See `pushProject`. */
  iframeProtocol?: { channelId: number };
};

function clientsOf(api: SandpackApi): SandboxClient[] {
  const clients = (api as unknown as { clients?: Record<string, SandboxClient> })
    .clients;
  return clients ? Object.values(clients) : [];
}

/**
 * The provider's own file map, normalized to the shape a compile wants.
 *
 * `sandpack.files` is the project as Sandpack sees it — the template's files,
 * the `/package.json` it injects from `customSetup.dependencies`, and this
 * pane's boot project — keyed by path, with each value either a plain string or
 * a `{ code }` entry.
 */
function providerEntries(api: SandpackApi): Record<string, { code: string }> {
  const source = (api as unknown as { files?: Record<string, unknown> }).files;
  const entries: Record<string, { code: string }> = {};

  for (const [path, value] of Object.entries(source ?? {})) {
    if (typeof value === "string") entries[path] = { code: value };
    else if (value && typeof value === "object") {
      const code = (value as { code?: unknown }).code;
      if (typeof code === "string") entries[path] = { code };
    }
  }

  return entries;
}

/**
 * Reports the running sandbox after every render.
 *
 * `useSandpack()` returns a brand-new wrapper object on every render, so the
 * sync is deliberately unkeyed: it has to run whenever the provider re-renders,
 * because that is also when a client may have appeared for the first time. The
 * sync itself is a no-op unless something actually changed.
 */
function SandboxBridge({ onSync }: { onSync: (sandpack: SandpackApi) => void }) {
  const { sandpack } = useSandpack();

  // Keep the newest callback without making the effect depend on it.
  const latest = useRef(onSync);
  latest.current = onSync;

  useEffect(() => {
    latest.current(sandpack);
  });

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
  className?: string;
};

/**
 * Gates on the stylesheet.
 *
 * The sandbox is not mounted until the compiled CSS exists, so its first build
 * is the styled one. Splitting the gate into a hook-free wrapper keeps the
 * sandbox's boot project free to be frozen on the render that actually mounts
 * it, rather than on an earlier, unstyled one.
 */
export function SandpackPreviewPane(props: Props) {
  if (props.compiledCss === undefined) return null;
  return <Sandbox {...props} compiledCss={props.compiledCss} />;
}

function Sandbox({
  files,
  vendoredFiles,
  compiledCss,
  dependencies,
  theme,
  page,
  reloadKey = 0,
  className,
}: Props & { compiledCss: string }) {
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
      const path = file.path.startsWith("/") ? file.path : `/${file.path}`;
      byPath.set(path, { path, content: file.content });
    }
    for (const [raw, content] of Object.entries(files)) {
      const path = raw.startsWith("/") ? raw : `/${raw}`;
      byPath.set(path, { path, content });
    }

    return [...byPath.values()];
  }, [files, vendoredFiles]);

  /** The project, rewritten and ready for the sandbox bundler. */
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
   * The dependency *set*, as a primitive — so the setup object is stable.
   *
   * `dependencies` is an array a caller rebuilds freely, and `sources` is
   * rebuilt from the caller's file map, which they may also rebuild freely. A
   * setup object keyed on either would therefore be new on every render, and
   * Sandpack resets its whole state — including the files just written into it
   * — whenever that object's identity changes. Joined names change only when
   * the set genuinely changes.
   */
  const dependencyKey = useMemo(
    () => [...new Set(dependencies ?? [])].filter(Boolean).sort().join("\n"),
    [dependencies]
  );

  /** The packages the project's own sources import, as the same primitive. */
  const sourceDependencyKey = useMemo(
    () => collectNpmDependencies(sources).join("\n"),
    [sources]
  );

  /**
   * Every package the sandbox must install — including the ones only the
   * vendored shadcn/ui sources import (`radix-ui`, `lucide-react`), which the
   * author's own files never mention.
   */
  const customSetup = useMemo(() => {
    const names = [
      ...new Set([
        ...sourceDependencyKey.split("\n"),
        ...dependencyKey.split("\n"),
      ]),
    ]
      .filter((name) => name && !SANDBOX_PROVIDED.has(name))
      .sort();

    return {
      dependencies: Object.fromEntries(
        names.map((name) => [name, sandboxPackageVersion(name)])
      ),
    };
  }, [sourceDependencyKey, dependencyKey]);

  /**
   * What the sandbox boots from.
   *
   * A new package cannot be added to a running bundler, so a change to the
   * dependency set remounts the sandbox — and the boot project is latched per
   * mount, so the rebuild starts from the current project rather than from
   * whatever it booted with the first time.
   */
  const bootKey = `${reloadKey}|${sourceDependencyKey}|${dependencyKey}`;

  /**
   * The project the sandbox boots with, frozen for the life of this mount.
   *
   * Assigning during render is deliberate: it is a one-shot latch, not derived
   * state, and it has to be in place before the provider below is rendered.
   */
  const bootRef = useRef<SandpackFiles | null>(null);
  if (bootRef.current === null) bootRef.current = project.files;

  /** The project as last written into the sandbox. */
  const pushedRef = useRef<SandpackFiles>(bootRef.current);

  /**
   * The channel the bundler is actually answering on.
   *
   * Read from the bundler's own replies: every message it sends carries the
   * `$id` of the frame registration it accepted. See `pushProject` for why this
   * is needed rather than using the client's own id.
   *
   * The studio mounts one preview, so the page carries one sandbox
   * conversation; a second would need this keyed by message source.
   */
  const liveChannelRef = useRef<number | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { codesandbox?: unknown; $id?: unknown };
      if (!data || !data.codesandbox) return;
      if (typeof data.$id === "number") liveChannelRef.current = data.$id;
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /**
   * Reset the "last written" cursor whenever the sandbox remounts.
   *
   * A remount (new dependency set, manual reload) boots from `bootRef.current`,
   * which is latched to the first mount and never moves. If `pushedRef` is left
   * holding the project as it was before the remount, the first sync afterwards
   * sees no diff against it and returns without pushing — so the sandbox keeps
   * showing the files from its first boot and every edit made since then is
   * lost until the author types again. Clearing it back to the boot project
   * makes that sync push the current project as a diff.
   */
  useEffect(() => {
    pushedRef.current = bootRef.current ?? {};
  }, [bootKey]);

  /** The newest project, for the sync that runs after every render. */
  const projectRef = useRef(project);
  projectRef.current = project;

  const pushProject = useCallback((api: SandpackApi, next: SandpackFiles) => {
    const previous = pushedRef.current;

    let changed = false;
    for (const [path, content] of Object.entries(next)) {
      if (previous[path] !== content) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      for (const path of Object.keys(previous)) {
        if (!(path in next)) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;

    /**
     * Nothing to compile into yet. Leaving `pushedRef` alone means the change
     * is still outstanding and the next sync — the one that runs once the
     * client exists — will deliver it.
     */
    const clients = clientsOf(api);
    if (clients.length === 0) return;

    /**
     * The compile payload starts as the provider's own map.
     *
     * A compile replaces the file map wholesale, so this is what keeps the
     * template's `/index.tsx` — the module that actually mounts `/App.tsx` —
     * along with the injected `/package.json` and the template's `index.html`.
     * Sandpack's own hot-reload effect sends exactly this map for the same
     * reason.
     */
    const files = providerEntries(api);

    // A file the project no longer has must be dropped explicitly, or the
    // bundler keeps serving the last version of it.
    for (const path of Object.keys(previous)) {
      if (!(path in next)) delete files[path];
    }

    // Then the current project goes on top, whole.
    for (const [path, content] of Object.entries(next)) {
      files[path] = { code: content };
    }

    /**
     * A compile is only legal with a manifest.
     *
     * The bundler client is constructed without a `dependencies` list —
     * Sandpack bakes the packages into `/package.json` before the client ever
     * sees the project — so `getFiles()` throws rather than build when that
     * file is missing. It is always present in the provider's map; leaving the
     * change outstanding if it is not means the next sync retries, instead of
     * the edit being dropped.
     */
    if (files["/package.json"] === undefined) return;

    let compiled = false;
    for (const client of clients) {
      try {
        /**
         * Speak on the channel the bundler is listening to.
         *
         * React runs effects twice on mount in development, and Sandpack builds
         * a bundler client from an effect — so two clients are constructed over
         * the same iframe, each with its own random channel id. The bundler
         * keeps the last frame registration it sees, which is not necessarily
         * the client `sandpack.clients` ends up holding.
         *
         * A compile sent on the wrong id is simply dropped: no error, no reply,
         * no recompile — the client's status never leaves `initializing`.
         * Adopting the id the bundler is already answering on makes the compile
         * land, and the reply with it.
         */
        const live = liveChannelRef.current;
        if (live !== null && client.iframeProtocol) {
          client.iframeProtocol.channelId = live;
        }

        client.updateSandbox({ files, template: SANDBOX_TEMPLATE });
        compiled = true;
      } catch (error) {
        // A dead bundler must never take the studio down with it: the preview
        // is one pane, and the editor beside it has unsaved work in it.
        console.error("[sandpack] compile failed", error);
      }
    }

    // Nothing took the write, so leave it outstanding: the next sync — once a
    // live client exists — will deliver it.
    if (!compiled) return;

    pushedRef.current = { ...next };
  }, []);

  const handleSync = useCallback(
    (api: SandpackApi) => {
      pushProject(api, projectRef.current.files);
    },
    [pushProject]
  );

  return (
    <SandpackProvider
      key={bootKey}
      template={SANDBOX_TEMPLATE}
      files={bootRef.current}
      customSetup={customSetup}
      theme={theme}
      options={PROVIDER_OPTIONS}
      style={PROVIDER_STYLE}
    >
      {/* `entry` is deliberately left alone. Sandpack's `react-ts` template
          boots from its own `/index.tsx`, which mounts `/App.tsx` into
          `#root`; pointing the entry at `/App.tsx` instead renders a module
          that only exports a component, and the frame stays empty. */}
      <SandpackPreview
        className={className}
        style={PREVIEW_STYLE}
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        showNavigator={false}
      />

      <SandboxBridge onSync={handleSync} />
    </SandpackProvider>
  );
}
