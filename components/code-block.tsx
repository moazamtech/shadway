"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children?: React.ReactNode;
  code?: string;
  showIcon?: boolean;
  className?: string;
}

interface CodeBlockCodeProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({
  children,
  code,
  showIcon = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // If children are provided, render as wrapper
  if (children) {
    return (
      <div
        className={cn(
          "group relative rounded-lg bg-muted/50 border border-border/50 my-4",
          className,
        )}
      >
        {children}
      </div>
    );
  }

  // Otherwise render inline code block
  const copyToClipboard = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg bg-muted/50 border border-border/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {showIcon && (
            <Terminal className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <code className="text-sm font-mono break-all text-foreground/90">
            {code}
          </code>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">{copied ? "Copied" : "Copy code"}</span>
        </Button>
      </div>
    </div>
  );
}

export function CodeBlockCode({
  code,
  language = "plaintext",
  className,
}: CodeBlockCodeProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-xs text-muted-foreground font-mono">
          {language}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span className="sr-only">{copied ? "Copied" : "Copy code"}</span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}
