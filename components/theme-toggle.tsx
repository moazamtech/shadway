"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";

/**
 * Whether the browser has taken over from the server.
 *
 * The server has no theme to read, so the button it paints is the placeholder
 * one — the sun, disabled. Answering the question from a store keeps that
 * answer honest: false while the server renders, true as soon as the browser
 * takes over, with no second pass over the tree to say so.
 */
const subscribeToNothing = () => () => {};
const browserHasRendered = () => true;
const serverHasRendered = () => false;

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeToNothing,
    browserHasRendered,
    serverHasRendered,
  );
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const toggleTheme = React.useCallback(async () => {
    if (!buttonRef.current || !mounted) return;

    const newTheme = resolvedTheme === "dark" ? "light" : "dark";

    const startViewTransition = (
      document as unknown as {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> };
      }
    ).startViewTransition;

    if (!startViewTransition) {
      setTheme(newTheme);
      return;
    }

    try {
      const transition = startViewTransition(() => {
        flushSync(() => setTheme(newTheme));
      });

      await transition.ready;

      const { top, left, width, height } =
        buttonRef.current.getBoundingClientRect();
      const x = left + width / 2;
      const y = top + height / 2;
      const maxRadius = Math.hypot(
        Math.max(left, window.innerWidth - left),
        Math.max(top, window.innerHeight - top),
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 500,
          easing: "ease-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    } catch {
      setTheme(newTheme);
    }
  }, [resolvedTheme, mounted, setTheme]);

  if (!mounted) {
    return (
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        disabled
      >
        <Sun className="h-5 w-5" />
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
