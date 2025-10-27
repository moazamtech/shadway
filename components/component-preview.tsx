"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2Icon, EyeIcon, AlertCircleIcon, Loader2Icon } from "lucide-react";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

interface ComponentPreviewProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function ComponentPreview({
  code,
  language = "tsx",
  showLineNumbers = true
}: ComponentPreviewProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (activeTab === "preview" && iframeRef.current) {
      setIsLoading(true);
      setPreviewError(null);

      // Create the preview HTML content
      const encodedCode = typeof window !== "undefined"
        ? window.btoa(unescape(encodeURIComponent(code)))
        : "";
      const previewHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    // Tailwind config to mimic shadcn palette used in the site
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            border: "hsl(214.3 31.8% 91.4%)",
            input: "hsl(214.3 31.8% 91.4%)",
            ring: "hsl(222.2 84% 4.9%)",
            background: "hsl(0 0% 100%)",
            foreground: "hsl(222.2 84% 4.9%)",
            primary: {
              DEFAULT: "hsl(222.2 47.4% 11.2%)",
              foreground: "hsl(210 40% 98%)",
            },
            secondary: {
              DEFAULT: "hsl(210 40% 96.1%)",
              foreground: "hsl(222.2 47.4% 11.2%)",
            },
            destructive: {
              DEFAULT: "hsl(0 84.2% 60.2%)",
              foreground: "hsl(210 40% 98%)",
            },
            muted: {
              DEFAULT: "hsl(210 40% 96.1%)",
              foreground: "hsl(215.4 16.3% 46.9%)",
            },
            accent: {
              DEFAULT: "hsl(210 40% 96.1%)",
              foreground: "hsl(222.2 47.4% 11.2%)",
            },
            card: {
              DEFAULT: "hsl(0 0% 100%)",
              foreground: "hsl(222.2 84% 4.9%)",
            },
          },
          borderRadius: {
            lg: "0.5rem",
            md: "calc(0.5rem - 2px)",
            sm: "calc(0.5rem - 4px)",
          },
        },
      },
    }
  </script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 20px;
      background: white;
    }
    .error {
      color: #ef4444;
      background: #fee2e2;
      padding: 16px;
      border-radius: 8px;
      margin: 20px;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useCallback, useMemo, useRef } = React;

    // Utilities
    function cn(...classes) {
      return classes.filter(Boolean).join(' ');
    }

    // Decode base64 UTF-8 safely
    function decodeBase64Utf8(b64) {
      const binary = atob(b64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    }

    const originalCode = decodeBase64Utf8('${encodedCode}');

    // Mock Shadcn UI components with basic implementations
    const Card = ({ children, className = "", ...props }) => (
      <div className={\`rounded-lg border bg-card text-card-foreground shadow-sm \${className}\`} {...props}>
        {children}
      </div>
    );

    const CardHeader = ({ children, className = "", ...props }) => (
      <div className={\`flex flex-col space-y-1.5 p-6 \${className}\`} {...props}>
        {children}
      </div>
    );

    const CardTitle = ({ children, className = "", ...props }) => (
      <h3 className={\`text-2xl font-semibold leading-none tracking-tight \${className}\`} {...props}>
        {children}
      </h3>
    );

    const CardDescription = ({ children, className = "", ...props }) => (
      <p className={\`text-sm text-muted-foreground \${className}\`} {...props}>
        {children}
      </p>
    );

    const CardContent = ({ children, className = "", ...props }) => (
      <div className={\`p-6 pt-0 \${className}\`} {...props}>
        {children}
      </div>
    );

    const CardFooter = ({ children, className = "", ...props }) => (
      <div className={\`flex items-center p-6 pt-0 \${className}\`} {...props}>
        {children}
      </div>
    );

    const Button = ({ children, className = "", variant = "default", size = "default", ...props }) => {
      const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      };

      const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      };

      return (
        <button
          className={\`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 \${variants[variant]} \${sizes[size]} \${className}\`}
          {...props}
        >
          {children}
        </button>
      );
    };

    // Chat Container Components
    const ChatContainerRoot = ({ children, className = '', ...props }) => {
      return React.createElement('div', {
        className: \`flex overflow-y-auto \${className}\`,
        role: 'log',
        ...props
      }, children);
    };

    const ChatContainerContent = ({ children, className = '', ...props }) => {
      return React.createElement('div', {
        className: \`flex w-full flex-col \${className}\`,
        ...props
      }, children);
    };

    const ChatContainerScrollAnchor = ({ className = '', ...props }) => {
      return React.createElement('div', {
        className: \`h-px w-full shrink-0 scroll-mt-4 \${className}\`,
        'aria-hidden': 'true',
        ...props
      });
    };

    // Loader Components
    const CircularLoader = ({ className = '', size = 'md' }) => {
      const sizeClasses = { sm: 'size-4', md: 'size-5', lg: 'size-6' };
      return React.createElement('div', {
        className: \`border-primary animate-spin rounded-full border-2 border-t-transparent \${sizeClasses[size]} \${className}\`
      }, React.createElement('span', { className: 'sr-only' }, 'Loading'));
    };

    const ClassicLoader = ({ className = '', size = 'md' }) => {
      const sizeClasses = { sm: 'size-4', md: 'size-5', lg: 'size-6' };
      return React.createElement('div', {
        className: \`relative \${sizeClasses[size]} \${className}\`
      }, React.createElement('span', { className: 'sr-only' }, 'Loading'));
    };

    const PulseLoader = ({ className = '', size = 'md' }) => {
      const sizeClasses = { sm: 'size-4', md: 'size-5', lg: 'size-6' };
      return React.createElement('div', {
        className: \`relative \${sizeClasses[size]} \${className}\`
      }, React.createElement('div', {
        className: 'border-primary absolute inset-0 animate-[thin-pulse_1.5s_ease-in-out_infinite] rounded-full border-2'
      }), React.createElement('span', { className: 'sr-only' }, 'Loading'));
    };

    const DotsLoader = ({ className = '', size = 'md' }) => {
      const dotSizes = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2', lg: 'h-2.5 w-2.5' };
      const containerSizes = { sm: 'h-4', md: 'h-5', lg: 'h-6' };
      return React.createElement('div', {
        className: \`flex items-center space-x-1 \${containerSizes[size]} \${className}\`
      }, [...Array(3)].map((_, i) => React.createElement('div', {
        key: i,
        className: \`bg-primary animate-[bounce-dots_1.4s_ease-in-out_infinite] rounded-full \${dotSizes[size]}\`,
        style: { animationDelay: \`\${i * 160}ms\` }
      })), React.createElement('span', { className: 'sr-only' }, 'Loading'));
    };

    const Badge = ({ children, className = "", variant = "default", ...props }) => {
      const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80"
      };

      return (
        <div
          className={\`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors \${variants[variant]} \${className}\`}
          {...props}
        >
          {children}
        </div>
      );
    };

    // Mock Lucide Icons (common set)
    const iconProps = { className: "w-4 h-4", strokeWidth: 2, fill: "none", stroke: "currentColor" };
    const LucideIcon = ({ d, ...props }) => (
      React.createElement('svg', {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        ...iconProps,
        ...props
      }, React.createElement('path', { d }))
    );

    const Zap = (props) => React.createElement(LucideIcon, { d: "M13 2L3 14h8l-1 8 10-12h-8l1-8z", ...props });
    const Shield = (props) => React.createElement(LucideIcon, { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", ...props });
    const Smartphone = (props) => React.createElement(LucideIcon, { d: "M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5 18h.01", ...props });
    const Globe = (props) => React.createElement(LucideIcon, { d: "M21.54 15H17a2 2 0 0 0-2 2v4.54M7 3.34V5a3 3 0 0 0 3 3h0a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h3.17M11 21.95V18a2 2 0 0 0-2-2v0a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05", ...props });
    const Users = (props) => React.createElement(LucideIcon, { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75", ...props });
    const BarChart3 = (props) => React.createElement(LucideIcon, { d: "M3 3v18h18M18 17V9M13 17V5M8 17v-3", ...props });
    const Lightbulb = (props) => React.createElement(LucideIcon, { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4", ...props });
    const HeartHandshake = (props) => React.createElement(LucideIcon, { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z", ...props });
    const TrendingUp = (props) => React.createElement(LucideIcon, { d: "m22 7-8.5 8.5-5-5L2 17M16 7h6v6", ...props });
    const TrendingDown = (props) => React.createElement(LucideIcon, { d: "m22 17-8.5-8.5-5 5L2 7M16 17h6v-6", ...props });
    const Minus = (props) => React.createElement(LucideIcon, { d: "M5 12h14", ...props });
    const Star = (props) => React.createElement(LucideIcon, { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", ...props });
    const Check = (props) => React.createElement(LucideIcon, { d: "M20 6L9 17l-5-5", ...props });
    const X = (props) => React.createElement(LucideIcon, { d: "M18 6L6 18M6 6l12 12", ...props });

    // Auto-stub JSX tag components used in the code
    const jsxTags = Array.from(originalCode.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)).map(m => m[1]);
    const knownStubs = new Set(['Card','CardHeader','CardTitle','CardDescription','CardContent','CardFooter','Button','Badge','Zap','Shield','Smartphone','Globe','Users','BarChart3','Lightbulb','HeartHandshake','TrendingUp','TrendingDown','Minus','Star','Check','X']);
    const uniqueTags = [...new Set(jsxTags)].filter(n => !knownStubs.has(n));
    uniqueTags.forEach(name => {
      if (typeof window[name] === 'undefined') {
        window[name] = ({ children, className = '', ...props }) => React.createElement('div', { className, ...props }, children);
      }
    });

    try {
      // Process user's component code to handle imports/exports
      const processedCode = originalCode
        .replace(/import\\s+.*?from\\s+['"].*?['"]/gs, '')
        .replace(/export\\s+default\\s+/g, '')
        .replace(/export\\s+/g, '');

      // Transform TSX/JSX to JS
      const transformed = Babel.transform(processedCode, { 
        filename: 'component.tsx',
        presets: [["react", { runtime: "automatic" }], "typescript"] 
      }).code;

      // Evaluate the transformed code
      eval(transformed);

      // Try to render the component
      const root = ReactDOM.createRoot(document.getElementById('root'));

      // Detect component name from original code
      const nameMatch = originalCode.match(/export\\s+(?:default\\s+)?(?:function|const|class)\\s+([A-Z]\w*)/);
      const componentName = nameMatch ? nameMatch[1] : (uniqueTags.find(tag => tag.charAt(0) === tag.charAt(0).toUpperCase() && tag !== 'React.Fragment') || (uniqueTags.length > 0 ? uniqueTags[0] : undefined));

      let Comp;
      try { Comp = eval(componentName); } catch (e) { Comp = window[componentName]; }

      if (Comp) {
        root.render(React.createElement(Comp));
        window.parent.postMessage({ type: 'preview-ready' }, '*');
      } else {
        throw new Error('No component found to render. Make sure to export your component or that it is the main component in the file.');
      }
    } catch (error) {
      document.getElementById('root').innerHTML = \`<div class="error">Preview Error: \${error.message}</div>\`;
      window.parent.postMessage({ type: 'preview-error', error: error.message }, '*');
    }
  </script>
</body>
</html>
      `;

      // Set iframe content
      const blob = new Blob([previewHTML], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      // Cleanup
      return () => URL.revokeObjectURL(url);
    }
  }, [code, activeTab]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "preview-ready") {
        setIsLoading(false);
      } else if (event.data.type === "preview-error") {
        setPreviewError(event.data.error);
        setIsLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preview" | "code")} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <EyeIcon className="h-4 w-4" />
          Preview
        </TabsTrigger>
        <TabsTrigger value="code" className="flex items-center gap-2">
          <Code2Icon className="h-4 w-4" />
          Code
        </TabsTrigger>
      </TabsList>

      <TabsContent value="preview" className="mt-4">
        {previewError ? (
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>
              Preview Error: {previewError}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setActiveTab("code")}
              >
                View Code
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="relative rounded-lg border bg-white">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Loader2Icon className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading preview...</span>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              className="h-[600px] w-full rounded-lg"
              title="Component Preview"
              sandbox="allow-scripts"
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="code" className="mt-4">
        <CodeBlock code={code} language={language} showLineNumbers={showLineNumbers}>
          <CodeBlockCopyButton />
        </CodeBlock>
      </TabsContent>
    </Tabs>
  );
}
