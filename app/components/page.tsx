"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Copy, 
  Check, 
  Eye, 
  Code, 
  ExternalLink,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Component {
  name: string;
  description: string;
  code: string;
  installCommand: string;
  preview: React.ComponentType;
}

// Preview Components
const AlertPreview = () => (
  <div className="w-full p-6 bg-background border border-border rounded-lg">
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
        <div className="w-2.5 h-2.5 bg-destructive rounded-full" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-destructive mb-1">Error</h4>
        <p className="text-sm text-destructive/80">
          Your session has expired. Please log in again.
        </p>
      </div>
    </div>
  </div>
);

const ButtonPreview = () => (
  <div className="w-full p-6 bg-background border border-border rounded-lg">
    <div className="flex items-center gap-4 flex-wrap">
      <Button>Primary Button</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  </div>
);

const components: Component[] = [
  {
    name: "Alert",
    description: "Display important messages and notifications to users with different variants and styles.",
    installCommand: "npx shadcn-ui@latest add alert",
    preview: AlertPreview,
    code: `import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function AlertDemo() {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        Your session has expired. Please log in again.
      </AlertDescription>
    </Alert>
  )
}`
  },
  {
    name: "Button",
    description: "Interactive elements for user actions and navigation with multiple variants and sizes.",
    installCommand: "npx shadcn-ui@latest add button",
    preview: ButtonPreview,
    code: `import { Button } from "@/components/ui/button"

export function ButtonDemo() {
  return (
    <div className="flex items-center gap-4">
      <Button>Primary Button</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  )
}`
  }
];

export default function ComponentsPage() {
  const [activeTab, setActiveTab] = useState<Record<string, 'preview' | 'code'>>({});
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const getActiveTab = (componentName: string) => activeTab[componentName] || 'preview';

  const handleTabChange = (componentName: string, tab: 'preview' | 'code') => {
    setActiveTab(prev => ({ ...prev, [componentName]: tab }));
  };

  const copyToClipboard = async (text: string, componentName: string, type: 'code' | 'command') => {
    try {
      await navigator.clipboard.writeText(text);
      const key = `${componentName}-${type}`;
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const openInV0 = (componentName: string) => {
    const v0Url = `https://v0.dev/chat?q=Create a ${componentName.toLowerCase()} component similar to shadcn/ui`;
    window.open(v0Url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full px-4 py-12 md:px-8 md:py-16">
        {/* Header */}
        <section className="mb-16 text-center space-y-6 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tighter">
            COMPONENTS<span className="text-primary">.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground font-light">
            Beautiful, accessible UI components.
            <br className="hidden sm:block" />
            Copy the code and customize to fit your needs.
          </p>
        </section>

        {/* Components List */}
        <div className="max-w-6xl mx-auto space-y-12">
          {components.map((component, index) => {
            const PreviewComponent = component.preview;
            const currentTab = getActiveTab(component.name);
            const codeKey = `${component.name}-code`;
            const commandKey = `${component.name}-command`;
            
            return (
              <motion.div
                key={component.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-border rounded-xl overflow-hidden bg-card"
              >
                {/* Component Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono text-muted-foreground/60">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h2 className="text-2xl font-bold tracking-tight">{component.name}</h2>
                      </div>
                      <p className="text-muted-foreground">{component.description}</p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInV0(component.name)}
                        className="gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in v0
                      </Button>
                    </div>
                  </div>

                  {/* Install Command */}
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <Terminal className="w-4 h-4 text-muted-foreground" />
                        <code className="text-sm font-mono">{component.installCommand}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(component.installCommand, component.name, 'command')}
                        className="gap-2 h-8"
                      >
                        {copiedStates[commandKey] ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedStates[commandKey] ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="px-6 pt-4">
                  <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
                    <button
                      onClick={() => handleTabChange(component.name, 'preview')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        currentTab === 'preview'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                    <button
                      onClick={() => handleTabChange(component.name, 'code')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        currentTab === 'code'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Code className="w-4 h-4" />
                      Code
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 pt-4">
                  {currentTab === 'preview' ? (
                    <div className="rounded-lg border border-border bg-background p-1">
                      <PreviewComponent />
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute top-3 right-3 z-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(component.code, component.name, 'code')}
                          className="gap-2 h-8"
                        >
                          {copiedStates[codeKey] ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {copiedStates[codeKey] ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
                        <code className="text-sm font-mono">{component.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}