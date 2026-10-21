"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The shell's header, filled by the page.
 *
 * The shell is in the layout, so it survives a navigation — which is what
 * stops the screen going blank between two pages — and the header it draws
 * is the one the page asked for. A page says what it wants in its header
 * with this, and the shell's own header is the slot it lands in.
 */
export const TOOLBAR_SLOT_ID = "shadway-shell-toolbar";

export function ShellToolbar({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(TOOLBAR_SLOT_ID));
  }, []);

  if (!slot) return null;
  return createPortal(children, slot);
}
