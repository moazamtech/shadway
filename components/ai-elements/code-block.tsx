"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  atomOneDark,
  atomOneLight,
} from "react-syntax-highlighter/dist/esm/styles/hljs";
import tsx from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";

// Register languages
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("typescript", tsx);
SyntaxHighlighter.registerLanguage("jsx", javascript);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("html", xml);
SyntaxHighlighter.registerLanguage("xml", xml);

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  // One renderer, one theme.
  //
  // The obvious way to theme a code block is to render it twice — a light copy
  // and a dark copy — and hide one with a `dark:` class. That quietly breaks:
  // highlight.js themes declare `display: block` on their own `<pre>` as an
  // inline style, and an inline style outranks any class, so the "hidden" copy
  // stays on screen and the code appears twice. Choosing the theme here from
  // the same value the rest of the app is themed from renders the code once,
  // and the block can never disagree with the page around it.
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? atomOneDark : atomOneLight;

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border bg-background text-foreground",
          className
        )}
        {...props}
      >
        <div className="relative">
          <SyntaxHighlighter
            className="overflow-hidden"
            codeTagProps={{
              className: "font-mono text-sm",
            }}
            customStyle={{
              margin: 0,
              padding: "1rem",
              fontSize: "0.875rem",
              // The recess the design system already reserves for code, rather
              // than a colour borrowed from the highlight.js theme. Declared
              // straight off the token — the app's tokens are plain colours, so
              // wrapping them in `hsl()` would make the declaration invalid and
              // silently hand the block back to the theme's own background.
              background: "var(--well)",
              color: "var(--foreground)",
            }}
            language={language}
            lineNumberStyle={{
              color: "var(--muted-foreground)",
              paddingRight: "1rem",
              minWidth: "2.5rem",
            }}
            showLineNumbers={showLineNumbers}
            style={style}
          >
            {code}
          </SyntaxHighlighter>
          {children && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator.clipboard.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
