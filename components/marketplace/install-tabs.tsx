"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallCommand } from "@/components/marketplace/install-command";
import {
  BoltMark,
  BunMark,
  LovableMark,
  NpmMark,
  PnpmMark,
  V0Mark,
} from "@/components/marketplace/brand-marks";
import { useOrigin } from "@/hooks/use-origin";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  dependencies: string[];
  registryDependencies: string[];
};

type Tab = "npm" | "pnpm" | "bun" | "v0" | "lovable" | "bolt";

const TABS: { id: Tab; label: string; mark: React.ComponentType<{ className?: string }> }[] = [
  { id: "npm", label: "npm", mark: NpmMark },
  { id: "pnpm", label: "pnpm", mark: PnpmMark },
  { id: "bun", label: "bun", mark: BunMark },
  { id: "v0", label: "v0", mark: V0Mark },
  { id: "lovable", label: "Lovable", mark: LovableMark },
  { id: "bolt", label: "Bolt", mark: BoltMark },
];

/** The tabs that install the component themselves, rather than prompting for it. */
const CLI_TABS = new Set<Tab>(["npm", "pnpm", "bun"]);

/** The prompt each AI tool needs to pull the component in by itself. */
const PROMPTS: Record<"v0" | "lovable" | "bolt", { title: string; description: string; body: (url: string) => string }> = {
  v0: {
    title: "Open in v0",
    description: "Paste this into v0 and it drops the component straight into your project.",
    body: (url) =>
      `Add this shadcn component to my project:\n\n${url}\n\nInstall it with the shadcn CLI and place it where I need it. Keep my existing design tokens.`,
  },
  lovable: {
    title: "Open in Lovable",
    description: "Lovable reads the registry and installs the component for you.",
    body: (url) =>
      `Add the component from ${url} to this project using the shadcn registry. Install any required dependencies and reuse the existing theme.`,
  },
  bolt: {
    title: "Open in Bolt",
    description: "An agent-ready prompt for Bolt.new.",
    body: (url) =>
      `Install the shadcn component at ${url} and integrate it into the current app.`,
  },
};

/**
 * Install surface for a published component.
 *
 * The one-line command leads, because that is what almost everyone copies; the
 * registry URL, the raw source and the AI-tool prompts are one tab away for the
 * people who need them.
 */
export function InstallTabs({ slug, dependencies, registryDependencies }: Props) {
  const [tab, setTab] = useState<Tab>("npm");
  const [manager, setManager] = useState<"npm" | "pnpm" | "bun">("npm");
  const [copied, setCopied] = useState<string | null>(null);

  const siteOrigin = useOrigin();
  const registryUrl = `${siteOrigin}/r/${slug}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {}
  }

  const prompt =
    tab === "v0" || tab === "lovable" || tab === "bolt" ? PROMPTS[tab] : null;

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
        {TABS.map((item) => {
          const Mark = item.mark;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => {
                setTab(item.id);
                if (CLI_TABS.has(item.id)) setManager(item.id as "npm" | "pnpm" | "bun");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tab === item.id
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mark className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {CLI_TABS.has(tab) ? (
        <div className="space-y-4">
          <InstallCommand
            registryUrl={registryUrl}
            manager={manager}
            onManagerChange={(next) => setManager(next as "npm" | "pnpm" | "bun")}
          />

          <CopyRow
            label="Registry URL"
            value={registryUrl}
            onCopy={() => copy(registryUrl, "url")}
            copied={copied === "url"}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" asChild>
              <a href={`/api/components/download/${slug}`} download>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download source
              </a>
            </Button>
          </div>

          <InstallNotes
            dependencies={dependencies}
            registryDependencies={registryDependencies}
          />
        </div>
      ) : null}

      {prompt ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">{prompt.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{prompt.description}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3.5">
            <pre className="font-mono text-xs leading-5 whitespace-pre-wrap">
              {prompt.body(registryUrl)}
            </pre>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-xs"
            onClick={() => copy(prompt.body(registryUrl), tab)}
          >
            {copied === tab ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied === tab ? "Copied" : "Copy prompt"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CopyRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 pr-1 pl-3">
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">
          {value}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? "Copied" : `Copy ${label}`}
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96]"
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
              "absolute h-3.5 w-3.5 text-emerald-500 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
              copied ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

function InstallNotes({
  dependencies,
  registryDependencies,
}: {
  dependencies: string[];
  registryDependencies: string[];
}) {
  return (
    <div className="grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
      <div>
        <h4 className="mb-2 text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
          npm dependencies
        </h4>
        {dependencies.length ? (
          <ul className="space-y-1 text-xs">
            {dependencies.map((dep) => (
              <li key={dep}>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{dep}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
          registry dependencies
        </h4>
        {registryDependencies.length ? (
          <ul className="space-y-1 text-xs">
            {registryDependencies.map((dep) => (
              <li key={dep}>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{dep}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>
    </div>
  );
}
