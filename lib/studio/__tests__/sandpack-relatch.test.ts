// @vitest-environment jsdom
/**
 * The sandbox boots from a latched project, and that latch has to move when the
 * sandbox remounts.
 *
 * Sandpack resets its whole state — files included — whenever the provider's
 * `files` identity changes, so the pane hands it a project latched in a ref and
 * delivers later edits imperatively. A dependency change (or a manual reload)
 * remounts the provider through its `key`, and the boot latch must be re-read on
 * that render: if it still holds the first mount's project, the sandbox reboots
 * from stale files and the first sync sees no diff, so the author's edits are
 * silently lost until they type again.
 *
 * Sandpack itself cannot run in jsdom, so the provider is mocked down to the one
 * observable that matters: the `files` prop it boots with.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const h = vi.hoisted(() => ({
  /** Every render's `files`/`customSetup` props, oldest first. */
  renders: [] as Array<{ files: Record<string, string>; customSetup: unknown }>,
  /** How many times the provider has mounted — i.e. how often it remounted. */
  mounts: 0,
  /** The provider's live file map, as `useSandpack()` would report it. */
  bootFiles: {} as Record<string, string>,
  /** Files written into the sandbox through its supported API. */
  writes: [] as Array<{ path: string; content?: string; deleted?: boolean }>,
}));

vi.mock("@codesandbox/sandpack-react", async () => {
  const react = await import("react");
  return {
    SandpackProvider: (props: {
      files: Record<string, string>;
      customSetup: unknown;
      children: React.ReactNode;
    }) => {
      // Sandpack injects `/package.json` from `customSetup.dependencies` before
      // any client sees the project; a compile without it is rejected.
      h.bootFiles = { ...props.files, "/package.json": '{"name":"sandbox"}' };
      h.renders.push({ files: props.files, customSetup: props.customSetup });
      react.useEffect(() => {
        h.mounts++;
      }, []);
      return react.createElement(react.Fragment, null, props.children);
    },
    SandpackPreview: () => null,
    useSandpack: () => ({
      sandpack: {
        files: h.bootFiles,
        clients: {
          c1: {
            iframeProtocol: {},
            updateSandbox: () => {},
          },
        },
        updateFile: (path: string, content: string) => {
          h.writes.push({ path, content });
        },
        deleteFile: (path: string) => {
          h.writes.push({ path, deleted: true });
        },
      },
    }),
  };
});

import { sandboxPackageVersion } from "@/lib/studio/deps";
import { SandpackPreviewPane } from "@/components/studio/sandpack-preview";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const PAGE = "/app/page.tsx";
const COMPONENT = "/components/hero.tsx";

function project(marker: string) {
  return {
    [PAGE]: `export default function Page() { return <p>${marker}</p>; }`,
    [COMPONENT]: `export function Hero() { return <span>${marker}</span>; }`,
  };
}

/** The project the provider most recently booted with. */
function lastBoot(): Record<string, string> {
  return h.renders.at(-1)!.files;
}

describe("SandpackPreviewPane boot latch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    h.renders.length = 0;
    h.writes.length = 0;
    h.mounts = 0;
    h.bootFiles = {};
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("boots from the current project after a dependency remount, not the first mount", () => {
    const A = project("A");
    // The edited project, and a package the author just imported.
    const B = project("B");
    const deps = ["motion"];

    const render = (files: Record<string, string>, dependencies: string[]) =>
      act(() =>
        root.render(
          React.createElement(SandpackPreviewPane, {
            files,
            compiledCss: ":root{--x:1}",
            dependencies,
            theme: "light",
          })
        )
      );

    // 1. First mount: boots the project as written.
    render(A, []);
    expect(lastBoot()[PAGE]).toContain(">A<");
    expect(h.renders[0].customSetup).toEqual({ dependencies: {} });

    // 2. An edit, no dependency change: the provider is NOT remounted, so it
    //    keeps its original boot project and the edit is delivered imperatively.
    render(B, []);
    expect(lastBoot()[PAGE]).toContain(">A<");
    expect(h.writes.length).toBeGreaterThan(0);
    expect(h.writes.some((write) => write.path === PAGE && write.content?.includes(">B<"))).toBe(true);

    // 3. A new package: the boot key changes and the provider remounts. It must
    //    boot from the CURRENT project (B, plus the new dependency) — the bug was
    //    that it rebooted from A and the pending change was dropped.
    const writesBeforeRemount = h.writes.length;
    render(B, deps);
    expect(lastBoot()[PAGE]).toContain(">B<");
    expect(lastBoot()[COMPONENT]).toContain(">B<");
    expect(h.renders.at(-1)!.customSetup).toEqual({
      dependencies: { motion: sandboxPackageVersion("motion") },
    });

    // Re-latching treats the fresh boot as already current, so the first sync
    // afterwards is a no-op rather than a redundant recompile.
    expect(h.writes.length).toBe(writesBeforeRemount);
  });

  /**
   * The dependency set only grows, so a deleted import is not a remount.
   *
   * The set is derived from the sources, which means it loses a name the moment
   * an author deletes the `import` line that introduced it. Remounting for that
   * reinstalls every package in the project to be rid of one that costs nothing
   * to leave where it is.
   */
  it("keeps the sandbox running when a dependency is dropped", () => {
    const render = (dependencies: string[]) =>
      act(() =>
        root.render(
          React.createElement(SandpackPreviewPane, {
            files: project("A"),
            compiledCss: ":root{--x:1}",
            dependencies,
            theme: "light",
          })
        )
      );

    render(["motion", "lucide-react"]);
    expect(h.mounts).toBe(1);

    // The author deletes the only import of both packages.
    render([]);
    expect(h.mounts).toBe(1);

    // Both are still installed, and the deletion asked the bundler for nothing.
    expect(h.renders.at(-1)!.customSetup).toEqual({
      dependencies: {
        motion: sandboxPackageVersion("motion"),
        "lucide-react": sandboxPackageVersion("lucide-react"),
      },
    });
  });
});
