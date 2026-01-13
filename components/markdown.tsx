import { cn } from "@/lib/utils";
import { marked } from "marked";
import { memo, useId, useMemo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { CodeBlock, CodeBlockCode } from "./code-block";
import "katex/dist/katex.min.css";

export type MarkdownProps = {
  children: string;
  id?: string;
  className?: string;
  components?: Partial<Components>;
};

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext";
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : "plaintext";
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <code
          className={cn(
            "relative rounded-md bg-primary/10 px-[0.4em] py-[0.2em] font-mono text-[0.9em] font-medium text-primary",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    const language = extractLanguage(className);

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    );
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>;
  },
  // Headings
  h1: ({ children, className, ...props }) => (
    <h1
      className={cn(
        "mt-6 mb-4 text-2xl font-bold tracking-tight text-foreground first:mt-0",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, className, ...props }) => (
    <h2
      className={cn(
        "mt-6 mb-3 text-xl font-semibold tracking-tight text-foreground border-b border-border/30 pb-2 first:mt-0",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, className, ...props }) => (
    <h3
      className={cn(
        "mt-5 mb-2 text-lg font-semibold text-foreground first:mt-0",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, className, ...props }) => (
    <h4
      className={cn(
        "mt-4 mb-2 text-base font-semibold text-foreground first:mt-0",
        className,
      )}
      {...props}
    >
      {children}
    </h4>
  ),
  // Paragraphs
  p: ({ children, className, ...props }) => (
    <p
      className={cn(
        "mb-4 leading-7 text-foreground/90 last:mb-0 [&:not(:first-child)]:mt-4",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  ),
  // Lists
  ul: ({ children, className, ...props }) => (
    <ul
      className={cn(
        "my-4 ml-6 list-disc space-y-2 text-foreground/90 [&>li]:pl-1",
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, className, ...props }) => (
    <ol
      className={cn(
        "my-4 ml-6 list-decimal space-y-2 text-foreground/90 [&>li]:pl-1",
        className,
      )}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, className, ...props }) => (
    <li className={cn("leading-7", className)} {...props}>
      {children}
    </li>
  ),
  // Blockquote
  blockquote: ({ children, className, ...props }) => (
    <blockquote
      className={cn(
        "my-4 border-l-4 border-primary/40 bg-muted/30 py-2 pl-4 pr-4 italic text-foreground/80 rounded-r-lg",
        className,
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  // Links
  a: ({ children, className, href, ...props }) => (
    <a
      className={cn(
        "font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary",
        className,
      )}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  // Strong/Bold
  strong: ({ children, className, ...props }) => (
    <strong
      className={cn("font-semibold text-foreground", className)}
      {...props}
    >
      {children}
    </strong>
  ),
  // Emphasis/Italic
  em: ({ children, className, ...props }) => (
    <em className={cn("italic", className)} {...props}>
      {children}
    </em>
  ),
  // Horizontal Rule
  hr: ({ className, ...props }) => (
    <hr className={cn("my-6 border-border/50", className)} {...props} />
  ),
  // Tables
  table: ({ children, className, ...props }) => (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border/50">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, className, ...props }) => (
    <thead
      className={cn("bg-muted/50 border-b border-border/50", className)}
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, className, ...props }) => (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, className, ...props }) => (
    <tr
      className={cn(
        "border-b border-border/30 transition-colors hover:bg-muted/30",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ children, className, ...props }) => (
    <th
      className={cn(
        "px-4 py-3 text-left font-semibold text-foreground [&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, className, ...props }) => (
    <td
      className={cn(
        "px-4 py-3 text-foreground/80 [&[align=center]]:text-center [&[align=right]]:text-right",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  ),
  // Images
  img: ({ src, alt, className, ...props }) => (
    <span className="my-4 block">
      <img
        src={src}
        alt={alt || ""}
        className={cn(
          "rounded-lg border border-border/50 shadow-sm max-w-full h-auto",
          className,
        )}
        loading="lazy"
        {...props}
      />
      {alt && (
        <span className="mt-2 block text-center text-sm text-muted-foreground">
          {alt}
        </span>
      )}
    </span>
  ),
};

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string;
    components?: Partial<Components>;
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content;
  },
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

  return (
    <div className={cn("markdown-body", className)}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
