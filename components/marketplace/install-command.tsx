"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Terminal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/**
 * The `npx` equivalent for each manager. Yarn has no `dlx`, so it keeps `npx`
 * — the same choice the shadcn CLI docs make.
 */
const RUNNERS: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "npx",
  bun: "bunx --bun",
};

const STORAGE_KEY = "shadway:package-manager";

function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

/**
 * The install line for a component.
 *
 * A terminal is the one surface every developer already reads fluently, so the
 * command is shown the way it will actually be run: dark card, monospace, the
 * runner in full contrast and the rest dimmed. The manager is a remembered
 * preference rather than per-component state — you pick it once.
 */
export function InstallCommand({
  registryUrl,
  className,
  manager: chosen,
  onManagerChange,
}: {
  registryUrl: string;
  className?: string;
  /** The manager to show, when the caller is holding the choice. */
  manager?: PackageManager;
  /** Told when the reader picks a different one. */
  onManagerChange?: (next: PackageManager) => void;
}) {
  const [remembered, setRemembered] = useState<PackageManager>("npm");
  const [copied, setCopied] = useState(false);

  const manager = chosen ?? remembered;

  useEffect(() => {
    let cancelled = false;
    // The remembered manager is read after the first paint rather than
    // during it. The server has no storage to read, so a value taken while
    // the markup is still being produced would leave the browser describing
    // a command the server's markup never contained. The write happens in a
    // callback of its own so the panel is not painted twice for a choice it
    // already shows.
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && isPackageManager(stored)) setRemembered(stored);
      } catch {
        // Storage can be blocked; the default is a fine answer.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runner = RUNNERS[manager];
  const command = `${runner} shadcn@latest add "${registryUrl}"`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  }

  function choose(next: PackageManager) {
    setRemembered(next);
    onManagerChange?.(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — the choice just will not be remembered.
    }
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">Install component</span>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            {manager}
            <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-28">
            {PACKAGE_MANAGERS.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => choose(option)}
                className="justify-between"
              >
                {option}
                {option === manager ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex h-12 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 dark:border-zinc-800 dark:bg-zinc-900">
        <Terminal
          className="h-4 w-4 shrink-0 text-zinc-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] leading-none whitespace-nowrap">
          <span className="text-zinc-100">{runner}</span>{" "}
          <span className="text-zinc-400">shadcn@latest add &quot;{registryUrl}&quot;</span>
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy install command"}
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-zinc-800 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:outline-none active:scale-[0.96]"
        >
          <Copy
            className={cn(
              "absolute h-3.5 w-3.5 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
              copied ? "scale-75 opacity-0" : "scale-100 opacity-100"
            )}
            aria-hidden="true"
          />
          <Check
            className={cn(
              "absolute h-3.5 w-3.5 text-emerald-400 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
              copied ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
