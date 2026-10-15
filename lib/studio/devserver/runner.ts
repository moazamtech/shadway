import { spawn, type ChildProcess } from "child_process";
import fs from "fs/promises";
import net from "net";
import path from "path";

import type { SandboxDraft } from "@/lib/studio/sandbox/project";
import { workspaceDir, workspaceRoot, writeProject, writeProjectFiles } from "./workspace";

/**
 * Runs a project on a real Next.js dev server, on this host.
 *
 * The preview iframe points straight at that server, so what the author sees is
 * the actual application — real App Router, real HMR, real error overlay, real
 * console output. `next dev --turbopack` boots in a couple of seconds when the
 * dependencies are already there, so every workspace shares one installed
 * dependency tree (linked in as `node_modules`); a project only pays for the
 * packages the shared tree does not have yet.
 *
 * Processes live across requests (the registry sits on `globalThis` so a
 * dev-server reload does not orphan them) and are reaped once idle.
 */

export type LocalDevServerStatus = "installing" | "starting" | "ready" | "error";

export type LocalDevServerView = {
  engine: "local";
  slug: string;
  port: number;
  url: string;
  status: LocalDevServerStatus;
  detail: string | null;
  logs: string[];
};

type LocalDevServer = {
  slug: string;
  dir: string;
  port: number;
  url: string;
  status: LocalDevServerStatus;
  detail: string | null;
  logs: string[];
  child: ChildProcess | null;
  lastUsed: number;
};

type Registry = Map<string, LocalDevServer>;

const runtime = globalThis as unknown as { __shadwayDevServers?: Registry };
const servers: Registry = (runtime.__shadwayDevServers ??= new Map());

const FIRST_PORT = 3311;
const PORT_SPAN = 160;
const MAX_LOG_LINES = 240;
const IDLE_MS = 30 * 60 * 1000;
const INSTALL_TIMEOUT_MS = 20 * 60 * 1000;
const BOOT_TIMEOUT_MS = 5 * 60 * 1000;

/** The shared dependency tree every workspace links as its `node_modules`. */
const SHARED_PACKAGE_JSON = {
  name: "shadway-preview-deps",
  private: true,
  version: "0.0.0",
  dependencies: {
    next: "^15.5.15",
    react: "^19.1.2",
    "react-dom": "^19.1.2",
    tailwindcss: "^4",
    "@tailwindcss/postcss": "^4",
    typescript: "^5",
    // Present up front: without them `next dev` tries to install its own
    // TypeScript dependencies, which cannot work through a linked tree.
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
  },
};

/** True when this host is allowed to run local dev servers. */
export function isLocalDevServerEnabled(): boolean {
  return (process.env.SHADWAY_LOCAL_DEV_SERVER ?? "").toLowerCase() !== "off";
}

function toView(server: LocalDevServer): LocalDevServerView {
  return {
    engine: "local",
    slug: server.slug,
    port: server.port,
    url: server.url,
    status: server.status,
    detail: server.detail,
    logs: server.logs.slice(-90),
  };
}

function log(server: LocalDevServer, chunk: unknown): void {
  const text = String(chunk ?? "");
  if (!text.trim()) return;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (!lines.length) return;
  server.logs = [...server.logs, ...lines].slice(-MAX_LOG_LINES);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function canBind(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, host);
  });
}

/**
 * A port is only free when it is free on both loopbacks — a server listening on
 * `[::1]` leaves `127.0.0.1` apparently open, and `next dev` binds `::`.
 */
async function isFree(port: number): Promise<boolean> {
  if (!(await canBind(port, "127.0.0.1"))) return false;
  if (!(await canBind(port, "::1"))) return false;
  return true;
}

async function allocatePort(skip?: Iterable<number>): Promise<number> {
  const taken = new Set([...servers.values()].map((server) => server.port));
  for (const port of skip ?? []) taken.add(port);

  for (let offset = 0; offset < PORT_SPAN; offset += 1) {
    const port = FIRST_PORT + offset;
    if (taken.has(port)) continue;
    if (await isFree(port)) return port;
  }
  throw new Error("No free port is available for the dev server.");
}

/**
 * The environment a child process gets. The app's own dev server may run
 * Turbopack, which sets `TURBOPACK` — a preview workspace must not inherit
 * that, because Turbopack refuses the linked dependency tree it boots from.
 */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  delete env.TURBOPACK;
  delete env.IS_TURBOPACK_TEST;
  return env;
}

function nextBinary(dir: string): string {
  const name = process.platform === "win32" ? "next.cmd" : "next";
  return path.join(dir, "node_modules", ".bin", name);
}

async function hasNext(dir: string): Promise<boolean> {
  return exists(path.join(dir, "node_modules", "next", "package.json"));
}

/** Runs a command to completion, streaming its output into the server log. */
function run(
  server: LocalDevServer,
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      env: childEnv(),
    });

    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code);
    };

    const timer = setTimeout(() => {
      log(server, `[shadway] \`${command} ${args.join(" ")}\` timed out.`);
      child.kill();
      finish(1);
    }, timeoutMs);

    child.stdout?.on("data", (data) => log(server, data));
    child.stderr?.on("data", (data) => log(server, data));
    child.on("error", (error) => {
      log(server, `[shadway] ${error.message}`);
      finish(1);
    });
    child.on("exit", (code) => finish(code ?? 0));
  });
}

function sharedDepsDir(): string {
  return path.join(workspaceRoot(), "_deps");
}

/**
 * Installs the dependency tree once, then links it into every workspace. The
 * first project pays for the install; the rest start in seconds.
 */
async function ensureSharedModules(server: LocalDevServer): Promise<void> {
  const depsDir = sharedDepsDir();
  const modules = path.join(depsDir, "node_modules");
  const link = path.join(server.dir, "node_modules");

  if (!(await hasNext(depsDir))) {
    log(server, "[shadway] Installing dependencies (first run only)…");
    await fs.mkdir(depsDir, { recursive: true });
    await fs.writeFile(
      path.join(depsDir, "package.json"),
      `${JSON.stringify(SHARED_PACKAGE_JSON, null, 2)}\n`,
      "utf8"
    );

    let code = await run(
      server,
      depsDir,
      "npm",
      ["install", "--no-audit", "--no-fund"],
      INSTALL_TIMEOUT_MS
    );
    if (code !== 0) {
      log(server, "[shadway] Retrying the install without strict peer checks…");
      code = await run(
        server,
        depsDir,
        "npm",
        ["install", "--no-audit", "--no-fund", "--legacy-peer-deps"],
        INSTALL_TIMEOUT_MS
      );
    }

    if (!(await hasNext(depsDir))) {
      throw new Error("npm install did not finish — see the log above.");
    }
  }

  if (!(await exists(link))) {
    try {
      await fs.symlink(modules, link, "junction");
    } catch {
      await fs.symlink(modules, link, "dir");
    }
  }
}

/** Tops up the shared tree with the packages this project imports. */
async function installMissingPackages(server: LocalDevServer): Promise<void> {
  let parsed: { dependencies?: Record<string, string> };
  try {
    parsed = JSON.parse(
      await fs.readFile(path.join(server.dir, "package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
  } catch {
    return;
  }

  const dependencies = parsed.dependencies ?? {};
  const modules = path.join(sharedDepsDir(), "node_modules");
  const missing: string[] = [];

  for (const [name, range] of Object.entries(dependencies)) {
    if (name === "next" || name === "react" || name === "react-dom") continue;
    if (!(await exists(path.join(modules, name, "package.json")))) {
      missing.push(`${name}@${range}`);
    }
  }

  if (!missing.length) return;

  log(server, `[shadway] Adding ${missing.join(", ")}…`);
  const code = await run(
    server,
    sharedDepsDir(),
    "npm",
    ["install", ...missing, "--no-audit", "--no-fund"],
    INSTALL_TIMEOUT_MS
  );
  if (code !== 0) {
    log(server, "[shadway] Some packages may not have installed — see the log above.");
  }
}

/** A dev server is up the moment it answers an HTTP request. */
async function probe(port: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "text/html" },
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** What the boot watches for while the server comes up. */
type BootSignals = { banner: boolean; exited: boolean; bindClash: boolean };

/**
 * Waits for the dev server to announce itself.
 *
 * Probing a port by binding it is not trustworthy here: Node sets
 * `SO_REUSEADDR`, and on Windows that lets the probe bind *next to* a server
 * that already owns the port. The child's own output is the honest signal, so
 * the boot waits for the "Ready" banner and treats a bind clash as a failure.
 */
async function waitForReady(
  server: LocalDevServer,
  signals: BootSignals
): Promise<"ready" | "bind" | "exited" | "timeout"> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (signals.bindClash) return "bind";
    if (signals.exited) return "exited";

    if (signals.banner) {
      if (await probe(server.port)) return "ready";
      if (signals.bindClash) return "bind";
      if (signals.exited) return "exited";
    }

    await sleep(500);
  }

  if (signals.bindClash) return "bind";
  if (signals.exited) return "exited";
  return (await probe(server.port)) ? "ready" : "timeout";
}

/**
 * Boots the project. The port is claimed *after* the install — an install can
 * take minutes, and a port that was free at the start is often not free by the
 * time the server is ready to bind. A bind clash is retried on a fresh port.
 */
async function boot(server: LocalDevServer): Promise<void> {
  try {
    if (!(await hasNext(server.dir))) {
      server.status = "installing";
      await ensureSharedModules(server);
      await installMissingPackages(server);
    }

    const tried = new Set<number>();
    let hardFailures = 0;
    let lastFailure = "The dev server never started listening.";

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const port = await allocatePort(tried);
      tried.add(port);
      server.port = port;
      server.url = `http://localhost:${port}`;
      server.status = "starting";
      log(server, `[shadway] Starting next dev on port ${port}…`);

      // Webpack, not Turbopack: Turbopack rejects a `node_modules` that is
      // linked out of the project ("points out of the filesystem root"), and
      // that link is what makes a new workspace start in seconds.
      const child = spawn(`"${nextBinary(server.dir)}" dev -p ${port}`, {
        cwd: server.dir,
        shell: true,
        windowsHide: true,
        env: childEnv(),
      });

      server.child = child;
      const signals: BootSignals = { banner: false, exited: false, bindClash: false };

      const onOutput = (data: unknown) => {
        const text = String(data ?? "");
        if (/EADDRINUSE|address already in use/i.test(text)) signals.bindClash = true;
        if (/Ready in \d/i.test(text) || /\bLocal:\s+https?:\/\//i.test(text)) {
          signals.banner = true;
        }
        log(server, text);
      };

      child.stdout?.on("data", onOutput);
      child.stderr?.on("data", onOutput);
      child.on("error", (error) => {
        signals.exited = true;
        log(server, `[shadway] ${error.message}`);
      });
      child.on("exit", (code) => {
        signals.exited = true;
        // A server that was already serving and then died is a real failure.
        if (server.status === "ready") {
          server.status = "error";
          server.detail = `The dev server exited (code ${code ?? 0}).`;
          log(server, `[shadway] ${server.detail}`);
        }
      });

      const outcome = await waitForReady(server, signals);

      if (outcome === "ready" && !signals.exited) {
        server.status = "ready";
        server.detail = null;
        log(server, `[shadway] Dev server ready → ${server.url}`);
        return;
      }

      server.child = null;
      await kill(child);

      if (outcome === "bind") {
        log(server, `[shadway] Port ${port} is taken — trying the next one.`);
        continue;
      }

      hardFailures += 1;
      lastFailure =
        outcome === "exited"
          ? `The dev server exited (code ${child.exitCode ?? 0}).`
          : "The dev server never started listening.";
      log(server, `[shadway] ${lastFailure}`);
      if (hardFailures >= 2) throw new Error(lastFailure);
    }

    throw new Error(lastFailure);
  } catch (error) {
    server.status = "error";
    server.detail = error instanceof Error ? error.message : String(error);
    log(server, `[shadway] ${server.detail}`);
  }
}

async function kill(child: ChildProcess): Promise<void> {
  if (!child || child.killed || child.exitCode !== null) return;

  if (process.platform === "win32" && child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }

  child.kill("SIGTERM");
}

async function stopChild(server: LocalDevServer): Promise<void> {
  const child = server.child;
  server.child = null;
  if (child) await kill(child);
}

/** Removes a workspace — the linked dependency tree is unlinked, never deleted. */
async function removeWorkspace(dir: string): Promise<void> {
  await fs.unlink(path.join(dir, "node_modules")).catch(() => undefined);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

/** Kills dev servers nobody has touched for a while. */
function reapIdle(): void {
  const now = Date.now();
  for (const [slug, server] of servers) {
    if (now - server.lastUsed < IDLE_MS) continue;
    void stopChild(server);
    servers.delete(slug);
    void removeWorkspace(server.dir);
  }
}

/** Starts the draft's dev server, or returns the one already running. */
export async function ensureDevServer(
  slug: string,
  draft: SandboxDraft
): Promise<LocalDevServerView> {
  reapIdle();

  const existing = servers.get(slug);
  if (existing) {
    existing.lastUsed = Date.now();
    return toView(existing);
  }

  const dir = await writeProject(slug, draft);

  const server: LocalDevServer = {
    slug,
    dir,
    port: 0,
    url: "",
    status: "installing",
    detail: null,
    logs: [],
    child: null,
    lastUsed: Date.now(),
  };

  servers.set(slug, server);
  void boot(server);

  return toView(server);
}

export function getDevServer(slug: string): LocalDevServerView | null {
  reapIdle();
  const server = servers.get(slug);
  if (!server) return null;
  server.lastUsed = Date.now();
  return toView(server);
}

/** Mirrors an editor change into the running project — the dev server reloads. */
export async function syncDevServerFiles(
  slug: string,
  files: Record<string, string>,
  remove: string[]
): Promise<boolean> {
  const server = servers.get(slug);
  if (!server) return false;
  server.lastUsed = Date.now();
  await writeProjectFiles(slug, files, remove);

  // A file that imports a package the shared tree lacks (the editor just added
  // one) is topped up in the background; the dev server picks it up after.
  if (!(await hasNext(server.dir))) {
    await ensureSharedModules(server).catch(() => undefined);
  }
  void installMissingPackages(server);

  return true;
}

export async function stopDevServer(slug: string): Promise<boolean> {
  const server = servers.get(slug);
  if (!server) return false;
  servers.delete(slug);
  await stopChild(server);
  await removeWorkspace(server.dir);
  return true;
}

export function devServerWorkspace(slug: string): string {
  return workspaceDir(slug);
}
