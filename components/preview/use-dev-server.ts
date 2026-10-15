"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Talks to the dev server behind a generated project.
 *
 * The first POST materializes the project and boots `next dev`; every later
 * POST writes the changed files into the same workspace, so the running server
 * hot reloads. While it installs or boots the hook polls for status and the
 * live log tail, which is what the console panel shows.
 */

export type DevServerStatus = "idle" | "installing" | "starting" | "ready" | "error";

export type DevServerProject = {
  files: Record<string, string>;
  page: string;
  style: string;
  dependencies: string[];
};

export type DevServerState = {
  status: DevServerStatus;
  url: string | null;
  logs: string[];
  detail: string | null;
};

type View = {
  status?: unknown;
  url?: unknown;
  logs?: unknown;
  detail?: unknown;
  error?: unknown;
};

const INITIAL: DevServerState = { status: "idle", url: null, logs: [], detail: null };

function toStatus(value: unknown): DevServerStatus {
  if (value === "installing") return "installing";
  if (value === "starting") return "starting";
  if (value === "ready") return "ready";
  if (value === "error") return "error";
  return "idle";
}

export function useDevServer({
  enabled,
  sessionId,
  project,
}: {
  enabled: boolean;
  sessionId: string;
  project: DevServerProject | null;
}) {
  const [state, setState] = useState<DevServerState>(INITIAL);
  const projectRef = useRef(project);
  projectRef.current = project;
  const mounted = useRef(false);
  const signature = project ? JSON.stringify(project) : "";

  const apply = useCallback((view: View | null) => {
    if (!view) return;
    setState({
      status: toStatus(view.status),
      url: typeof view.url === "string" ? view.url : null,
      logs: Array.isArray(view.logs) ? view.logs.map(String).slice(-200) : [],
      detail: typeof view.detail === "string" ? view.detail : null,
    });
  }, []);

  // Create the workspace, or sync the change into the running one.
  useEffect(() => {
    if (!enabled || !projectRef.current) return;
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/preview/devserver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...projectRef.current }),
        });
        const view = (await response.json().catch(() => null)) as View | null;
        if (cancelled) return;

        if (!response.ok) {
          setState((prev) => ({
            ...prev,
            status: "error",
            detail:
              (typeof view?.detail === "string" && view.detail) ||
              (typeof view?.error === "string" && view.error) ||
              `The preview could not be started (${response.status}).`,
          }));
          return;
        }

        apply(view);
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          detail:
            error instanceof Error ? error.message : "Could not reach the dev server.",
        }));
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, sessionId, signature, apply]);

  // Follow it while it installs and boots.
  useEffect(() => {
    if (!enabled) return;
    if (state.status !== "installing" && state.status !== "starting") return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/preview/devserver?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const view = (await response.json()) as View;
        if (!cancelled) apply(view);
      } catch {
        /* keep polling */
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, sessionId, state.status, apply]);

  // Stop the dev server when the preview is really gone. StrictMode remounts
  // run right after a cleanup, so the check happens on the next tick.
  useEffect(() => {
    if (!enabled) return;
    mounted.current = true;

    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        if (mounted.current) return;
        void fetch(`/api/preview/devserver?sessionId=${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => undefined);
      }, 0);
    };
  }, [enabled, sessionId]);

  return state;
}
