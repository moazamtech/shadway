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
  Terminal,
  ArrowUpRight,
  RotateCcw,
  Maximize2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const [viewport, setViewport] = useState<number>(100); // percentage 25-100
  const [isCopied, setIsCopied] = useState(false);
  const [isInstallCopied, setIsInstallCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(800);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = React.useState(0);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageWidth(el.offsetWidth);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const MIN_VIEWPORT = 25;
  const isPreview = activeView === "preview";
  // Single rendering mode: the iframe always renders at the actual visible width,
  // no scaling. At 100% that equals the full stage (≥ lg breakpoint → desktop
  // layout); sliding narrows the iframe and the component reflows responsively
  // through its md:/sm: breakpoints. No jump because there's no scale boundary.
  const visibleWidth =
    stageWidth > 0 ? Math.round((stageWidth * viewport) / 100) : 0;
  const iframeRenderWidth = visibleWidth > 0 ? visibleWidth : 0;
  const visibleScale = 1;
  const visibleHeight = previewHeight;
  const containerHeight = isPreview
    ? Math.max(160, visibleHeight)
    : 600;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.source === iframeRef.current?.contentWindow &&
        event.data?.type === "PREVIEW_HEIGHT" &&
        typeof event.data.height === "number"
      ) {
        setPreviewHeight(Math.max(320, event.data.height));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleViewportResize = (size: number) => {
    setIsResizing(true);
    setViewport(size);
    setActiveView("preview");
    setTimeout(() => setIsResizing(false), 500);
  };

  // Pointer-driven drag for the right-edge handle
  const dragStateRef = React.useRef<{
    startX: number;
    startViewport: number;
    stageW: number;
  } | null>(null);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStateRef.current = {
      startX: e.clientX,
      startViewport: viewport,
      stageW: stageRef.current.offsetWidth,
    };
    setIsDragging(true);
    setIsResizing(false);
  };

  const measureIframeContentHeight = React.useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      const root =
        (doc?.querySelector("[data-preview-root]") as HTMLElement | null) ||
        (doc?.body as HTMLElement | null);
      if (root) {
        setPreviewHeight(Math.max(320, root.scrollHeight));
      }
    } catch {
      // cross-origin or not ready — ignore, postMessage handler will catch up
    }
  }, []);

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStateRef.current;
    if (!s || s.stageW <= 0) return;
    const deltaPct = ((e.clientX - s.startX) / s.stageW) * 100;
    const next = Math.min(100, Math.max(MIN_VIEWPORT, s.startViewport + deltaPct));
    setViewport(next);
    // Read content height directly after the browser reflows the iframe at the new width
    requestAnimationFrame(measureIframeContentHeight);
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragStateRef.current = null;
    setIsDragging(false);
    // Snap back to full when released below 100%
    if (viewport < 100) {
      setIsResizing(true);
      setViewport(100);
      // Re-measure once the iframe reflows at 1440 so the height tracks the snap-back
      requestAnimationFrame(() => requestAnimationFrame(measureIframeContentHeight));
      setTimeout(() => setIsResizing(false), 400);
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
      <div className="relative py-4 px-4 sm:px-6 md:px-12 flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 overflow-visible">
        {/* Subtle Index */}
        <div className="absolute left-6 -top-8 z-0 pointer-events-none hidden md:block select-none overflow-hidden text-[140px] font-black text-foreground/3 leading-none tracking-tighter">
          {String(index + 1).padStart(2, "0")}
        </div>

        <div className="flex flex-col gap-3 relative z-10 px-0 min-w-0">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold text-primary px-2 py-1 border border-primary/20 bg-primary/5 rounded md:hidden uppercase tracking-widest">
              Block {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-none break-words">
              {title || name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
            </h3>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground/60 max-w-2xl leading-relaxed italic font-light">
            {description}
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center z-10 pb-2 md:pb-0 -mx-1 overflow-x-auto md:overflow-visible">
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
                  Math.abs(viewport - sizes[i]) < 0.5 &&
                  activeView === "preview";

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
        className={cn(
          "relative border-y border-border/40 overflow-visible bg-background mt-4",
          // Only animate height when not actively dragging, so height tracks every frame during slide
          !isDragging && "transition-[height] duration-300",
        )}
        style={{ height: activeView === "code" ? 600 : containerHeight }}
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
              {/* Dot-grid background fills the whole stage; iframe sits on top */}
              <div className="absolute inset-0 z-0 bg-background pointer-events-none">
                <div
                  className="absolute inset-0 opacity-[0.18] dark:opacity-[0.22]"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1.5px 1.5px, var(--foreground) 1.2px, transparent 0)`,
                    backgroundSize: "32px 32px",
                  }}
                />
                <div className="absolute inset-0 bg-linear-to-tr from-primary/[0.03] via-transparent to-transparent" />
              </div>

              <div
                ref={stageRef}
                className="relative h-full w-full z-10"
              >
                {/* 1. Pill icon — rendered FIRST so it sits behind the iframe wrapper.
                       At viewport=100% only its right half pokes out past the iframe's
                       right edge; the left half is hidden behind the iframe's bg-background. */}
                <div
                  className={cn(
                    "pointer-events-none absolute z-[15]",
                    isResizing && !isDragging && "transition-[left] duration-400 ease-out",
                  )}
                  style={{
                    left: visibleWidth > 0 ? visibleWidth : "100%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <motion.div
                    animate={{ scale: isDragging ? 1.12 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={cn(
                      "h-10 w-5 rounded-full border bg-accent shadow-md flex items-center justify-center transition-colors duration-200",
                      isDragging
                        ? "border-primary shadow-lg shadow-primary/20"
                        : "border-border",
                    )}
                  >
                    <GripVertical
                      className={cn(
                        "w-3 h-3 transition-colors duration-200",
                        isDragging ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </motion.div>
                </div>

                {/* 2. Iframe wrapper — rendered AFTER the pill, so its bg-background
                       sits on top of and clips the pill's left half. */}
                <div
                  className={cn(
                    "relative z-[20] h-full overflow-hidden bg-background",
                    isResizing && !isDragging && "transition-[width] duration-400 ease-out",
                  )}
                  style={{
                    width: visibleWidth > 0 ? visibleWidth : "100%",
                  }}
                >
                  <div
                    style={{
                      width: iframeRenderWidth,
                      height: previewHeight,
                      transform: `scale(${visibleScale})`,
                      transformOrigin: "top left",
                      position: "absolute",
                      top: 0,
                      left: 0,
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      src={`/preview/${name}`}
                      style={{
                        width: iframeRenderWidth,
                        height: previewHeight,
                        display: "block",
                        border: "none",
                      }}
                      className="bg-background"
                      title={`${name} preview`}
                      loading="lazy"
                      onLoad={(e) => {
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
                    className="absolute bottom-4 right-4 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-dashed border-border hover:bg-background hover:border-primary/50 transition-all shadow-lg z-30 pointer-events-auto"
                    title="Reload Preview"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>

                {/* 3. Vertical guide line — sits exactly on the iframe's right edge,
                       on top of the wrapper and the half-hidden pill. Same color as
                       the pill border so they read as one continuous element. */}
                <div
                  className={cn(
                    "pointer-events-none absolute top-0 bottom-0 w-px z-[10] transition-colors duration-200",
                    isDragging ? "bg-primary" : "bg-border",
                    isResizing && !isDragging && "transition-[left,background-color] duration-[400ms] ease-out",
                  )}
                  style={{
                    left: visibleWidth > 0 ? visibleWidth : "100%",
                    transform: "translateX(-0.5px)",
                  }}
                />

                {/* 4. Drag hit zone — invisible, captures all pointer events along
                       the line and over the visible right half of the pill. */}
                <div
                  onPointerDown={onHandlePointerDown}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                  className={cn(
                    "absolute top-0 bottom-0 z-[30] cursor-col-resize touch-none",
                    isResizing && !isDragging && "transition-[left] duration-[400ms] ease-out",
                  )}
                  style={{
                    left: visibleWidth > 0 ? visibleWidth : "100%",
                    width: 32,
                    transform: "translateX(-16px)",
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex flex-col h-full transition-colors duration-300 bg-white dark:bg-black"
            >
              <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-4 border-b border-border/20 bg-muted/5 transition-colors">
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

              <div className="flex-1 p-3 sm:p-4 overflow-hidden">
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
      <div className="py-6 px-4 sm:px-6 md:px-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
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
