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
import { memo, useEffect } from 'react';
import ReactMarkdown, { type Options, type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

// Custom CSS for chat panel scrolling
const chatScrollStyles = `
  .conversation-container {
    height: 100% !important;
    overflow-y: scroll !important;
    overflow-x: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    scroll-behavior: smooth !important;
  }

  .conversation-container::-webkit-scrollbar {
    width: 12px !important;
  }

  .conversation-container::-webkit-scrollbar-track {
    background: transparent !important;
    margin: 4px 0 !important;
  }

  .conversation-container::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.6) !important;
    border-radius: 6px !important;
    border: 3px solid transparent !important;
    background-clip: content-box !important;
  }

  .conversation-container::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.9) !important;
    background-clip: content-box !important;
  }

  .conversation-container::-webkit-scrollbar-thumb:active {
    background: hsl(var(--muted-foreground)) !important;
    background-clip: content-box !important;
  }

  .conversation-container {
    scrollbar-color: hsl(var(--muted-foreground) / 0.6) transparent !important;
    scrollbar-width: thin !important;
  }

  /* Ensure content flows properly */
  .prose-container {
    word-break: break-word !important;
    overflow-wrap: break-word !important;
    width: 100% !important;
  }

  /* Enable smooth scrolling */
  html {
    scroll-behavior: smooth !important;
  }
`;

// Type definitions for better type safety
interface CodeElementProps {
  node?: any;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}

interface PreElementProps extends CodeElementProps {
  children: {
    type: string;
    props: {
      children: string;
      className?: string;
    };
  };
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

// Filename mappings - Only TSX/TS
const filenameMap: FilenameMapping = {
  tsx: 'Component.tsx',
  ts: 'types.ts',
};

// Type-safe language detection function - Only TSX/TS
const detectLanguageFromContent = (code: string): SupportedLanguage => {
  // Check for React/JSX patterns first (TSX takes priority)
  if (/\b(import.*from ['"]react['"]|<\w+[^>]*>|export default function|export const.*=\s*\(|React\.)/i.test(code)) {
    return 'tsx';
  }

  // Check for TypeScript patterns
  if (/\b(interface|type |enum |namespace |declare |async |export |import )/i.test(code)) {
    return 'ts';
  }

  // Check other patterns
  for (const { pattern, language } of languagePatterns) {
    if (pattern.test(code)) {
      return language;
    }
  }

  // Default to TSX for component code
  return 'tsx';
};

// Type-safe filename generation function - Only TSX/TS
const getFilename = (lang: string, code: string): string => {
  const normalizedLang = lang.toLowerCase();

  // Always detect from content to ensure TSX/TS
  const detectedLang: SupportedLanguage = detectLanguageFromContent(code);

  return filenameMap[detectedLang] || 'Component.tsx';
};

// Type-safe React Markdown components - Enhanced for beautiful formatting
const components: Components = {
  ol: ({ node, children, className, ...props }: CodeElementProps) => (
    <ol className={cn('ml-6 list-outside list-decimal space-y-3 my-6 text-foreground', className)} {...props}>
      {children}
    </ol>
  ),

  li: ({ node, children, className, ...props }: CodeElementProps) => (
    <li className={cn('py-2 leading-relaxed text-foreground', className)} {...props}>
      {children}
    </li>
  ),

  ul: ({ node, children, className, ...props }: CodeElementProps) => (
    <ul className={cn('ml-6 list-outside list-disc space-y-3 my-6 text-foreground', className)} {...props}>
      {children}
    </ul>
  ),

  strong: ({ node, children, className, ...props }: CodeElementProps) => (
    <strong className={cn('font-bold text-foreground', className)} {...props}>
      {children}
    </strong>
  ),

  em: ({ node, children, className, ...props }: CodeElementProps) => (
    <em className={cn('italic text-foreground', className)} {...props}>
      {children}
    </em>
  ),

  mark: ({ node, children, className, ...props }: CodeElementProps) => (
    <mark className={cn('bg-yellow-200/30 dark:bg-yellow-900/30 px-1 rounded text-foreground', className)} {...props}>
      {children}
    </mark>
  ),

  a: ({ node, children, className, href, ...props }: CodeElementProps & { href?: string }) => (
    <a
      className={cn('font-medium text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors', className)}
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
      className={cn('mt-8 mb-5 font-bold text-3xl text-foreground border-b-2 border-border/50 pb-4 leading-tight', className)}
      {...props}
    >
      {children}
    </h1>
  ),

  h2: ({ node, children, className, ...props }: CodeElementProps) => (
    <h2
      className={cn('mt-8 mb-4 font-bold text-2xl text-foreground border-b border-border/40 pb-3 leading-tight', className)}
      {...props}
    >
      {children}
    </h2>
  ),

  h3: ({ node, children, className, ...props }: CodeElementProps) => (
    <h3 className={cn('mt-6 mb-3 font-semibold text-xl text-foreground leading-tight', className)} {...props}>
      {children}
    </h3>
  ),

  h4: ({ node, children, className, ...props }: CodeElementProps) => (
    <h4 className={cn('mt-5 mb-3 font-semibold text-lg text-foreground leading-tight', className)} {...props}>
      {children}
    </h4>
  ),

  h5: ({ node, children, className, ...props }: CodeElementProps) => (
    <h5
      className={cn('mt-4 mb-2 font-semibold text-base text-foreground', className)}
      {...props}
    >
      {children}
    </h5>
  ),

  h6: ({ node, children, className, ...props }: CodeElementProps) => (
    <h6 className={cn('mt-3 mb-2 font-medium text-sm text-muted-foreground', className)} {...props}>
      {children}
    </h6>
  ),

  p: ({ node, children, className, ...props }: CodeElementProps) => (
    <p className={cn('mb-5 leading-8 text-foreground/90 text-base', className)} {...props}>
      {children}
    </p>
  ),

  blockquote: ({ node, children, className, ...props }: CodeElementProps) => (
    <blockquote
      className={cn('border-l-4 border-primary pl-6 py-4 my-6 bg-muted/50 rounded-r-lg italic text-muted-foreground font-medium', className)}
      {...props}
    >
      {children}
    </blockquote>
  ),
  
  pre: ({ node, className, children }: PreElementProps) => {
    // Type guard for code children
    const childrenIsCode = (
      typeof children === 'object' &&
      children !== null &&
      'type' in children &&
      children.type === 'code' &&
      'props' in children &&
      typeof children.props === 'object' &&
      children.props !== null &&
      'children' in children.props &&
      typeof children.props.children === 'string'
    );

    if (!childrenIsCode) {
      return (
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm my-4 border border-border/50">
          {children}
        </pre>
      );
    }

    const codeContent = children.props.children;

    // Skip rendering if this is code from <think> or other non-component tags
    if (codeContent.includes('<think>') || codeContent.includes('</think>')) {
      return null;
    }

    // Force JSX/TSX only
    const detected = detectLanguageFromContent(codeContent);
    const filename = getFilename(detected, codeContent);

    // Type-safe data construction
    const data: NonNullable<CodeBlockProps['data']> = [
      {
        language: detected as BundledLanguage,
        filename,
        code: codeContent,
      },
    ];

    return (
      <CodeBlock
        className={cn('my-6 h-auto shadow-lg border border-border/50 rounded-xl overflow-hidden', className)}
        data={data}
        defaultValue={data[0].language}
      >
        <CodeBlockHeader className="bg-muted/30 border-b border-border/50">
          <CodeBlockFiles>
            {(item) => (
              <CodeBlockFilename
                key={item.language}
                value={item.language}
                className="text-sm font-medium"
              >
                {item.filename}
              </CodeBlockFilename>
            )}
          </CodeBlockFiles>
          <CodeBlockSelect>
            <CodeBlockSelectTrigger className="text-xs">
              <CodeBlockSelectValue />
            </CodeBlockSelectTrigger>
            <CodeBlockSelectContent>
              {(item) => (
                <CodeBlockSelectItem key={item.language} value={item.language}>
                  {item.language}
                </CodeBlockSelectItem>
              )}
            </CodeBlockSelectContent>
          </CodeBlockSelect>
          <CodeBlockCopyButton
            onCopy={() => console.log('Copied code to clipboard')}
            onError={() => console.error('Failed to copy code to clipboard')}
            className="hover:bg-muted/50"
          />
        </CodeBlockHeader>
        <CodeBlockBody>
          {(item) => (
            <CodeBlockItem key={item.language} value={item.language}>
              <CodeBlockContent
                language={item.language as BundledLanguage}
                className="text-sm"
              >
                {item.code}
              </CodeBlockContent>
            </CodeBlockItem>
          )}
        </CodeBlockBody>
      </CodeBlock>
    );
  },

  // Beautiful table styling
  table: ({ node, children, className, ...props }: CodeElementProps) => (
    <div className="my-8 overflow-x-auto rounded-lg border border-border/50">
      <table className={cn('w-full border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  ),

  thead: ({ node, children, className, ...props }: CodeElementProps) => (
    <thead className={cn('bg-muted/60 border-b border-border/50', className)} {...props}>
      {children}
    </thead>
  ),

  tbody: ({ node, children, className, ...props }: CodeElementProps) => (
    <tbody className={cn('divide-y divide-border/30', className)} {...props}>
      {children}
    </tbody>
  ),

  tr: ({ node, children, className, ...props }: CodeElementProps) => (
    <tr className={cn('hover:bg-muted/30 transition-colors', className)} {...props}>
      {children}
    </tr>
  ),

  th: ({ node, children, className, ...props }: CodeElementProps) => (
    <th className={cn('border-b border-border/50 px-5 py-3 text-left font-bold text-foreground text-sm', className)} {...props}>
      {children}
    </th>
  ),

  td: ({ node, children, className, ...props }: CodeElementProps) => (
    <td className={cn('px-5 py-3 text-foreground/90 text-sm leading-relaxed', className)} {...props}>
      {children}
    </td>
  ),

  // Inline code styling
  code: ({ node, children, className, ...props }: CodeElementProps) => (
    <code
      className={cn(
        'relative rounded bg-muted/70 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground border border-border/30',
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),

  // Horizontal rule
  hr: ({ node, className, ...props }: CodeElementProps) => (
    <hr className={cn('my-8 border-t-2 border-border/30', className)} {...props} />
  ),
};

// Clean markdown content by removing special tags
const cleanMarkdownContent = (content: string): string => {
  // Remove <think> tags and their content
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '');

  // Remove <component> tags but keep the content
  cleaned = cleaned.replace(/<component>/g, '```');
  cleaned = cleaned.replace(/<\/component>/g, '```');

  return cleaned.trim();
};

// Memoized component with proper type safety and enhanced formatting
export const AIResponse = memo<AIResponseProps>(
  ({ className, options, children, ...props }) => {
    // Inject scroll styles on mount
    useEffect(() => {
      const styleElement = document.createElement('style');
      styleElement.textContent = chatScrollStyles;
      document.head.appendChild(styleElement);
      return () => {
        document.head.removeChild(styleElement);
      };
    }, []);

    // Clean the markdown content
    const cleanedContent = typeof children === 'string' ? cleanMarkdownContent(children) : children;

    return (
      <div
        className={cn(
          'prose-container w-full prose prose-sm dark:prose-invert max-w-none',
          '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // Enhanced text styling
          'text-foreground/95',
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

// Add display name for better debugging
AIResponse.displayName = 'AIResponse';

export default AIResponse;