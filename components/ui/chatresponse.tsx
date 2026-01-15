'use client';

import {
  type BundledLanguage,
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
  type CodeBlockProps,
  CodeBlockSelect,
  CodeBlockSelectContent,
  CodeBlockSelectItem,
  CodeBlockSelectTrigger,
  CodeBlockSelectValue,
} from '@/components/codeblock';
import type { HTMLAttributes, ReactNode } from 'react';
import React, { memo, useEffect } from 'react';
import ReactMarkdown, { type Options, type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

// Custom CSS for chat scrolling and VS Code-like styles
const chatStyles = ""; // Moved to global CSS

// Type definitions
interface CodeElementProps {
  node?: any;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}

interface PreElementProps extends CodeElementProps {
  children?: ReactNode;
}

type SupportedLanguage = 'tsx' | 'ts';

interface LanguagePattern {
  pattern: RegExp;
  language: SupportedLanguage;
}

interface FilenameMapping {
  [key: string]: string;
}

export type AIResponseProps = HTMLAttributes<HTMLDivElement> & {
  options?: Options;
  children: Options['children'];
};

// Language detection patterns - Only TSX/TS
const languagePatterns: LanguagePattern[] = [
  // TSX patterns (React components with JSX)
  {
    pattern: /\b(interface|type |as |: string|: number|: boolean|: React\.|<FC|<React\.FC|export default function|export const|import.*from ['"]react['"]|<\w+.*>)/i,
    language: 'tsx'
  },
  // Pure TypeScript patterns
  {
    pattern: /\b(interface|type |enum |namespace |declare |async |export |import |from ['"])/i,
    language: 'ts'
  },
];

const filenameMap: FilenameMapping = {
  tsx: 'Component.tsx',
  ts: 'types.ts',
};

const detectLanguageFromContent = (code: string): SupportedLanguage => {
  if (/\b(import.*from ['"]react['"]|<\w+[^>]*>|export default function|export const.*=\s*\(|React\.)/i.test(code)) {
    return 'tsx';
  }
  if (/\b(interface|type |enum |namespace |declare |async |export |import )/i.test(code)) {
    return 'ts';
  }
  for (const { pattern, language } of languagePatterns) {
    if (pattern.test(code)) {
      return language;
    }
  }
  return 'tsx';
};

const getFilename = (lang: string, code: string): string => {
  const detectedLang: SupportedLanguage = detectLanguageFromContent(code);
  return filenameMap[detectedLang] || 'Component.tsx';
};

// Type-safe React Markdown components
const components: Components = {
  ol: ({ node, children, className, ...props }: CodeElementProps) => (
    <ol className={cn('ml-6 list-decimal space-y-2 my-4 text-foreground/90', className)} {...props}>
      {children}
    </ol>
  ),

  li: ({ node, children, className, ...props }: CodeElementProps) => (
    <li className={cn('pl-2 leading-relaxed text-foreground/90', className)} {...props}>
      {children}
    </li>
  ),

  ul: ({ node, children, className, ...props }: CodeElementProps) => (
    <ul className={cn('ml-6 list-disc space-y-2 my-4 text-foreground/90', className)} {...props}>
      {children}
    </ul>
  ),

  strong: ({ node, children, className, ...props }: CodeElementProps) => (
    <strong className={cn('font-semibold text-foreground', className)} {...props}>
      {children}
    </strong>
  ),

  a: ({ node, children, className, href, ...props }: CodeElementProps & { href?: string }) => (
    <a
      className={cn('font-medium text-primary underline decoration-primary/30 hover:decoration-primary/100 transition-colors', className)}
      rel="noreferrer"
      target="_blank"
      href={href}
      {...props}
    >
      {children}
    </a>
  ),

  h1: ({ node, children, className, ...props }: CodeElementProps) => (
    <h1
      className={cn('mt-8 mb-4 font-bold text-3xl text-foreground tracking-tight', className)}
      {...props}
    >
      {children}
    </h1>
  ),

  h2: ({ node, children, className, ...props }: CodeElementProps) => (
    <h2
      className={cn('mt-8 mb-4 font-bold text-2xl text-foreground tracking-tight border-b border-border/40 pb-2', className)}
      {...props}
    >
      {children}
    </h2>
  ),

  h3: ({ node, children, className, ...props }: CodeElementProps) => (
    <h3 className={cn('mt-6 mb-3 font-semibold text-xl text-foreground tracking-tight', className)} {...props}>
      {children}
    </h3>
  ),

  p: ({ node, children, className, ...props }: CodeElementProps) => (
    <p className={cn('mb-4 leading-relaxed text-foreground font-sans tracking-tight', className)} {...props}>
      {children}
    </p>
  ),

  blockquote: ({ node, children, className, ...props }: CodeElementProps) => (
    <blockquote
      className={cn('border-l-4 border-primary/50 pl-6 py-2 my-6 bg-muted/30 italic text-muted-foreground', className)}
      {...props}
    >
      {children}
    </blockquote>
  ),

  pre: ({ className, children }: PreElementProps) => {
    const childrenArray = React.Children.toArray(children);
    const codeElement: any = childrenArray.find(
      (child: any) => child?.type === 'code'
    );

    if (!codeElement) {
      return (
        <pre className="bg-muted text-muted-foreground p-4 rounded-lg overflow-x-auto text-sm my-4 border border-border/40">
          {children}
        </pre>
      );
    }

    const codeContent = String(codeElement.props?.children || '');

    // Skip rendering if this is code from <think> or other non-component tags
    if (codeContent.includes('<think>') || codeContent.includes('</think>')) {
      return null;
    }

    const detected = detectLanguageFromContent(codeContent);
    const filename = getFilename(detected, codeContent);

    const data: NonNullable<CodeBlockProps['data']> = [
      {
        language: detected as BundledLanguage,
        filename,
        code: codeContent,
      },
    ];

    return (
      <CodeBlock
        className={cn('my-6 shadow-xl border border-border rounded-xl overflow-hidden bg-card transition-all duration-300', className)}
        data={data}
        defaultValue={data[0].language}
      >
        <CodeBlockHeader className="bg-muted/50 border-b border-border/40 py-2.5 px-4 backdrop-blur-sm">
          <CodeBlockFiles>
            {(item) => (
              <CodeBlockFilename
                key={item.language}
                value={item.language}
                className="text-xs font-semibold text-foreground/70 active:text-foreground transition-colors"
              >
                {item.filename}
              </CodeBlockFilename>
            )}
          </CodeBlockFiles>
          <div className="flex items-center gap-2">
            <CodeBlockCopyButton
              onCopy={() => console.log('Copied')}
              className="text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            />
          </div>
        </CodeBlockHeader>
        <CodeBlockBody className="bg-card/50">
          {(item) => (
            <CodeBlockItem key={item.language} value={item.language}>
              <CodeBlockContent
                language={item.language as BundledLanguage}
                className="text-sm font-mono leading-relaxed p-5 scrollbar-thin scrollbar-thumb-border"
              >
                {item.code}
              </CodeBlockContent>
            </CodeBlockItem>
          )}
        </CodeBlockBody>
      </CodeBlock>
    );
  },

  table: ({ node, children, className, ...props }: CodeElementProps) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-border/40">
      <table className={cn('w-full border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  ),

  thead: ({ node, children, className, ...props }: CodeElementProps) => (
    <thead className={cn('bg-muted/40 border-b border-border/40', className)} {...props}>
      {children}
    </thead>
  ),

  tr: ({ node, children, className, ...props }: CodeElementProps) => (
    <tr className={cn('border-b border-border/20 hover:bg-muted/20 transition-colors', className)} {...props}>
      {children}
    </tr>
  ),

  th: ({ node, children, className, ...props }: CodeElementProps) => (
    <th className={cn('px-4 py-3 text-left font-semibold text-foreground text-sm', className)} {...props}>
      {children}
    </th>
  ),

  td: ({ node, children, className, ...props }: CodeElementProps) => (
    <td className={cn('px-4 py-3 text-foreground/80 text-sm', className)} {...props}>
      {children}
    </td>
  ),

  code: ({ node, children, className, ...props }: CodeElementProps) => (
    <code
      className={cn(
        'rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[0.9em] font-medium text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),

  hr: ({ node, className, ...props }: CodeElementProps) => (
    <hr className={cn('my-8 border-border/40', className)} {...props} />
  ),
};

const cleanMarkdownContent = (content: string): string => {
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '');
  cleaned = cleaned.replace(/<component>/g, '```');
  cleaned = cleaned.replace(/<\/component>/g, '```');
  return cleaned.trim();
};

export const AIResponse = memo<AIResponseProps>(
  ({ className, options, children, ...props }) => {
    useEffect(() => {
      // Styles are now handled globally in globals.css
    }, []);

    const cleanedContent = typeof children === 'string' ? cleanMarkdownContent(children) : children;

    return (
      <div
        className={cn(
          'prose-container w-full max-w-none text-foreground',
          className
        )}
        {...props}
      >
        <ReactMarkdown
          components={components}
          rehypePlugins={[rehypeKatex]}
          remarkPlugins={[remarkGfm, remarkMath]}
          {...options}
        >
          {cleanedContent}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

AIResponse.displayName = 'AIResponse';

export default AIResponse;