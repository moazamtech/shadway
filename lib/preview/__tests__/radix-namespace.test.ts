// @vitest-environment jsdom
/**
 * The vendored components have to *render*, not merely type-check and bundle.
 *
 * The split of the `radix-ui` barrel is a source rewrite, and the one thing it
 * must preserve is what each statement binds: the barrel exports
 * `@radix-ui/react-dialog` as a namespace, so a shadcn source writes
 * `DialogPrimitive.Root`. Binding that package's `Dialog` *component* instead
 * — which is an alias of `Root` — type-checks, bundles, and leaves every
 * `.Root`, `.Provider` and `.Trigger` in the source `undefined`. React then
 * fails at render with "element type is invalid", which no build ever sees.
 *
 * These mount the real vendored sources, straight off disk and through the
 * real dependencies, and assert they produced an element.
 */
import { describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Button } from "@/lib/preview/template/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/lib/preview/template/ui/dialog";
import { Label } from "@/lib/preview/template/ui/label";
import { Select, SelectTrigger, SelectValue } from "@/lib/preview/template/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/lib/preview/template/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/lib/preview/template/ui/tooltip";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** jsdom lacks the observers and media queries Radix reaches for on mount. */
function polyfill(): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  if (!globalThis.matchMedia) {
    Object.defineProperty(globalThis, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (!globalThis.PointerEvent) {
    // Radix's dismissable layers listen for pointer events.
    globalThis.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
  }
}

/** Renders an element and returns its container, after effects have run. */
function render(element: React.ReactElement): { container: HTMLDivElement; root: Root } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return { container, root };
}

polyfill();

describe("the vendored components render", () => {
  it("mounts a label, whose parts arrive through the namespace", () => {
    const { container } = render(React.createElement(Label, null, "Name"));

    // `LabelPrimitive.Root` is the whole component: without the namespace
    // binding there is nothing to render.
    expect(container.querySelector("label")?.textContent).toBe("Name");
  });

  it("mounts a button that clones its child, through Slot.Root", () => {
    const { container } = render(
      React.createElement(Button, { asChild: true }, React.createElement("a", { href: "/x" }, "Go"))
    );

    const anchor = container.querySelector("a");
    expect(anchor?.textContent).toBe("Go");
    // `asChild` is the branch that reaches for `Slot.Root`.
    expect(container.querySelector("button")).toBeNull();
  });

  it("mounts a dialog trigger, through DialogPrimitive.Root and Trigger", () => {
    const { container } = render(
      React.createElement(
        Dialog,
        null,
        React.createElement(DialogTrigger, null, "Open"),
        React.createElement(
          DialogContent,
          null,
          React.createElement(DialogTitle, null, "Title")
        )
      )
    );

    expect(container.querySelector("button")?.textContent).toBe("Open");
  });

  it("mounts a select trigger, through SelectPrimitive.Root and Trigger", () => {
    const { container } = render(
      React.createElement(
        Select,
        null,
        React.createElement(
          SelectTrigger,
          null,
          React.createElement(SelectValue, { placeholder: "Pick" })
        )
      )
    );

    expect(container.querySelector('button[role="combobox"]')).not.toBeNull();
  });

  it("mounts tabs, through TabsPrimitive.Root and TabsPrimitive.List", () => {
    const { container } = render(
      React.createElement(
        Tabs,
        { defaultValue: "one" },
        React.createElement(
          TabsList,
          null,
          React.createElement(TabsTrigger, { value: "one" }, "One")
        )
      )
    );

    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(container.querySelector('[role="tab"]')?.textContent).toBe("One");
  });

  it("mounts a tooltip trigger, through TooltipPrimitive.Provider", () => {
    const { container } = render(
      React.createElement(
        TooltipProvider,
        null,
        React.createElement(
          Tooltip,
          null,
          React.createElement(TooltipTrigger, null, "Hover"),
          React.createElement(TooltipContent, null, "Tip")
        )
      )
    );

    // The provider is its own namespace member, and the trigger renders inside it.
    expect(container.querySelector("button")?.textContent).toBe("Hover");
  });
});
