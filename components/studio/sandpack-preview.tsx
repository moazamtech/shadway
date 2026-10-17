"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import type { PreviewFileInput } from "@/lib/preview/shadcn-ui";
import { splitRadixImports } from "@/lib/preview/radix";
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

/**
 * The shortest gap between two compiles, in milliseconds.
 *
 * The project is pushed from an effect that runs after every render, and a
 * render is a keystroke — so without this, typing a word asks the bundler for
 * one full build per character. The bundler obliges, and the preview falls
 * seconds behind the cursor while every one of those builds is thrown away by
 * the next one.
 *
 * This is a throttle rather than a debounce on purpose: the preview keeps up
 * while the author types, at a fixed rate, instead of going dark until they
 * pause — which is also what makes the first edit land immediately, since the
 * window is empty when it arrives.
 */
const COMPILE_INTERVAL = 300;

/** Stable for the life of the page — a new object would reset the provider. */
const PROVIDER_STYLE = { height: "100%" } as const;

/**
 * Start the bundler as soon as the provider mounts.
 *
 * The default (`lazy`) waits for the preview to scroll into view. In the studio
 * it is always on screen, so the wait only delays the first build.
 *
 * `recompileMode` is set even though this pane compiles by hand: it governs the
 * provider's own effect, which would otherwise send a second, unthrottled
 * compile whenever a file is written through `sandpack.updateFile`.
 */
const PROVIDER_OPTIONS = {
  autorun: true,
  initMode: "immediate",
  recompileMode: "delayed",
  recompileDelay: COMPILE_INTERVAL,
} as const;

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
 * Whether two projects differ at any path — added, changed or removed.
 *
 * The push path asks this twice: once to decide whether anything is worth
 * compiling at all, and once to decide whether it is worth *scheduling* a
 * compile for. Both are the same question, and a whole-project string compare
 * would answer it more slowly than walking the paths.
 */
function differs(previous: SandpackFiles, next: SandpackFiles): boolean {
  for (const [path, content] of Object.entries(next)) {
    if (previous[path] !== content) return true;
  }
  for (const path of Object.keys(previous)) {
    if (!(path in next)) return true;
  }
  return false;
}

/**
 * Reports the running sandbox after every render.
 *
 * `useSandpack()` returns a brand-new wrapper object on every render, so the
 * sync is deliberately unkeyed: it has to run whenever the provider re-renders,
 * because that is also when a client may have appeared for the first time. The
 * sync itself is a no-op unless something actually changed.
 *
 * There is no ref holding the callback. An effect with no dependency list runs
 * after every render and closes over *this* render's props, so it is already
 * the newest one — and keeping a copy in a ref written during render is both
 * redundant and what `react-hooks/refs` forbids.
 */
function SandboxBridge({ onSync }: { onSync: (sandpack: SandpackApi) => void }) {
  const { sandpack } = useSandpack();

  useEffect(() => {
    onSync(sandpack);
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
      byPath.set(path, { path, content: splitRadixImports(file.content) });
    }
    for (const [raw, content] of Object.entries(files)) {
      const path = raw.startsWith("/") ? raw : `/${raw}`;
      byPath.set(path, { path, content: splitRadixImports(content) });
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
  const requestedDependencies = useMemo(() => {
    const names = new Set<string>();
    for (const name of sourceDependencyKey.split("\n")) if (name) names.add(name);
    for (const name of dependencyKey.split("\n")) if (name) names.add(name);
    return [...names].filter((name) => !SANDBOX_PROVIDED.has(name)).sort();
  }, [sourceDependencyKey, dependencyKey]);

  /**
   * The packages installed, which only ever grows while the pane is mounted.
   *
   * A new package cannot be added to a running bundler — Sandpack bakes the
   * dependency list into `/package.json` before the client is built — so a
   * dependency the sandbox does not have remounts it and installs the set from
   * scratch. The mirror of that is a dependency the sandbox *gains* while the
   * list also *loses* one: the derived set changes identity, the provider
   * remounts, and the author pays a full reinstall for deleting an `import`
   * line.
   *
   * So the derived set is only ever added to. Removing an import leaves the
   * package installed and unimported, which costs a few kilobytes the bundler
   * never reads, and the sandbox is never torn down for a deletion. A manual
   * reload keeps it too: it is the same bundler, and the packages are already
   * in it.
   *
   * This is React's own "adjust state during render when a prop changes"
   * pattern: setting the state here re-renders before anything commits, so the
   * provider below is only ever rendered with the set it should boot from.
   */
  const [installedNames, setInstalledNames] = useState<string[]>([]);

  if (!requestedDependencies.every((name) => installedNames.includes(name))) {
    setInstalledNames([...new Set([...installedNames, ...requestedDependencies])].sort());
  }

  const installedKey = installedNames.join("\n");

  const customSetup = useMemo(
    () => ({
      dependencies: Object.fromEntries(
        installedNames.map((name) => [name, sandboxPackageVersion(name)])
      ),
    }),
    [installedNames]
  );

  /**
   * What the sandbox boots from.
   *
   * A new package cannot be added to a running bundler, so *growing* the
   * dependency set remounts the sandbox — and the boot project is latched per
   * mount, so the rebuild starts from the current project rather than from
   * whatever it booted with the first time.
   */
  const bootKey = `${reloadKey}|${installedKey}`;

  /**
   * The project the sandbox boots with, latched per mount.
   *
   * Assigning during render is deliberate: it is a one-shot latch, not derived
   * state, and it has to be in place before the provider below is rendered. The
   * latch also keeps the `files` prop identity stable between remounts — the
   * provider resets its whole state, files included, whenever that identity
   * changes.
   */
  const bootRef = useRef<SandpackFiles>(project.files);

  /** The project as last written into the sandbox. */
  const pushedRef = useRef<SandpackFiles>(project.files);

  /**
   * Re-latch whenever the boot key changes.
   *
   * A dependency change (or a manual reload through `reloadKey`) remounts the
   * provider via `key`, and it has to boot from the project as it is *now* —
   * not from whatever it booted with the first time.
   *
   * Doing this during render rather than in an effect is the whole point:
   * effects run child-first, so the bridge's sync fires before a parent effect
   * could run, sees `pushedRef` still holding the pre-remount project, finds no
   * diff and drops the update — leaving the sandbox on its stale boot build
   * until the author types again. Re-latching here means the fresh boot is
   * already current, and that first sync is a correct no-op instead of a
   * redundant recompile.
   */
  const bootKeyRef = useRef(bootKey);
  if (bootKeyRef.current !== bootKey) {
    bootKeyRef.current = bootKey;
    bootRef.current = project.files;
    pushedRef.current = project.files;
  }

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

  /** The newest project, for the sync that runs after every render. */
  const projectRef = useRef(project);
  projectRef.current = project;

  const pushProject = useCallback((api: SandpackApi, next: SandpackFiles) => {
    if (!differs(pushedRef.current, next)) return;

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
    for (const path of Object.keys(pushedRef.current)) {
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

  /**
   * The compile window.
   *
   * `pendingRef` holds the sandbox the next compile should go to; the timer
   * holds the window open. A compile that arrives when the window has passed is
   * sent at once, which is why the first keystroke after a pause feels
   * immediate, and one that arrives inside the window is held — the project it
   * will compile is read fresh when the timer fires, so a burst of keystrokes
   * collapses into a single build of the final state.
   */
  const pendingRef = useRef<SandpackApi | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastCompileRef = useRef(0);

  const flushCompile = useCallback(() => {
    const api = pendingRef.current;
    if (!api) return;
    lastCompileRef.current = Date.now();
    pushProject(api, projectRef.current.files);
  }, [pushProject]);

  // A queued compile must not outlive the pane: the client it names will be
  // gone, and the timer would then fire against a torn-down bundler.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const handleSync = useCallback(
    (api: SandpackApi) => {
      pendingRef.current = api;

      // Nothing to compile is nothing to schedule.
      if (!differs(pushedRef.current, projectRef.current.files)) return;

      // A window is already open, and it will pick this up.
      if (timerRef.current !== null) return;

      const open = Date.now() - lastCompileRef.current;
      if (open >= COMPILE_INTERVAL) {
        flushCompile();
        return;
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        flushCompile();
      }, COMPILE_INTERVAL - open);
    },
    [flushCompile]
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
