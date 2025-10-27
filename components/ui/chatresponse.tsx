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
import { memo } from 'react';
import ReactMarkdown, { type Options, type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

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

type SupportedLanguage =
  | 'jsx' | 'tsx';

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

// Language detection patterns - Only JSX/TSX
const languagePatterns: LanguagePattern[] = [
  // TSX patterns (check before JSX)
  {
    pattern: /\b(interface|type |as |: string|: number|: boolean|: React\.|<FC|<React\.FC)/i,
    language: 'tsx'
  },

  // React/JSX patterns
  {
    pattern: /\b(import React|from ['"]react['"]|<\w+.*>|jsx|tsx|React\.)/i,
    language: 'jsx'
  },
];

// Filename mappings - Only JSX/TSX
const filenameMap: FilenameMapping = {
  jsx: 'Component.jsx',
  tsx: 'Component.tsx',
};

// Type-safe language detection function - Only JSX/TSX
const detectLanguageFromContent = (code: string): SupportedLanguage => {
  // Check for TypeScript/TSX patterns first
  if (/\b(interface|type |as |: string|: number|: boolean|: React\.|<FC|<React\.FC)/i.test(code)) {
    return 'tsx';
  }

  // Check for React/JSX patterns
  if (/\b(import React|from ['"]react['"]|<\w+.*>|React\.|jsx)/i.test(code)) {
    return 'jsx';
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

// Type-safe filename generation function - Only JSX/TSX
const getFilename = (lang: string, code: string): string => {
  const normalizedLang = lang.toLowerCase();

  // Always detect from content to ensure JSX/TSX
  const detectedLang: SupportedLanguage = detectLanguageFromContent(code);

  return filenameMap[detectedLang] || 'Component.tsx';
};

// Type-safe React Markdown components
const components: Components = {
  ol: ({ node, children, className, ...props }: CodeElementProps) => (
    <ol className={cn('ml-6 list-outside list-decimal space-y-2 my-4', className)} {...props}>
      {children}
    </ol>
  ),
  
  li: ({ node, children, className, ...props }: CodeElementProps) => (
    <li className={cn('py-1 leading-relaxed', className)} {...props}>
      {children}
    </li>
  ),
  
  ul: ({ node, children, className, ...props }: CodeElementProps) => (
    <ul className={cn('ml-6 list-outside list-disc space-y-2 my-4', className)} {...props}>
      {children}
    </ul>
  ),
  
  strong: ({ node, children, className, ...props }: CodeElementProps) => (
    <span className={cn('font-semibold text-foreground', className)} {...props}>
      {children}
    </span>
  ),
  
  a: ({ node, children, className, href, ...props }: CodeElementProps & { href?: string }) => (
    <a 
      className={cn('font-medium text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors', className)}
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
      className={cn('mt-8 mb-4 font-bold text-2xl text-foreground border-b border-border/50 pb-3', className)}
      {...props}
    >
      {children}
    </h1>
  ),
  
  h2: ({ node, children, className, ...props }: CodeElementProps) => (
    <h2
      className={cn('mt-6 mb-3 font-semibold text-xl text-foreground', className)}
      {...props}
    >
      {children}
    </h2>
  ),
  
  h3: ({ node, children, className, ...props }: CodeElementProps) => (
    <h3 className={cn('mt-5 mb-3 font-semibold text-lg text-foreground', className)} {...props}>
      {children}
    </h3>
  ),
  
  h4: ({ node, children, className, ...props }: CodeElementProps) => (
    <h4 className={cn('mt-4 mb-2 font-semibold text-base text-foreground', className)} {...props}>
      {children}
    </h4>
  ),
  
  h5: ({ node, children, className, ...props }: CodeElementProps) => (
    <h5
      className={cn('mt-4 mb-2 font-medium text-sm text-foreground', className)}
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
    <p className={cn('mb-4 leading-7 text-foreground [&:not(:first-child)]:mt-4', className)} {...props}>
      {children}
    </p>
  ),
  
  blockquote: ({ node, children, className, ...props }: CodeElementProps) => (
    <blockquote 
      className={cn('border-l-4 border-primary/30 pl-6 py-3 my-6 bg-muted/30 rounded-r-lg italic text-muted-foreground', className)} 
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

  // Improved table styling
  table: ({ node, children, className, ...props }: CodeElementProps) => (
    <div className="my-6 overflow-x-auto">
      <table className={cn('w-full border-collapse border border-border rounded-lg', className)} {...props}>
        {children}
      </table>
    </div>
  ),

  thead: ({ node, children, className, ...props }: CodeElementProps) => (
    <thead className={cn('bg-muted/50', className)} {...props}>
      {children}
    </thead>
  ),

  th: ({ node, children, className, ...props }: CodeElementProps) => (
    <th className={cn('border border-border px-4 py-2 text-left font-semibold', className)} {...props}>
      {children}
    </th>
  ),

  td: ({ node, children, className, ...props }: CodeElementProps) => (
    <td className={cn('border border-border px-4 py-2', className)} {...props}>
      {children}
    </td>
  ),

  // Improved code styling
  code: ({ node, children, className, ...props }: CodeElementProps) => (
    <code 
      className={cn(
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
        className
      )} 
      {...props}
    >
      {children}
    </code>
  ),

  // Horizontal rule
  hr: ({ node, className, ...props }: CodeElementProps) => (
    <hr className={cn('my-8 border-border', className)} {...props} />
  ),
};

// Memoized component with proper type safety
export const AIResponse = memo<AIResponseProps>(
  ({ className, options, children, ...props }) => (
    <div
      className={cn(
        'size-full prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        // Custom prose styling
        'prose-headings:scroll-m-20 prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
        'prose-p:leading-7 prose-p:[&:not(:first-child)]:mt-4',
        'prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-6 prose-blockquote:italic',
        'prose-ul:my-4 prose-ul:ml-6 prose-ol:my-4 prose-ol:ml-6',
        'prose-li:mt-2 prose-li:leading-7',
        'prose-pre:bg-muted prose-pre:border prose-pre:border-border/50',
        'prose-code:relative prose-code:rounded prose-code:bg-muted prose-code:px-[0.3rem] prose-code:py-[0.2rem] prose-code:font-mono prose-code:text-sm prose-code:font-semibold',
        'prose-a:font-medium prose-a:text-primary prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-primary/80',
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
        {children}
      </ReactMarkdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

// Add display name for better debugging
AIResponse.displayName = 'AIResponse';

export default AIResponse;