"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/* Sidebar geometry lives in localStorage and is painted before hydration by
   an inline script in the root
   layout, which sets `--sidebar-width` and `data-sidebar-collapsed` on
   <html> — the same pre-paint trick the canvas tint uses. React state here
   drives behavior (aria labels, resize math); the CSS var and attribute are
   the visual source of truth, so a stored width never flashes the default
   on load. Keep the numbers in sync with the script below. */

const COLLAPSED_KEY = "sidebar-collapsed";
const WIDTH_KEY = "sidebar-width";

/** Default expanded width — matches the old `w-64` (16rem). */
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 440;
export const SIDEBAR_SNAP_THRESHOLD = 14;

export function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

/** Magnetic snap: widths near the default lock onto it. */
export function snapSidebarWidth(width: number) {
  const clamped = clampSidebarWidth(width);
  return Math.abs(clamped - SIDEBAR_DEFAULT_WIDTH) <= SIDEBAR_SNAP_THRESHOLD
    ? SIDEBAR_DEFAULT_WIDTH
    : clamped;
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function readWidth() {
  try {
    const parsed = Number(localStorage.getItem(WIDTH_KEY));
    return parsed ? clampSidebarWidth(parsed) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode etc. — the layout still updates for this visit
  }
}

function applyDom(collapsed: boolean, width: number) {
  const el = document.documentElement;
  el.style.setProperty(
    "--sidebar-width",
    `${collapsed ? SIDEBAR_COLLAPSED_WIDTH : width}px`
  );
  el.toggleAttribute("data-sidebar-collapsed", collapsed);
}

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);

  /* Adopt what the pre-paint script already painted. */
  useEffect(() => {
    setCollapsed(readCollapsed());
    setWidth(readWidth());
  }, []);

  /* The drag's window listeners normally leave with the pointer, but a drag
     the browser abandons (or an unmount mid-drag) must not strand them on
     window for the rest of the session. */
  const endDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => endDragRef.current?.(), []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      applyDom(next, width);
      persist(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (collapsed || event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer already gone — window listeners below still track the drag
    }

    const startX = event.clientX;
    const startWidth = width;
    let latest = startWidth;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: PointerEvent) => {
      latest = snapSidebarWidth(startWidth + ev.clientX - startX);
      // The CSS var alone drives layout — a setState here would re-render
      // the whole rail tree on every pointermove and the drag stutters.
      applyDom(false, latest);
    };
    const finish = () => {
      endDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidth(latest);
      setResizing(false);
      persist(WIDTH_KEY, String(latest));
    };
    endDragRef.current?.();
    endDragRef.current = finish;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const onResizeDoubleClick = () => {
    setWidth(SIDEBAR_DEFAULT_WIDTH);
    applyDom(false, SIDEBAR_DEFAULT_WIDTH);
    persist(WIDTH_KEY, String(SIDEBAR_DEFAULT_WIDTH));
  };

  return {
    collapsed,
    width,
    resizing,
    toggleCollapsed,
    onResizePointerDown,
    onResizeDoubleClick,
  };
}

/**
 * Pre-paint script for the root layout. Mirrors `applyDom` above — keep them
 * in step. Serialized as a plain string (never a function body: the bundler
 * rewrites those, see the note in lib/tint.ts).
 */
export const SIDEBAR_SCRIPT = `(function(){try{
var c=localStorage.getItem(${JSON.stringify(COLLAPSED_KEY)})==="1";
var w=Math.min(${SIDEBAR_MAX_WIDTH},Math.max(${SIDEBAR_MIN_WIDTH},+localStorage.getItem(${JSON.stringify(WIDTH_KEY)})||${SIDEBAR_DEFAULT_WIDTH}));
var el=document.documentElement;
el.style.setProperty("--sidebar-width",(c?${SIDEBAR_COLLAPSED_WIDTH}:w)+"px");
el.toggleAttribute("data-sidebar-collapsed",c);
}catch(e){}})();`;
