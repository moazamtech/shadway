"use client";

import { useState } from "react";
import { Check, Copy, Download, Terminal, Sparkles, Zap, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  slug: string;
  dependencies: string[];
  registryDependencies: string[];
  onCopied?: (key: string) => void;
};

/**
 * Install surface for a published component.
 * Mirrors the tabbed CLI / v0 / Lovable / Bolt flow used by component
 * registries so a developer can drop the component into any tool.
 */
export function InstallTabs({ slug, dependencies, registryDependencies }: Props) {
  const [tab, setTab] = useState<"cli" | "v0" | "lovable" | "bolt">("cli");
  const [copied, setCopied] = useState<string | null>(null);

  const siteOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://shadway.com";
  const registryUrl = `${siteOrigin}/r/${slug}`;
  const cliCommand = `npx shadcn@latest add ${registryUrl}`;

  const tabs = [
    { id: "cli", label: "CLI", icon: Terminal },
    { id: "v0", label: "v0", icon: Sparkles },
    { id: "lovable", label: "Lovable", icon: Heart },
    { id: "bolt", label: "Bolt", icon: Zap },
  ] as const;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === item.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "cli" && (
        <div className="space-y-3">
          <CopyRow
            label="shadcn CLI"
            value={cliCommand}
            onCopy={() => copy(cliCommand, "cli")}
            copied={copied === "cli"}
          />
          <CopyRow
            label="Registry URL"
            value={registryUrl}
            onCopy={() => copy(registryUrl, "url")}
            copied={copied === "url"}
          />
          <Button variant="outline" size="sm" className="w-fit" asChild>
            <a href={`/api/components/download/${slug}`} download>
              <Download className="h-4 w-4" />
              Download source (.tsx)
            </a>
          </Button>

          <InstallNotes dependencies={dependencies} registryDependencies={registryDependencies} />
        </div>
      )}

      {tab === "v0" && (
        <PromptPanel
          title="Open in v0"
          description="Paste this prompt into v0 to drop the component straight into your project."
          prompt={`Add this shadcn component to my project:\n\n${registryUrl}\n\nInstall it with the shadcn CLI and place it where I need it. Keep my existing design tokens.`}
          onCopy={() =>
            copy(
              `Add this shadcn component to my project:\n\n${registryUrl}\n\nInstall it with the shadcn CLI and place it where I need it. Keep my existing design tokens.`,
              "v0"
            )
          }
          copied={copied === "v0"}
        />
      )}

      {tab === "lovable" && (
        <PromptPanel
          title="Open in Lovable"
          description="Copy this prompt into Lovable and it will add the component for you."
          prompt={`Add the component from ${registryUrl} to this project using the shadcn registry. Install any required dependencies and reuse the existing theme.`}
          onCopy={() =>
            copy(
              `Add the component from ${registryUrl} to this project using the shadcn registry. Install any required dependencies and reuse the existing theme.`,
              "lovable"
            )
          }
          copied={copied === "lovable"}
        />
      )}

      {tab === "bolt" && (
        <PromptPanel
          title="Open in Bolt"
          description="Use this agent-ready prompt in Bolt.new."
          prompt={`Install the shadcn component at ${registryUrl} and integrate it into the current app.`}
          onCopy={() =>
            copy(
              `Install the shadcn component at ${registryUrl} and integrate it into the current app.`,
              "bolt"
            )
          }
          copied={copied === "bolt"}
        />
      )}
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{value}</code>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
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
    <div className="grid gap-4 pt-2 sm:grid-cols-2">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          npm dependencies
        </h4>
        {dependencies.length ? (
          <ul className="space-y-1 text-xs">
            {dependencies.map((dep) => (
              <li key={dep}>
                <code className="rounded bg-muted px-1.5 py-0.5">{dep}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">None</p>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          shadcn registry dependencies
        </h4>
        {registryDependencies.length ? (
          <ul className="space-y-1 text-xs">
            {registryDependencies.map((dep) => (
              <li key={dep}>
                <code className="rounded bg-muted px-1.5 py-0.5">{dep}</code>
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

function PromptPanel({
  title,
  description,
  prompt,
  onCopy,
  copied,
}: {
  title: string;
  description: string;
  prompt: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-lg border bg-muted/40 p-3">
        <pre className="whitespace-pre-wrap text-xs leading-5">{prompt}</pre>
      </div>
      <Button variant="outline" size="sm" onClick={onCopy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        Copy prompt
      </Button>
    </div>
  );
}