"use client";

import { useState, useEffect } from "react";
import { Check, Copy, Terminal, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";

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

// Language display names
const languageNames: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  java: "Java",
  cpp: "C++",
  c: "C",
  cs: "C#",
  csharp: "C#",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  xml: "XML",
  md: "Markdown",
  markdown: "Markdown",
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  zsh: "Zsh",
  powershell: "PowerShell",
  ps1: "PowerShell",
  dockerfile: "Dockerfile",
  docker: "Docker",
  graphql: "GraphQL",
  gql: "GraphQL",
  prisma: "Prisma",
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
  plaintext: "Plain Text",
  text: "Plain Text",
};

// Language icons mapping
const getLanguageIcon = (lang: string) => {
  const iconLangs = [
    "typescript",
    "ts",
    "tsx",
    "javascript",
    "js",
    "jsx",
    "python",
    "py",
    "rust",
    "go",
    "java",
  ];
  if (iconLangs.includes(lang.toLowerCase())) {
    return <FileCode2 className="h-3.5 w-3.5" />;
  }
  return <Terminal className="h-3.5 w-3.5" />;
};

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
          "group relative my-4 overflow-hidden rounded-xl border border-border/50 bg-[#0d1117] dark:bg-[#0d1117] shadow-lg",
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
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const displayLanguage = languageNames[language.toLowerCase()] || language;
  const trimmedCode = code.trim();

  useEffect(() => {
    let isMounted = true;

    async function highlight() {
      try {
        const html = await codeToHtml(trimmedCode, {
          lang: language.toLowerCase(),
          theme: "github-dark-default",
        });
        if (isMounted) {
          setHighlightedCode(html);
          setIsLoading(false);
        }
      } catch {
        // Fallback if language not supported
        try {
          const html = await codeToHtml(trimmedCode, {
            lang: "text",
            theme: "github-dark-default",
          });
          if (isMounted) {
            setHighlightedCode(html);
            setIsLoading(false);
          }
        } catch {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
    }

    highlight();
    return () => {
      isMounted = false;
    };
  }, [trimmedCode, language]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(trimmedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">{getLanguageIcon(language)}</span>
          <span className="text-xs font-medium text-zinc-400">
            {displayLanguage}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-all"
          onClick={copyToClipboard}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {isLoading ? (
          <pre className="p-4 text-sm font-mono leading-relaxed">
            <code className="text-zinc-300">{trimmedCode}</code>
          </pre>
        ) : (
          <div
            className="shiki-wrapper [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:m-0 [&_code]:text-sm [&_code]:leading-relaxed [&_.line]:min-h-[1.5em]"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        )}
      </div>
    </div>
  );
}
