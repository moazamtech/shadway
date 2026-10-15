"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SandboxSession } from "@codesandbox/sdk";
import { connectToSandbox } from "@codesandbox/sdk/browser";
import { DEFAULT_STYLE_PATH } from "@/lib/studio/starter";
import {
  getLatestPackageVersionFromError,
  missingImportFromLog,
} from "@/lib/studio/sandbox/deps";

/**
 * Connects the studio to the draft's dev server.
 *
 * The preview is always a real Next.js dev server. Two engines can host it:
 * `local` — a `next dev` process on this host, started by the API route, which
 * is the default and needs no third-party token; `codesandbox` — the same
 * project in a VM, used when CSB_API_KEY is configured. While it boots, and if
 * neither engine is available, the caller falls back to the browser-side preview.
 */

// Mirrors lib/studio/sandbox/config.ts — a plain local copy so no env
// module ends up in the client bundle.
const SANDBOX_ROOT = "/project/sandbox";
const DEV_PORT = 3000;
const SHELL_NAME = "shadway install-and-dev";

/** Files the seed owns. A file sync never writes or removes them. */
const SCAFFOLD_PATHS = new Set([
  "/package.json",
  "/next.config.ts",
  "/postcss.config.mjs",
  "/tsconfig.json",
  "/app/layout.tsx",
  "/app/theme-sync.tsx",
]);

/** npm resolves peers more strictly than pnpm — retry without them once. */
const INSTALL_AND_DEV =
  "(npm install --no-audit --no-fund || npm install --no-audit --no-fund --legacy-peer-deps) && npm run dev";

const INSTALL_ONE = (name: string) =>
  `(npm install ${name} --no-audit --no-fund || npm install ${name} --no-audit --no-fund --legacy-peer-deps)`;

export type SandboxStatus =
  | "idle" // no draft to open a dev server for
  | "unavailable" // no engine available — the browser-side preview is used
  | "connecting"
  | "seeding"
  | "installing"
  | "ready"
  | "error";

type SeedFile = { path: string; content: string };

type DevServerStatus = "installing" | "starting" | "ready" | "error" | "stopped";

type ConnectResponse = {
  configured: boolean;
  reason?: string;
  engine?: "local" | "codesandbox";
  sandboxId?: string;
  startData?: unknown;
  isNew?: boolean;
  seedFiles?: SeedFile[];
  stylePrefix?: string;
  /** Local engine only. */
  slug?: string;
  port?: number;
  url?: string;
  status?: DevServerStatus;
  detail?: string | null;
  logs?: string[];
};

/** Structural stand-in for the SDK's (unexported) ShellInstance. */
type SandboxShell = {
  id: string;
  name: string;
  status: string;
  onOutput: (callback: (data: string) => void) => unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useStudioSandbox({ slug }: { slug?: string }) {
  const sandboxRef = useRef<SandboxSession | null>(null);
  const mounted = useRef(false);
  const starting = useRef(false);
  const subscribedShells = useRef<Set<string>>(new Set());
  const handled = useRef<Set<string>>(new Set());
  /** Which engine is behind the preview. */
  const transport = useRef<"local" | "codesandbox" | null>(null);
  /** The last content written for every file the studio owns. */
  const synced = useRef<Record<string, string>>({});
  /** Paths the studio had a moment ago — removals are diffed against this. */
  const clientPaths = useRef<Set<string>>(new Set());
  /** Seed-owned files (package.json, configs) are never removed by a sync. */
  const scaffoldPaths = useRef<Set<string>>(new Set());
  const stylePrefix = useRef("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const [status, setStatus] = useState<SandboxStatus>("idle");
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const appendLog = useCallback((text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);
    if (!lines.length) return;
    setLogs((prev) => [...prev, ...lines].slice(-140));
  }, []);

  const setServerLogs = useCallback((next: string[] | undefined) => {
    if (!next) return;
    setLogs(
      next
        .map((line) => line.trimEnd())
        .filter(Boolean)
        .slice(-140)
    );
  }, []);

  /** Writes project files into the local dev server's workspace. */
  const postLocalFiles = useCallback(
    async (files: Record<string, string>, remove: string[] = []) => {
      if (!slug) return;
      const response = await fetch("/api/studio/sandbox/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, files, remove }),
      });
      if (!response.ok) {
        throw new Error(`Could not sync files (${response.status}).`);
      }
    },
    [slug]
  );

  const writeNow = useCallback(
    async (path: string, content: string) => {
      if (transport.current === "local") {
        // The route prefixes the stylesheet itself.
        await postLocalFiles({ [path]: content });
        synced.current[path] = content;
        return;
      }

      const session = sandboxRef.current;
      if (!session) return;
      // The project stylesheet is written with the Tailwind import and the
      // shared shadcn theme in front, so what lands on disk is complete.
      const final =
        path === DEFAULT_STYLE_PATH ? `${stylePrefix.current}${content}` : content;
      await session.fs.writeTextFile(`${SANDBOX_ROOT}${path}`, final);
      synced.current[path] = content;
    },
    [postLocalFiles]
  );

  const enqueueWrite = useCallback(
    (path: string, content: string) => {
      queue.current = queue.current
        .then(() => writeNow(path, content))
        .catch((error) => console.warn("[studio] Could not write", path, error));
      return queue.current;
    },
    [writeNow]
  );

  const enqueueRemove = useCallback(
    (path: string) => {
      queue.current = queue.current
        .then(async () => {
          if (transport.current === "local") {
            await postLocalFiles({}, [path]);
            return;
          }
          await sandboxRef.current?.fs.remove(`${SANDBOX_ROOT}${path}`);
        })
        .catch(() => {});
      return queue.current;
    },
    [postLocalFiles]
  );

  /** Adds the vendored file behind an unresolved `@/...` import. */
  const restoreVendoredFile = useCallback(
    async (specifier: string) => {
      const key = `file:${specifier}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);

      try {
        const response = await fetch(
          `/api/studio/sandbox/file?specifier=${encodeURIComponent(specifier)}`
        );
        if (!response.ok) return;
        const data = (await response.json()) as { path: string; content: string };
        appendLog(`\n[studio] ${data.path} ships with shadcn/ui — restoring it.`);
        await enqueueWrite(data.path, data.content);
        setReloadKey((value) => value + 1);
      } catch {
        /* the dev server keeps its error overlay up either way */
      }
    },
    [appendLog, enqueueWrite]
  );

  /** Resolves a missing npm package and adds it to the VM mid-session. */
  const installMissingPackage = useCallback(
    async (data: string) => {
      const info = await getLatestPackageVersionFromError(data);
      if (!info) return;

      const key = `pkg:${info.packageName}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);

      const session = sandboxRef.current;
      if (!session) return;

      try {
        appendLog(
          `\n[studio] ${info.packageName} is missing — installing ${info.packageName}@${info.latestVersion}.`
        );
        const packagePath = `${SANDBOX_ROOT}/package.json`;
        const raw = await session.fs.readTextFile(packagePath);
        const parsed = JSON.parse(raw) as { dependencies?: Record<string, string> };
        parsed.dependencies = {
          ...(parsed.dependencies ?? {}),
          [info.packageName]: `^${info.latestVersion}`,
        };
        await session.fs.writeTextFile(packagePath, `${JSON.stringify(parsed, null, 2)}\n`);

        const install = session.shells.run(INSTALL_ONE(info.packageName), {
          shellName: `shadway add ${info.packageName}`,
        });
        await install.catch(() => undefined);
        setReloadKey((value) => value + 1);
      } catch (error) {
        console.warn("[studio] Failed to add missing dependency:", error);
      }
    },
    [appendLog]
  );

  const watchShellOutput = useCallback(
    (data: string) => {
      appendLog(data);
      const specifier = missingImportFromLog(data);
      if (!specifier) return;
      if (specifier.startsWith("@/")) {
        void restoreVendoredFile(specifier);
      } else {
        void installMissingPackage(data);
      }
    },
    [appendLog, restoreVendoredFile, installMissingPackage]
  );

  const watchShell = useCallback(
    (shell: SandboxShell) => {
      if (subscribedShells.current.has(shell.id)) return;
      subscribedShells.current.add(shell.id);
      shell.onOutput(watchShellOutput);
    },
    [watchShellOutput]
  );

  const checkShells = useCallback(async () => {
    const session = sandboxRef.current;
    if (!session) return;

    const shells = await session.shells.getShells().catch(() => []);
    const running = shells.filter(
      (shell) => shell.name === SHELL_NAME && shell.status === "RUNNING"
    );

    for (const shell of running) {
      if (subscribedShells.current.has(shell.id)) continue;
      const opened = await session.shells.open(shell.id).catch(() => null);
      if (opened) watchShell(opened);
    }
  }, [watchShell]);

  /** Wakes or starts the install-and-dev shell and subscribes to it. */
  const ensureDevShell = useCallback(
    async (session: SandboxSession) => {
      const shells = await session.shells.getShells().catch(() => []);
      const running = shells.find(
        (shell) => shell.name === SHELL_NAME && shell.status === "RUNNING"
      );

      if (running) {
        const opened = await session.shells.open(running.id).catch(() => null);
        if (opened) {
          watchShell(opened);
          return;
        }
      }

      // `npm run dev` never exits, so the command is not awaited — the shell
      // poll discovers it the moment it starts running.
      const command = session.shells.run(INSTALL_AND_DEV, { shellName: SHELL_NAME });
      void command.catch(() => {});
    },
    [watchShell]
  );

  /** Writes the full project into a freshly created VM. */
  const seed = useCallback(
    async (session: SandboxSession, files: SeedFile[]) => {
      for (const file of files) {
        if (SCAFFOLD_PATHS.has(file.path)) scaffoldPaths.current.add(file.path);
      }

      const directories = new Set<string>();
      for (const file of files) {
        const cut = file.path.lastIndexOf("/");
        if (cut > 0) directories.add(file.path.slice(0, cut));
      }
      for (const directory of directories) {
        await session.fs.mkdir(`${SANDBOX_ROOT}${directory}`, true).catch(() => {});
      }

      for (const file of files) {
        await enqueueWrite(file.path, file.content);
      }
      await queue.current;
    },
    [enqueueWrite]
  );

  const waitForDevServer = useCallback(async (session: SandboxSession) => {
    let portReady = false;
    try {
      const info = await session.ports.waitForPort(DEV_PORT, { timeoutMs: 300_000 });
      portReady = Boolean(info);
    } catch {
      portReady = false;
    }

    let url: string | null = null;
    try {
      url = session.ports.getPreviewUrl(DEV_PORT) ?? null;
    } catch {
      url = null;
    }

    if (url) {
      setPreviewURL(url);
      setStatus("ready");
      return;
    }

    setStatus("error");
    setDetail(
      portReady
        ? "The preview URL could not be created for the dev server port."
        : "The dev server did not open its port in time — see the log below."
    );
  }, []);

  /** Follows the local dev server while it installs, boots and goes ready. */
  const followLocalDevServer = useCallback(
    async (first: ConnectResponse) => {
      let view: ConnectResponse | null = first;
      const deadline = Date.now() + 25 * 60_000;

      while (mounted.current && Date.now() < deadline) {
        if (!view) break;

        setServerLogs(view.logs);

        if (view.status === "ready" && view.url) {
          setPreviewURL(view.url);
          setStatus("ready");
          setDetail(null);
          return;
        }

        if (view.status === "error") {
          setStatus("error");
          setDetail(view.detail ?? "The dev server failed to start — see the log below.");
          return;
        }

        setStatus(view.status === "installing" ? "installing" : "connecting");

        await sleep(1200);
        if (!mounted.current) return;

        try {
          const response = await fetch(
            `/api/studio/sandbox?slug=${encodeURIComponent(slug ?? "")}`,
            { cache: "no-store" }
          );
          view = response.ok ? ((await response.json()) as ConnectResponse) : null;
        } catch {
          /* keep polling */
        }
      }

      if (mounted.current) {
        setStatus("error");
        setDetail("The dev server did not start in time — see the log below.");
      }
    },
    [setServerLogs, slug]
  );

  const start = useCallback(async () => {
    if (!slug || starting.current) return;
    starting.current = true;

    try {
      setStatus("connecting");
      setDetail(null);

      const response = await fetch("/api/studio/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) throw new Error(`Preview request failed (${response.status}).`);

      const data = (await response.json()) as ConnectResponse;

      if (data.engine === "local") {
        transport.current = "local";
        await followLocalDevServer(data);
        return;
      }

      if (!data.configured || !data.startData) {
        transport.current = null;
        setStatus("unavailable");
        setDetail(data.reason ?? null);
        return;
      }

      transport.current = "codesandbox";
      if (data.stylePrefix) stylePrefix.current = data.stylePrefix;

      const session = await connectToSandbox(
        data.startData as Parameters<typeof connectToSandbox>[0]
      );
      sandboxRef.current = session;

      if (data.isNew && data.seedFiles?.length) {
        setStatus("seeding");
        await seed(session, data.seedFiles);
      }

      setStatus("installing");
      await ensureDevShell(session);
      void checkShells();
      await waitForDevServer(session);
    } catch (error) {
      console.error("[studio] Dev server connect failed:", error);
      setStatus("error");
      setDetail(error instanceof Error ? error.message : "Could not open the dev server.");
    } finally {
      starting.current = false;
    }
  }, [slug, seed, ensureDevShell, checkShells, waitForDevServer, followLocalDevServer]);

  const reconnect = useCallback(() => {
    starting.current = false;
    setPreviewURL(null);
    setDetail(null);
    setLogs([]);
    handled.current.clear();

    if (transport.current === "local") {
      void fetch(`/api/studio/sandbox?slug=${encodeURIComponent(slug ?? "")}`, {
        method: "DELETE",
      })
        .catch(() => undefined)
        .finally(() => {
          transport.current = null;
          void start();
        });
      return;
    }

    sandboxRef.current?.disconnect();
    sandboxRef.current = null;
    subscribedShells.current.clear();
    void start();
  }, [start, slug]);

  /** Mirrors the editor's project into the dev server: writes changed files,
   * deletes removed ones. Called (debounced) by the studio while the user types
   * — `next dev` hot-reloads the preview. */
  const syncFiles = useCallback(
    async (files: Record<string, string>) => {
      const local = transport.current === "local";
      if (!local && !sandboxRef.current) return;

      const next = new Set(Object.keys(files));
      const removals = [...clientPaths.current].filter(
        (path) => !next.has(path) && !scaffoldPaths.current.has(path)
      );
      const changed = Object.entries(files).filter(
        ([path, content]) => synced.current[path] !== content
      );
      clientPaths.current = next;

      if (local) {
        if (!changed.length && !removals.length) return;
        for (const [path] of changed) delete synced.current[path];
        for (const [path, content] of changed) synced.current[path] = content;
        for (const path of removals) delete synced.current[path];
        try {
          await postLocalFiles(Object.fromEntries(changed), removals);
        } catch (error) {
          console.warn("[studio] Could not sync files:", error);
        }
        return;
      }

      for (const path of removals) {
        delete synced.current[path];
        await enqueueRemove(path);
      }

      const writes = changed.map(([path, content]) => enqueueWrite(path, content));
      await Promise.all(writes);
    },
    [enqueueRemove, enqueueWrite, postLocalFiles]
  );

  useEffect(() => {
    if (!slug) return;
    mounted.current = true;
    void start();

    return () => {
      mounted.current = false;
      // StrictMode remounts run right after a cleanup — only tear the
      // session down when this was a real unmount. A local dev server keeps
      // running (it is reaped when idle); a VM hibernates on its own.
      window.setTimeout(() => {
        if (mounted.current) return;
        sandboxRef.current?.disconnect();
        sandboxRef.current = null;
        starting.current = false;
      }, 0);
    };
  }, [slug, start]);

  // A running dev server can be restarted by the VM (e.g. after hibernation)
  // under a new shell id — the poll reattaches to it, like a terminal would.
  useEffect(() => {
    if (!slug) return;
    const interval = window.setInterval(() => {
      void checkShells();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [slug, checkShells]);

  return {
    status,
    previewURL,
    logs,
    detail,
    reloadKey,
    syncFiles,
    reconnect,
  };
}
