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
 * The remount is a keyed one. The sandbox lives in a session component whose
 * key carries the boot project, so a new build is a new component with new
 * state — the boot files, what has been written into the sandbox, what the
 * bundler has answered for — rather than state written over while rendering.
 * The provider used to be keyed the same way and the latch beside it was done
 * by hand during the render; the key does both, and does them before anything
 * is committed, which is what the latch was reaching for.
 *
 * ## Why edits go through the provider's own file state
 *
 * Sandpack's editor hot-loads by writing into provider state with `updateFile`;
 * an effect inside the provider then forwards that state to every bundler
 * client as a compile, and a successful compile clears the error the failed
 * one left on screen. Our editor is Monaco, outside Sandpack, so nothing does
 * that writing for us — the pane writes the files itself and lets the provider
 * own the compile.
 *
 * Writing state rather than driving a bundler client directly is what makes the
 * preview tell the truth. A compile has to be addressed to the channel the
 * bundler registered, and React builds two clients over one iframe in
 * development; the provider knows which one the bundler answered on and drops
 * the rest. Calling the client directly meant guessing, guessing wrong, and the
 * write being dropped without a word — which is how the pane came to show an
 * error for code that no longer exists, with nothing anywhere reporting it.
 *
 * The payload is also the provider's to assemble. `updateFile` and `deleteFile`
 * merge into a map that already holds the template's `/index.tsx` — the module
 * that mounts `/App.tsx` — and the `/package.json` Sandpack injects, so a whole
 * project cannot lose its entry module the way a hand-built payload can.
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
 *
 * The project rides along with the callback for the same reason. The pane has
 * to compile what the author has just typed, and the render that produced this
 * effect is the render that knows what that is: the project is handed over
 * rather than read out of a ref that render would have had to keep current.
 */
function SandboxBridge({
  projectFiles,
  onSync,
}: {
  /** The project as this render produced it. */
  projectFiles: SandpackFiles;
  onSync: (sandpack: SandpackApi, files: SandpackFiles) => void;
}) {
  const { sandpack } = useSandpack();

  useEffect(() => {
    onSync(sandpack, projectFiles);
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

  /**
   * What the sandbox boots from.
   *
   * A new package cannot be added to a running bundler, so *growing* the
   * dependency set remounts the sandbox — and the build that starts has to
   * start from the project as it stands now, not from whatever the sandbox
   * booted with the first time.
   *
   * The boot project is state rather than the current one, because a remount
   * has to boot from something fixed: the project as it stood when the
   * sandbox was last started. A sandbox that boots from a moving target
   * would change under itself.
   */
  const [bootProject, setBootProject] = useState<SandpackFiles>(project.files);
  const [bootNonce, setBootNonce] = useState(0);

  if (!requestedDependencies.every((name) => installedNames.includes(name))) {
    setInstalledNames([...new Set([...installedNames, ...requestedDependencies])].sort());
    // The new build starts from the project as it is now, because the old
    // one is about to be thrown away.
    setBootProject(project.files);
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
   * The sandbox gave up on an edit, and is started again from the new code.
   *
   * A bundler that is sent an update while it is compiling drops it without a
   * word, and the pane cannot tell that from a bundler that simply has not
   * answered yet. When the wait has gone on too long, the honest answer is
   * that the edit did not land — and the way to make it land is to build the
   * project again, which is what the author would have done by hand.
   */
  const restartWith = useCallback((files: SandpackFiles) => {
    setBootProject(files);
    setBootNonce((value) => value + 1);
  }, []);

  const bootKey = `${reloadKey}|${installedKey}|${bootNonce}`;

  return (
    <SandboxSession
      key={bootKey}
      bootFiles={bootProject}
      projectFiles={project.files}
      customSetup={customSetup}
      theme={theme}
      className={className}
      onRestart={restartWith}
    />
  );
}

/**
 * One sandbox, from the build it boots with to the next one.
 *
 * The session is mounted under a key that changes when the boot project
 * changes — a package the sandbox has to install, or a manual reload — and
 * everything that belongs to a build lives inside it: the project it booted
 * from, what has been written into it since, and what the bundler has
 * answered for.
 *
 * Remounting is how the next build starts, and it is a remount rather than a
 * write during render because the state of a build belongs to the build. A
 * changed key is a new component with new state, in place before anything is
 * committed — which is exactly what the old latch did by hand, except that
 * the decision is now React's and the compiler can see it.
 */
function SandboxSession({
  bootFiles,
  projectFiles,
  customSetup,
  theme,
  className,
  onRestart,
}: {
  /** The project the sandbox boots from, and compiles against. */
  bootFiles: SandpackFiles;
  /** The project as it stands, which is what the author has just typed. */
  projectFiles: SandpackFiles;
  /** The packages the sandbox installs. */
  customSetup: { dependencies: Record<string, string> };
  theme: "light" | "dark";
  className?: string;
  /** Called when the bundler has not taken an edit, so the sandbox can start again. */
  onRestart: (files: SandpackFiles) => void;
}) {
  /** The project as last written into the sandbox. */
  const pushedRef = useRef<SandpackFiles>(bootFiles);

  /**
   * The project the bundler could have compiled.
   *
   * A write sent while the bundler was still booting is a write it never
   * saw, so it cannot be the one a later reply is answering. This is the
   * project as it was when the *last* write the bundler was ready for was
   * sent, and it is what a reply is taken to acknowledge.
   */
  const sentRef = useRef<SandpackFiles>(bootFiles);

  /** The bundler client the sync currently hands work to, kept current. */
  const apiRef = useRef<SandpackApi | null>(null);

  /**
   * The project the bundler has actually answered for.
   *
   * A write is not done when it is sent; it is done when the bundler replies. The
   * two are normally the same compile apart, but a reply is the only evidence
   * the project landed, and the watchdog below retries on the gap between them.
   */
  const ackedRef = useRef<SandpackFiles>(bootFiles);

  /** The last moment the bundler said anything at all. */
  const lastReplyRef = useRef(0);

  /** The last moment a write was handed to the bundler. */
  const lastSendRef = useRef(0);

  /**
   * Whether this sandbox has ever answered.
   *
   * A cold codesandbox is silent for as long as it takes to start a container
   * and install the template — routinely longer than the ack timeout. Silence
   * before the first reply is boot, not a lost write, and treating it as one
   * resent the whole project into a bundler that was still coming up: every
   * resend another compile on top of the boot build. The watchdog only means
   * something once the bundler has spoken.
   */
  const bootedRef = useRef(false);

  /** How many times a silent write has been resent. */
  const retryCountRef = useRef(0);

  /**
   * The project as it stands, kept current by the sync.
   *
   * The compile that is scheduled now has to carry the project as it is when
   * it fires, not the one that was current when it was scheduled — otherwise
   * a burst of keystrokes would compile the first of them and leave the rest
   * for the next round. The sync hands the project over on every render, so
   * the value here is the one the author last typed.
   */
  const projectFilesRef = useRef<SandpackFiles>(projectFiles);

  const pushProject = useCallback((api: SandpackApi, next: SandpackFiles) => {
    if (!differs(pushedRef.current, next)) return;

    for (const path of Object.keys(pushedRef.current)) {
      if (!(path in next)) api.deleteFile(path);
    }
    for (const [path, content] of Object.entries(next)) {
      api.updateFile(path, content);
    }

    pushedRef.current = { ...next };
    lastSendRef.current = Date.now();

    /**
     * A write the bundler was ready for is a write it can answer.
     *
     * The write that was made while it was still booting is not one it can
     * have seen, and a reply that arrives afterwards is answering the build
     * before it — not this one.
     */
    if (readyRef.current) sentRef.current = { ...next };
  }, []);

  /**
   * Whether the bundler has finished a compile and can take another.
   *
   * The provider sends an update only to a client that is *done*, and a
   * client that is still compiling is skipped without a word. An edit that
   * arrives in that window is therefore dropped: the file state holds it,
   * the bundler never hears about it, and the preview keeps showing the
   * previous build. This is the whole of why an edit sometimes needs a
   * reload — the author types while the sandbox is still booting, the
   * update is dropped, and nothing ever asks for it again.
   *
   * So the project is held here until the bundler says it is done, and
   * pushed then.
   */
  const readyRef = useRef(false);

  /** The project waiting for the bundler to be ready for it. */
  const heldRef = useRef<SandpackFiles | null>(null);

  /**
   * The bundler says something. A reply is the only evidence that a write landed.
   *
   * A successful compile clears the error the failed one left on screen, so a
   * reply is recorded for every message the bundler sends, not only for the
   * terminal ones. `ackedRef` advances only on a terminal reply, which is what
   * the watchdog below compares against.
   */
  useEffect(() => {
    const onReply = (event: MessageEvent) => {
      const data = event.data as {
        codesandbox?: unknown;
        type?: unknown;
        action?: unknown;
      };
      if (!data || !data.codesandbox) return;

      bootedRef.current = true;
      lastReplyRef.current = Date.now();

      const terminal =
        data.type === "success" ||
        data.type === "done" ||
        (data.type === "action" &&
          (data.action === "show-error" || data.action === "notification"));

      if (terminal) {
        /**
         * The reply answers the write the bundler was ready for.
         *
         * Not the write that was sent while it was booting — that one it never
         * saw, and counting it as answered is how an edit gets lost without
         * anybody noticing.
         */
        ackedRef.current = sentRef.current;
        retryCountRef.current = 0;

        /**
         * The bundler is free to take another build.
         *
         * Whatever was held back while it was busy goes now, and it goes
         * through the provider's own state, so the compile is addressed to
         * the client the bundler actually answered on.
         */
        readyRef.current = true;
        const held = heldRef.current;
        heldRef.current = null;
        if (held && apiRef.current && differs(pushedRef.current, held)) {
          pushProject(apiRef.current, held);
        }
      }
    };

    window.addEventListener("message", onReply);
    return () => window.removeEventListener("message", onReply);
  }, [pushProject]);

  /**
   * The write that never lands is retried.
   *
   * The supported compile path is the provider's own, and it is reliable when
   * the bundler is listening. A write that still produces no reply after the
   * silence below is the one the user reports as "the import is removed but the
   * error is still there", so it is resent, up to three times, and the pane
   * keeps going if the bundler is simply busy.
   */
  const ACK_TIMEOUT = 6000;
  const ACK_RETRIES = 3;

  /**
   * How long an edit may wait for the bundler before the sandbox is started
   * again from the new code.
   *
   * A bundler that drops an update says nothing, so the only way to tell a
   * dropped edit from a slow one is to stop waiting. The clock only runs
   * while the bundler is quiet — a bundler that is compiling says so — so
   * this is the time an edit spends in a silence, not the time it spends
   * being built.
   */
  const RESTART_AFTER = 3000;

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Silence before the first reply is the container booting, not a write
      // that was dropped. Resending into a cold sandbox only delays it.
      if (!bootedRef.current) return;
      // A bundler that is still compiling drops what it is sent, so a resend
      // into a busy one is a resend into nowhere.
      if (!readyRef.current) return;
      const lastHeard = Math.max(lastReplyRef.current, lastSendRef.current);
      if (Date.now() - lastHeard < ACK_TIMEOUT) return;
      if (retryCountRef.current >= ACK_RETRIES) return;
      if (!differs(ackedRef.current, projectFilesRef.current)) return;
      if (!apiRef.current) return;

      retryCountRef.current += 1;
      console.warn("[sandpack] the bundler never answered; resending the project");
      pushProject(apiRef.current, projectFilesRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pushProject]);

  /**
   * The edit that did not land, and the sandbox started again from it.
   *
   * The bundler drops an update that arrives while it is compiling, and it
   * does not say so. The pane cannot tell that from a bundler that has simply
   * not answered yet, so the two are told apart by waiting: an edit that has
   * not been answered for long enough is not going to be, and the honest
   * answer is to build the project again — which is what the author would
   * have done by hand, and the reason nobody should have to.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!bootedRef.current) return;
      if (!differs(ackedRef.current, projectFilesRef.current)) return;
      /**
       * The bundler has been quiet since the write.
       *
       * A bundler that is compiling says so — it sends a status and a state
       * while it works — so silence means the write was dropped rather than
       * that a build is in progress.
       */
      const lastHeard = Math.max(lastReplyRef.current, lastSendRef.current);
      if (Date.now() - lastHeard < RESTART_AFTER) return;

      console.warn("[sandpack] the edit did not reach the preview; building it again");
      onRestart(projectFilesRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onRestart]);

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
    pushProject(api, projectFilesRef.current);
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
    (api: SandpackApi, files: SandpackFiles) => {
      // The project as it stands, handed over by the render that produced it.
      projectFilesRef.current = files;
      apiRef.current = api;
      pendingRef.current = api;

      // Nothing to compile is nothing to schedule.
      if (!differs(pushedRef.current, files)) return;

      /**
       * The bundler is still compiling.
       *
       * The provider sends an update only to a client that has finished its
       * last build, and a client that is busy is skipped without a word. The
       * project is therefore held rather than written, and written when the
       * bundler says it is done — otherwise the edit is dropped and the
       * preview keeps showing the build before it.
       */
      if (!readyRef.current) {
        heldRef.current = files;
        return;
      }

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
      template={SANDBOX_TEMPLATE}
      files={bootFiles}
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

      <SandboxBridge projectFiles={projectFiles} onSync={handleSync} />
    </SandpackProvider>
  );
}
