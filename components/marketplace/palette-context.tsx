"use client";

import { createContext, useContext } from "react";

/**
 * The palette, opened from anywhere.
 *
 * ⌘K is a shortcut, and a shortcut that only works on one page is a shortcut
 * most people never learn. So the palette is mounted once, by the shell, and
 * the pages that want a search field of their own ask for it by name instead
 * of each keeping a copy of the same open/close state.
 */
type PaletteApi = {
  open: () => void;
  close: () => void;
};

const PaletteContext = createContext<PaletteApi>({
  open: () => {},
  close: () => {},
});

export const PaletteProvider = PaletteContext.Provider;

export function usePalette(): PaletteApi {
  return useContext(PaletteContext);
}
