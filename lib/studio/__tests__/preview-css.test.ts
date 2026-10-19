// @vitest-environment jsdom
/**
 * The hook holds the project's compiled stylesheet, and what it does when a
 * compile *fails* is the whole point of these tests.
 *
 * Sandpack builds the JavaScript in the browser, but Tailwind v4 has to read the
 * project's own `globals.css` from the server. So a component's styling depends
 * on a request this hook makes — and that request can fail: an `@apply` of a
 * utility that does not exist, a malformed `@theme`, a stylesheet emptied
 * mid-edit. It used to fail like this:
 *
 *   - the last good stylesheet was cleared, so the preview lost *all* its CSS
 *     and looked catastrophically broken rather than one class short;
 *   - neither caller read the returned `error`, so nothing on screen explained
 *     any of it;
 *   - and because only the last *successful* project was remembered, the next
 *     render looked like work that had never been tried — so the hook asked
 *     again, on every render, for as long as the error was on screen.
 *
 * A project that cannot compile is the easiest state to get stuck in, and each
 * of those three turned a stuck author into a stuck *site*: a request storm
 * against the compile endpoint, a preview nobody could reason about, and no
 * message anywhere.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { usePreviewCss } from "@/lib/studio/use-preview-css";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

type Result = ReturnType<typeof usePreviewCss>;

/**
 * Probe state is held in a hoisted *object*, not in module-level bindings.
 *
 * Assigning to a module-scope `let` from inside a component trips the React
 * Compiler's `react-hooks/globals` rule, and it is right to: the compiler cannot
 * see that the write is only a channel back to the test, and a refactor that
 * genuinely wrote module state from a render would be a real bug. The existing
 * `sandpack-relatch` test keeps its recorder the same way.
 */
const h = vi.hoisted(() => ({
  /** The value the hook reported on its most recent render. */
  latest: null as { css: string | null; error: string | null; ready: boolean } | null,
  /** How many compile requests the hook has made. */
  calls: 0,
  /**
   * What the compile endpoint returns, per request.
   *
   * A queue rather than a switch, because the *count* of requests is the
   * behaviour under test: the old bug was not that the request failed, it was
   * that the hook could not tell it had already failed and kept asking.
   */
  replies: [] as Array<{ ok: boolean; body: unknown }>,
}));

const css = (marker: string) => `.probe-${marker}{color:red}`;

const PROJECT = (marker: string) => ({
  "/app/globals.css": `@import "tailwindcss"; /* ${marker} */`,
  "/app/page.tsx": `export default function Page(){ return <p>${marker}</p> }`,
});

const GOOD = { ok: true, body: { css: css("compiled"), vendored: [] } };
const BAD = { ok: false, body: { error: "Stylesheet compile failed (500)" } };

/**
 * The probes are declared once, at module scope, on purpose.
 *
 * `React.createElement(function Probe() { ... })` builds a *new component type*
 * on every call, and React tears the old one down and mounts the new one when it
 * sees the type change — which resets every `useState` and `useRef` in the hook.
 * That silently restarts the test rather than failing it: each "re-render" is
 * really a first mount, and any behaviour keyed on a ref looks like it is being
 * recreated rather than being reused.
 */
function Probe({ files, style }: { files: Record<string, string>; style: string | undefined }) {
  h.latest = usePreviewCss(files, style, { delay: 0 });
  return null;
}

function Seeded({
  files,
  style,
  initialCss,
}: {
  files: Record<string, string>;
  style: string | undefined;
  initialCss: string;
}) {
  h.latest = usePreviewCss(files, style, { initialCss, delay: 0 });
  return null;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  h.latest = null;
  h.calls = 0;
  h.replies = [GOOD];

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const reply = h.replies[Math.min(h.calls, h.replies.length - 1)] ?? GOOD;
      h.calls += 1;
      return {
        ok: reply.ok,
        status: reply.ok ? 200 : 500,
        json: async () => reply.body,
      };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePreviewCss", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  /** Render, then let the debounce fire and the request settle. */
  async function render(props: {
    files: Record<string, string>;
    style?: string;
    initialCss?: string;
  }) {
    const element =
      props.initialCss === undefined
        ? React.createElement(Probe, { files: props.files, style: props.style })
        : React.createElement(Seeded, {
            files: props.files,
            style: props.style,
            initialCss: props.initialCss,
          });

    await act(async () => {
      root.render(element);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }

  it("reports the compiled stylesheet for the project it was given", async () => {
    const files = PROJECT("A");
    await render({ files, style: files["/app/globals.css"] });

    expect(h.latest!.css).toBe(css("compiled"));
    expect(h.latest!.error).toBeNull();
    expect(h.latest!.ready).toBe(true);
    expect(h.calls).toBe(1);
  });

  /**
   * The regression this file exists for.
   *
   * A stylesheet one edit behind is nearly free — the preview keeps its layout
   * and colour, and the only thing missing is the class just typed. An empty
   * one takes all of it away, and makes the sandbox look like the *engine*
   * failed rather than the stylesheet.
   */
  it("keeps the last compiling stylesheet when a compile fails", async () => {
    const good = PROJECT("A");
    await render({ files: good, style: good["/app/globals.css"] });
    expect(h.latest!.css).toBe(css("compiled"));

    h.replies = [GOOD, BAD];
    const broken = { "/app/globals.css": `@apply not-a-real-class;` };
    await render({ files: broken, style: broken["/app/globals.css"] });

    expect(h.latest!.error).toContain("500");
    expect(h.latest!.css).toBe(css("compiled"));
  });

  it("clears the error once the project compiles again", async () => {
    const good = PROJECT("A");
    await render({ files: good, style: good["/app/globals.css"] });

    h.replies = [GOOD, BAD, GOOD];
    const broken = { "/app/globals.css": `@apply nope;` };
    await render({ files: broken, style: broken["/app/globals.css"] });
    expect(h.latest!.error).toBeTruthy();

    const fixed = PROJECT("B");
    await render({ files: fixed, style: fixed["/app/globals.css"] });
    expect(h.latest!.error).toBeNull();
    expect(h.latest!.css).toBe(css("compiled"));
  });

  /**
   * The storm.
   *
   * Only the last *successful* project was remembered, so a project that cannot
   * compile looked permanently un-compiled and the effect fired again on every
   * render — and callers rebuild their file map each render, so "every render"
   * meant a request per keystroke, indefinitely, against a project the author
   * could not fix without noticing the first error.
   */
  it("asks once for a project that failed, however often it re-renders", async () => {
    h.replies = [BAD];
    const broken = { "/app/globals.css": `@apply nope;` };

    await render({ files: broken, style: broken["/app/globals.css"] });
    expect(h.calls).toBe(1);

    // Re-renders with a *new object of identical content* — what every caller
    // does, because they rebuild the map inline.
    for (let i = 0; i < 5; i++) {
      await render({ files: { ...broken }, style: broken["/app/globals.css"] });
    }

    expect(h.calls).toBe(1);
    expect(h.latest!.error).toBeTruthy();
  });

  /** Only a change to the project can fix it, so only a change retries it. */
  it("retries after the project changes", async () => {
    h.replies = [BAD];
    const broken = { "/app/globals.css": `@apply nope;` };
    await render({ files: broken, style: broken["/app/globals.css"] });
    expect(h.calls).toBe(1);

    const fixed = PROJECT("B");
    await render({ files: fixed, style: fixed["/app/globals.css"] });
    expect(h.calls).toBe(2);
  });

  /**
   * The stylesheet the caller arrived with is already correct for the project
   * it is handing over, so it must not be thrown away and recompiled — that
   * would boot the sandbox unstyled and patch it afterwards.
   */
  it("trusts a stylesheet the caller says matches these files", async () => {
    const files = PROJECT("A");
    await render({
      files,
      style: files["/app/globals.css"],
      initialCss: css("seeded"),
    });

    expect(h.latest!.css).toBe(css("seeded"));
    expect(h.calls).toBe(0);
  });

  /**
   * A first compile that fails has nothing to fall back on, so the preview is
   * allowed to be unstyled — but it must not claim to be ready, or the sandbox
   * boots before it has anything to style with.
   */
  it("is not ready when the very first compile fails", async () => {
    h.replies = [BAD];
    await render({ files: { "/app/globals.css": `@apply nope;` }, style: `@apply nope;` });

    expect(h.latest!.error).toBeTruthy();
    expect(h.latest!.css).toBeNull();
    expect(h.latest!.ready).toBe(false);
  });
});