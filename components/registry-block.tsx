"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  Code2, 
  Eye, 
  Copy, 
  Check, 
  ExternalLink,
  Terminal,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { ComponentPreview } from "@/components/component-preview";
import { BorderBeam } from "@/components/ui/borderbeam";
import { useTheme } from "next-themes";

interface RegistryBlockProps {
  name: string;
  title: string;
  description: string;
  index: number;
  code: string;
  installCommand?: string;
}

export function RegistryBlock({ 
  name, 
  title, 
  description, 
  index, 
  code,
  installCommand 
}: RegistryBlockProps) {
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");
  const [viewport, setViewport] = useState<number>(100);
  const [isCopied, setIsCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const panelRef = React.useRef<ImperativePanelHandle>(null);
  const [isResizing, setIsResizing] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleViewportResize = (size: number) => {
    setIsResizing(true);
    setViewport(size);
    setActiveView("preview");
    panelRef.current?.resize(size);
    setTimeout(() => setIsResizing(false), 500);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const openInV0 = () => {
    const v0Url = `https://v0.dev/chat?q=${encodeURIComponent(code)}`;
    window.open(v0Url, "_blank", "noopener,noreferrer");
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Custom High-Fidelity Dark Theme
    monaco.editor.defineTheme("shadway-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "#ff5a5f", fontStyle: "bold" },
        { token: "tag", foreground: "#ff5a5f" },
        { token: "attribute.name", foreground: "#22d3ee" },
        { token: "string", foreground: "#fbbf24" },
        { token: "identifier", foreground: "#ffffff" },
        { token: "delimiter", foreground: "#ffffff" },
        { token: "type", foreground: "#ffffff" },
        { token: "comment", foreground: "#4b5563" },
      ],
      colors: {
        "editor.background": "#000000",
        "editor.lineHighlightBackground": "#ffffff05",
        "editorLineNumber.foreground": "#ffffff20",
        "editorIndentGuide.background": "#ffffff08",
        "editor.selectionBackground": "#3b82f630",
        "editorLineNumber.activeForeground": "#ffffff80",
      },
    });

    // Custom High-Fidelity Light Theme
    monaco.editor.defineTheme("shadway-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "#e11d48", fontStyle: "bold" },
        { token: "tag", foreground: "#e11d48" },
        { token: "attribute.name", foreground: "#0891b2" },
        { token: "string", foreground: "#d97706" },
        { token: "identifier", foreground: "#020617" },
        { token: "delimiter", foreground: "#020617" },
        { token: "type", foreground: "#020617" },
        { token: "comment", foreground: "#94a3b8" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.lineHighlightBackground": "#00000005",
        "editorLineNumber.foreground": "#00000020",
        "editorIndentGuide.background": "#00000008",
        "editor.selectionBackground": "#3b82f620",
        "editorLineNumber.activeForeground": "#00000080",
      },
    });
  };

  return (
    <div className="group relative flex flex-col space-y-0 py-16 transition-all duration-300">
      {/* Header: Large Numbering + Bold Title */}
      <div className="relative py-8 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-visible">
        {/* Massive Ghost Numbering */}
        <span className="text-8xl font-black text-foreground/[0.09] absolute -left-4 -top-8 tracking-tighter select-none pointer-events-none hidden md:block leading-none">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="flex flex-col gap-3 relative z-10 px-1">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono font-black text-primary px-2.5 py-1.5 border border-dashed border-primary/40 rounded bg-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.1)] md:hidden">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">
              {title || name}<span className="text-primary NOT_ITALIC">.</span>
            </h3>
          </div>
          <p className="text-sm text-muted-foreground/60 max-w-2xl leading-relaxed italic">
            {description}
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1 p-1.5 bg-muted/20 rounded-xl border border-dashed border-border z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("preview")}
            className={cn(
              "h-8 gap-2 px-4 text-[11px] uppercase tracking-widest font-black",
              activeView === "preview" && "bg-background shadow-md border border-dashed border-border text-primary"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("code")}
            className={cn(
              "h-8 gap-2 px-4 text-[11px] uppercase tracking-widest font-black",
              activeView === "code" && "bg-background shadow-md border border-dashed border-border text-primary"
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code
          </Button>
          
          <div className="h-4 w-px bg-border/40 mx-2" />
          
          <div className="flex items-center gap-1">
            {[Smartphone, Tablet, Monitor].map((Icon, i) => {
              const sizes = [35, 60, 100];
              const labels = ["Mobile", "Tablet", "Desktop"];
              return (
                <Button
                  key={labels[i]}
                  variant="ghost"
                  size="icon"
                  onClick={() => handleViewportResize(sizes[i])}
                  className={cn(
                    "h-8 w-8",
                    viewport === sizes[i] && activeView === "preview" && "bg-background border border-dashed border-border text-primary"
                  )}
                  title={labels[i]}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative border-l border-r border-dashed border-border overflow-hidden bg-background min-h-[500px]">
        <BorderBeam borderWidth={1.5} duration={10} delay={index * 2} className="from-transparent via-blue-500/40 to-transparent" />
        
        <AnimatePresence mode="wait">
          {activeView === "preview" ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <ResizablePanelGroup direction="horizontal">
                <ResizablePanel 
                  ref={panelRef}
                  defaultSize={viewport} 
                  minSize={30}
                  className={cn(
                    "relative flex items-center justify-center py-20 px-8 sm:px-16",
                    isResizing && "transition-all duration-500 ease-in-out"
                  )}
                >
                  <ComponentPreview name={name} />
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-border/40 hover:bg-primary/50 transition-colors w-1.5" />
                <ResizablePanel 
                  defaultSize={100 - viewport} 
                  minSize={0}
                  className={cn(isResizing && "transition-all duration-500 ease-in-out")}
                >
                  <div className="h-full w-full bg-slate-950/5 relative">
                     <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                          style={{ backgroundImage: `radial-gradient(circle, var(--foreground) 1.5px, transparent 1.5px)`, backgroundSize: '24px 24px' }} />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex flex-col h-[600px] transition-colors duration-300 bg-white dark:bg-black"
            >
              {/* Toolbar */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-dashed transition-colors duration-300 border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="p-2 border border-dashed rounded flex items-center gap-3 transition-colors duration-300 border-black/20 bg-black/5 dark:border-white/20 dark:bg-white/5">
                    <Terminal className="w-4 h-4 text-black/40 dark:text-white/40" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.3em] font-black text-black/40 dark:text-white/40">
                       {name}.tsx
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 text-[11px] font-black border border-dashed rounded-lg gap-2 px-5 transition-all text-black/40 hover:text-black hover:bg-black/5 border-black/10 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 dark:border-white/10"
                    onClick={copyToClipboard}
                  >
                    {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? "COPIED" : "COPY SOURCE"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 text-[11px] font-black text-white px-5 bg-primary/20 border border-dashed border-primary/40 rounded-lg gap-2 hover:bg-primary/40 transition-all shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                    onClick={openInV0}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    OPEN IN V0
                  </Button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  value={code}
                  onMount={handleEditorDidMount}
                  theme={mounted ? (resolvedTheme === "light" ? "shadway-light" : "shadway-dark") : "shadway-dark"}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    padding: { top: 10, bottom: 20 },
                    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                    renderLineHighlight: "none",
                    scrollbar: {
                      vertical: "hidden",
                      horizontal: "hidden"
                    },
                    folding: true,
                    lineDecorationsWidth: 10,
                  }}
                />
              </div>
              
              <BorderBeam borderWidth={1.5} duration={8} className="from-transparent via-white/15 to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Install Command */}
      <div className="border-b border-dashed border-border py-4 px-1 flex flex-col sm:flex-row items-center justify-between gap-6">
        {installCommand ? (
          <div className="flex items-center gap-3 group/cmd cursor-pointer" onClick={() => navigator.clipboard.writeText(installCommand)}>
             <div className="h-8 px-4 bg-primary/5 border border-dashed border-primary/30 rounded-lg flex items-center gap-3 transition-all group-hover/cmd:bg-primary/10 group-hover/cmd:border-primary/50">
               <Terminal className="w-3.5 h-3.5 text-primary" />
               <span className="font-mono text-[11px] font-black text-primary tracking-tight">{installCommand}</span>
               <Copy className="w-3 h-3 text-primary/30 group-hover/cmd:text-primary transition-colors" />
             </div>
          </div>
        ) : <div />}
        
        <div className="flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
           <a href="#" className="hover:text-primary transition-colors flex items-center gap-1.5">Docs <ArrowUpRight className="w-3 h-3" /></a>
           <a href="#" className="hover:text-primary transition-colors flex items-center gap-1.5">Props <ArrowUpRight className="w-3 h-3" /></a>
           <a href="#" className="hover:text-primary transition-colors flex items-center gap-1.5">Github <ArrowUpRight className="w-3 h-3" /></a>
        </div>
      </div>
    </div>
  );
}
