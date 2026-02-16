"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { BlueprintGrid } from "./blueprint-grid";
import {
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Eye,
  Copy,
  Check,
  Terminal,
  ArrowUpRight,
  RotateCcw,
  Maximize2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { ComponentPreview } from "@/components/component-preview";
import { useTheme } from "next-themes";

interface RegistryBlockProps {
  name: string;
  title: string;
  description: string;
  index: number;
  code: string;
  category?: string;
  installCommand?: string;
  githubUrl?: string;
  docsUrl?: string;
}

export function RegistryBlock({
  name,
  title,
  description,
  index,
  code,
  category,
  installCommand,
  githubUrl,
  docsUrl,
}: RegistryBlockProps) {
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");
  const [viewport, setViewport] = useState<number>(100);
  const [isCopied, setIsCopied] = useState(false);
  const [isInstallCopied, setIsInstallCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const panelRef = React.useRef<ImperativePanelHandle>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleViewportResize = (size: number) => {
    setIsResizing(true);
    setIsPulling(false);
    setViewport(size);
    setActiveView("preview");
    panelRef.current?.resize(size);
    setTimeout(() => setIsResizing(false), 500);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // If we're not at full size, pull back
    if (viewport < 100) {
      setIsResizing(true);
      setIsPulling(true);
      setViewport(100);
      panelRef.current?.resize(100);
      setTimeout(() => {
        setIsResizing(false);
        setIsPulling(false);
      }, 500);
    }
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

  const copyInstallCommand = async () => {
    if (!installCommand) return;
    try {
      await navigator.clipboard.writeText(installCommand);
      setIsInstallCopied(true);
      setTimeout(() => setIsInstallCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy command!", err);
    }
  };

  const openInV0 = () => {
    window.open(
      `https://v0.dev/chat/api/open?url=https://shadway.online/r/${name}.json`,
      "_blank",
    );
  };

  const monacoRef = React.useRef<any>(null);

  const handleBeforeMount = (monaco: any) => {
    monacoRef.current = monaco;
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

  React.useEffect(() => {
    if (monacoRef.current && mounted) {
      const theme =
        resolvedTheme === "light" ? "shadway-light" : "shadway-dark";
      monacoRef.current.editor.setTheme(theme);
    }
  }, [resolvedTheme, mounted]);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "UPDATE_THEME", theme: resolvedTheme },
        "*",
      );
    }
  }, [resolvedTheme]);

  return (
    <div className="group relative flex flex-col space-y-0 transition-all duration-300">
      <div className="relative py-4 px-6 md:px-12 flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-visible">
        {/* Subtle Index */}
        <div className="absolute left-6 -top-8 z-0 pointer-events-none hidden md:block select-none overflow-hidden text-[140px] font-black text-foreground/3 leading-none tracking-tighter">
          {String(index + 1).padStart(2, "0")}
        </div>

        <div className="flex flex-col gap-3 relative z-10 px-0">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold text-primary px-2 py-1 border border-primary/20 bg-primary/5 rounded md:hidden uppercase tracking-widest">
              Block {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-4xl md:text-6xl font-medium tracking-tight leading-none">
              {title || name}
              <span className="text-muted-foreground/40 font-serif italic text-3xl md:text-5xl ml-1">
                Archive.
              </span>
            </h3>
          </div>
          <p className="text-base text-muted-foreground/60 max-w-2xl leading-relaxed italic font-light">
            {description}
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center z-10 pb-2 md:pb-0">
          <div className="flex items-center gap-1 p-1 bg-muted/20 border border-border/40 rounded-none">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("preview")}
              className={cn(
                "h-8 gap-2 px-4 text-[10px] uppercase tracking-widest font-bold relative z-10 transition-colors duration-200 rounded-none",
                activeView === "preview"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
              {activeView === "preview" && (
                <motion.div
                  layoutId={`view-tab-${index}`}
                  className="absolute inset-0 bg-background shadow-sm border border-border/20 -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("code")}
              className={cn(
                "h-8 gap-2 px-4 text-[10px] uppercase tracking-widest font-bold relative z-10 transition-colors duration-200 rounded-none",
                activeView === "code"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
              {activeView === "code" && (
                <motion.div
                  layoutId={`view-tab-${index}`}
                  className="absolute inset-0 bg-background shadow-sm border border-border/20 -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Button>

            <div className="h-4 w-px bg-border/20 mx-1" />

            <div className="flex items-center gap-1">
              {[Smartphone, Tablet, Monitor].map((Icon, i) => {
                const sizes = [35, 60, 100];
                const labels = ["Mobile", "Tablet", "Desktop"];
                const isActive =
                  viewport === sizes[i] && activeView === "preview";

                return (
                  <Button
                    key={labels[i]}
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewportResize(sizes[i])}
                    className={cn(
                      "h-8 w-8 relative z-10 transition-colors rounded-none",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title={labels[i]}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {isActive && (
                      <motion.div
                        layoutId={`device-tab-${index}`}
                        className="absolute inset-0 bg-background shadow-sm border border-border/20 -z-10"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                      />
                    )}
                  </Button>
                );
              })}

              <div className="h-4 w-px bg-border/20 mx-1" />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(`/preview/${name}`, "_blank")}
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-none transition-colors"
                title="Open in New Window"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="relative border-y border-border/40 overflow-hidden bg-background mt-4"
        style={{ height: 600 }}
      >
        <AnimatePresence mode="wait">
          {activeView === "preview" ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              {/* Static Background Layer */}
              <div className="absolute inset-0 h-full w-full bg-slate-950/2 z-0">
                <div
                  className="absolute inset-0 opacity-[0.15] dark:opacity-[0.2] pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(circle, var(--foreground) 1px, transparent 1px)`,
                    backgroundSize: "32px 32px",
                  }}
                />
              </div>

              <ResizablePanelGroup
                direction="horizontal"
                className="h-full w-full relative z-10 overflow-visible"
                onLayout={(sizes) => {
                  if (!isPulling) {
                    setViewport(sizes[0]);
                  }
                }}
              >
                <BlueprintGrid />
                <ResizablePanel
                  ref={panelRef}
                  defaultSize={viewport}
                  minSize={30}
                  className={cn(
                    "relative flex items-center justify-center bg-muted/5",
                    (isResizing || isPulling) &&
                      "transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
                  )}
                >
                  <div className="w-full h-full relative">
                    <iframe
                      ref={iframeRef}
                      src={`/preview/${name}`}
                      className="w-full h-full border-0 bg-background shadow-sm overflow-hidden"
                      title={`${name} preview`}
                      loading="eager"
                      onLoad={(e) => {
                        // Optional: could stop a loading spinner here
                        const iframe = e.currentTarget;
                        if (iframe.contentWindow) {
                          iframe.contentWindow.postMessage(
                            { type: "UPDATE_THEME", theme: resolvedTheme },
                            "*",
                          );
                        }
                      }}
                    />
                  </div>
                  {/* Reload Button Overlay */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (iframeRef.current) {
                        iframeRef.current.src = iframeRef.current.src;
                      }
                    }}
                    className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-dashed border-border hover:bg-background hover:border-primary/50 transition-all shadow-lg z-50 pointer-events-auto"
                    title="Reload Preview"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </ResizablePanel>
                <ResizableHandle
                  withHandle={false}
                  className="relative w-px bg-border/20 transition-all hover:bg-primary/40 group/handle z-100 overflow-visible cursor-col-resize flex items-center justify-center p-0 touch-none"
                  onPointerDown={() => {
                    setIsDragging(true);
                    setIsResizing(false);
                    setIsPulling(false);
                  }}
                  onPointerUp={handleDragEnd}
                >
                  {/* Sleek Floating Icon Handle */}
                  <div className="z-110 pointer-events-none absolute left-1/2 -translate-x-1/2">
                    <motion.div
                      animate={{
                        scale: isDragging ? 1.2 : 1,
                        backgroundColor:
                          resolvedTheme === "dark" ? "#18181b" : "#ffffff",
                        borderColor: isDragging
                          ? "var(--primary)"
                          : "var(--border)",
                      }}
                      whileHover={{ scale: 1.1 }}
                      className="w-8 h-8 rounded-full border shadow-lg flex items-center justify-center transition-all duration-300"
                    >
                      <GripVertical
                        className={cn(
                          "w-3.5 h-3.5 transition-colors",
                          isDragging ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </motion.div>
                  </div>
                </ResizableHandle>
                <ResizablePanel
                  defaultSize={100 - viewport}
                  minSize={0}
                  className={cn(
                    "bg-transparent",
                    (isResizing || isPulling) &&
                      "transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
                  )}
                >
                  {/* Transparent spacer to reveal static background */}
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
              <div className="flex items-center justify-between px-8 py-4 border-b border-border/20 bg-muted/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 group/file">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover/file:bg-primary transition-colors" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-medium text-muted-foreground">
                      {name}.tsx
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[10px] uppercase tracking-widest font-bold border border-border/20 rounded-none gap-2 px-4 transition-all hover:bg-muted/10"
                    onClick={copyToClipboard}
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {isCopied ? "Done" : "Copy"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[10px] uppercase tracking-widest font-bold text-white px-4 bg-primary rounded-none gap-2 hover:bg-primary/90 transition-all"
                    onClick={openInV0}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    V0 Open
                  </Button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  value={code}
                  beforeMount={handleBeforeMount}
                  theme={
                    mounted
                      ? resolvedTheme === "light"
                        ? "shadway-light"
                        : "shadway-dark"
                      : "shadway-dark"
                  }
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    padding: { top: 10, bottom: 20 },
                    fontFamily:
                      "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                    renderLineHighlight: "none",
                    scrollbar: {
                      vertical: "hidden",
                      horizontal: "hidden",
                    },
                    folding: true,
                    lineDecorationsWidth: 10,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Install Command */}
      <div className="py-6 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        {installCommand ? (
          <div
            className="flex items-center gap-3 cursor-pointer group/cmd"
            onClick={copyInstallCommand}
          >
            <div
              className={cn(
                "relative h-9 px-4 bg-background hover:bg-muted transition-colors border border-border/40 rounded-none flex items-center gap-3 select-none overflow-hidden",
                isInstallCopied && "border-primary/40 bg-primary/5",
              )}
            >
              <AnimatePresence mode="wait">
                {isInstallCopied ? (
                  <motion.div
                    key="copied"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-primary"
                  >
                    <Check className="w-3 h-3" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest">
                      Added to clipboard
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="command"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Terminal className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono text-[10px] font-medium text-muted-foreground/60 group-hover/cmd:text-foreground/80 transition-colors">
                      npx shadway add {name}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40">
          <a
            href={docsUrl || `/docs/${category || "ui"}#${name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors flex items-center gap-1.5"
          >
            Blocks <ArrowUpRight className="w-3 h-3 opacity-40" />
          </a>
          <a
            href={
              githubUrl ||
              `https://github.com/moazamtech/shadway/blob/main/registry/${category || "ui"}/${name}.tsx`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors flex items-center gap-1.5"
          >
            Source Code <ArrowUpRight className="w-3 h-3 opacity-40" />
          </a>
        </div>
      </div>

      {/* Line Separator */}
      <div className="h-px w-full bg-border/10 mt-20" />
    </div>
  );
}
