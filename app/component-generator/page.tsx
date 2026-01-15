"use client";

import { GeneratorHeader } from "@/app/component-generator/components/generator-header";
import { SandpackRuntimePreview } from "@/components/sandpack-preview";
import { FileTree } from "@/app/component-generator/components/file-tree";
import { SuggestionsGrid } from "@/app/component-generator/components/suggestions-grid";
import Image from "next/image";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import AIResponse from "@/components/ui/chatresponse";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  SparklesIcon,
  XIcon,
  Code2Icon,
  FileCode2Icon,
  CopyIcon,
  CheckIcon,
  CodeIcon,
  EyeIcon,
  FileIcon,
  FileJson,
  Hash,
  Zap,
  Maximize2Icon,
  Minimize2Icon,
  PaperclipIcon,
  ChevronRight,
  Loader2,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { ColorSchemeEditor } from "@/components/color-scheme-editor";
import {
  ColorSchemeConfig,
  defaultColorSchemeConfig,
} from "@/lib/color-scheme";
import { StickToBottom } from "use-stick-to-bottom";

type GeneratorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoning_details?: any; // Native OR reasoning
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  timestamp: Date;
};

type GeneratedComponent = {
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
  language: string;
  title: string;
};

const FileIconComponent = ({ path, className }: { path: string; className?: string }) => {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (ext === "tsx" || ext === "jsx") return <FileCode2Icon className={cn("h-4 w-4 text-cyan-500", className)} />;
  if (ext === "ts" || ext === "js") return <Code2Icon className={cn("h-4 w-4 text-blue-500", className)} />;
  if (ext === "css") return <Hash className={cn("h-4 w-4 text-purple-500", className)} />;
  if (ext === "json") return <FileJson className={cn("h-4 w-4 text-amber-500", className)} />;
  return <FileIcon className={cn("h-4 w-4 text-muted-foreground", className)} />;
};

// ChevronRight is imported from Lucide

// Thinking Component
function ThinkingProcess({
  content,
  isFinished,
}: {
  content: string;
  isFinished?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (!content) return null;

  return (
    <div className="group/thinking mb-4 overflow-hidden rounded-2xl border border-primary/10 bg-primary/[0.02] transition-all duration-300 hover:bg-primary/[0.04]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-5 w-5 items-center justify-center">
            {!isFinished ? (
              <>
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <SparklesIcon className="relative h-3.5 w-3.5 text-primary animate-pulse" />
              </>
            ) : (
              <Zap className="h-3.5 w-3.5 text-primary/60" />
            )}
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary/70">
            {isFinished ? "Architectural Plan" : "Deep Thinking..."}
          </span>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 opacity-40 group-hover/thinking:opacity-80 transition-all duration-300",
            isOpen && "rotate-90"
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-4 pb-4">
              <div className="relative rounded-xl bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground/80 font-mono shadow-inner border border-primary/5">
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-primary/20" />
                {content}
                {!isFinished && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary/40 animate-pulse align-middle" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Code Block Component with Copy Functionality
function CodeBlock({
  code,
  language = "tsx",
  onRun,
  isActive,
}: {
  code: string;
  language?: string;
  onRun?: () => void;
  isActive?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  return (
    <div className="relative group my-4 rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex h-16 items-center justify-between px-4 md:px-8 lg:px-12 w-full border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <CodeIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRun && (
            <button
              onClick={onRun}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary/30"
                  : "text-foreground hover:text-primary bg-background hover:bg-accent",
              )}
            >
              {isActive ? (
                <>
                  <Zap className="h-3 w-3" />
                  Running
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3" />
                  Run
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground hover:text-primary bg-background hover:bg-accent rounded-md transition-all duration-200 border"
          >
            {copied ? (
              <>
                <CheckIcon className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto bg-muted/10 no-scrollbar">
        <pre className="p-4 text-xs leading-relaxed font-mono">
          <code className="text-foreground/90">{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Smart AI-powered suggestions for component blocks
type Suggestion = {
  emoji: string;
  title: string;
  prompt: string;
};

const SMART_SUGGESTIONS: Suggestion[] = [
  {
    emoji: "✨",
    title: "Hero Section",
    prompt:
      "Create a modern hero section with a large headline, subtext, CTA buttons, and a gradient background. Include subtle animations and responsive design.",
  },
  {
    emoji: "🧭",
    title: "Navigation Header",
    prompt:
      "Build a responsive navigation header with logo, nav links, and a mobile hamburger menu. Include smooth transitions and sticky positioning.",
  },
  {
    emoji: "💰",
    title: "Pricing Cards",
    prompt:
      "Create a pricing section with 3 tier cards (Basic, Pro, Enterprise). Include feature lists, highlighted recommended plan, and CTA buttons.",
  },
  {
    emoji: "🎯",
    title: "Features Grid",
    prompt:
      "Build a features section with a grid of feature cards. Each card has an icon, title, and description. Include hover effects and responsive layout.",
  },
  {
    emoji: "💬",
    title: "Testimonials",
    prompt:
      "Create a testimonials section with customer quotes, avatars, names, and company logos. Include a carousel or grid layout with smooth animations.",
  },
  {
    emoji: "📩",
    title: "Contact Form",
    prompt:
      "Build a contact form section with name, email, message fields, and submit button. Include form validation and a modern card design.",
  },
  {
    emoji: "👣",
    title: "Footer Section",
    prompt:
      "Create a footer with multiple columns for links, social icons, newsletter signup, and copyright. Responsive design with clean typography.",
  },
  {
    emoji: "📊",
    title: "Stats Section",
    prompt:
      "Build a stats/metrics section with animated counters showing key numbers like users, downloads, rating. Include icons and responsive grid.",
  },
];

export default function ComponentGeneratorPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [messages, setMessages] = useState<GeneratorMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComponent, setGeneratedComponent] =
    useState<GeneratedComponent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentlyGeneratingFile, setCurrentlyGeneratingFile] = useState<
    string | null
  >(null);
  const [reasoningEnabled, setReasoningEnabled] = useState(true);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorSchemeConfig>(
    defaultColorSchemeConfig,
  );
  const [previewWidthPct, setPreviewWidthPct] = useState(() => {
    if (typeof window === "undefined") return 50;
    const saved = window.localStorage.getItem(
      "component-generator:preview-width-pct",
    );
    const parsed = saved ? Number(saved) : NaN;
    if (!Number.isFinite(parsed)) return 50;
    return Math.min(72, Math.max(28, parsed));
  });
  const [activeSuggestions, setActiveSuggestions] = useState(
    SMART_SUGGESTIONS.slice(0, 4),
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Rotate suggestions for variety
  // AI-powered suggestions refresh
  const refreshSuggestions = useCallback(async () => {
    setIsRefreshingSuggestions(true);
    try {
      const resp = await fetch("/api/generate-suggestions", { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          setActiveSuggestions(data.slice(0, 4));
          return;
        }
      }
      // Fallback to shuffle if API fails
      const shuffled = [...SMART_SUGGESTIONS].sort(() => Math.random() - 0.5);
      setActiveSuggestions(shuffled.slice(0, 4));
    } catch (e) {
      const shuffled = [...SMART_SUGGESTIONS].sort(() => Math.random() - 0.5);
      setActiveSuggestions(shuffled.slice(0, 4));
    } finally {
      setIsRefreshingSuggestions(false);
    }
  }, []);

  const parseThinkingAndContent = (
    text: string,
  ): {
    reasoning: string;
    content: string;
    code: string;
    files?: Record<string, string>;
    entryFile?: string;
  } => {
    // Extract reasoning from <think> tags
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const thinkMatches = [...text.matchAll(thinkRegex)];
    const reasoning = thinkMatches.map((match) => match[1].trim()).join("\n\n");

    // Extract code from <component> tags (loose for streaming)
    const componentRegex = /<component>([\s\S]*?)(?:<\/component>|$)/;
    const componentMatch = text.match(componentRegex);
    const code = componentMatch ? componentMatch[1].trim() : "";

    const extractFilesLoose = (input: string) => {
      const start = input.search(/<files\b/i);
      if (start === -1)
        return {
          files: undefined as Record<string, string> | undefined,
          entryFile: undefined as string | undefined,
        };

      const endTagIdx = input.search(/<\/files>/i);
      const end =
        endTagIdx !== -1 ? endTagIdx + "</files>".length : input.length;
      const block = input.slice(start, end);

      const entryAttr = block.match(/<files\b[^>]*\bentry=["']([^"']+)["']/i);
      const rawEntry = (entryAttr?.[1] || "").trim();
      let entryFile: string | undefined = rawEntry
        ? rawEntry.startsWith("/")
          ? rawEntry
          : `/${rawEntry}`
        : undefined;

      const files: Record<string, string> = {};
      const tagRegex = /<file\s+path=["']([^"']+)["'][^>]*>/gi;
      const matches = Array.from(block.matchAll(tagRegex));
      for (let idx = 0; idx < matches.length; idx++) {
        const m = matches[idx];
        const path = String(m[1] || "").trim();
        if (!path) continue;
        const normalized = path.startsWith("/") ? path : `/${path}`;

        const contentStart = (m.index ?? 0) + m[0].length;
        const nextTagStart =
          idx + 1 < matches.length
            ? (matches[idx + 1].index ?? block.length)
            : block.length;
        let sliceEnd = nextTagStart;

        const closeIdx = block.indexOf("</file>", contentStart);
        if (closeIdx !== -1 && closeIdx < nextTagStart) sliceEnd = closeIdx;

        const content = block.slice(contentStart, sliceEnd).trim();
        if (content) files[normalized] = content;
      }

      const finalFiles = Object.keys(files).length ? files : undefined;
      if (!entryFile)
        entryFile = finalFiles?.["/entry.tsx"] ? "/entry.tsx" : undefined;
      if (!entryFile)
        entryFile = finalFiles?.["/App.tsx"] ? "/App.tsx" : undefined;
      return { files: finalFiles, entryFile };
    };

    const { files, entryFile } = extractFilesLoose(text);

    // Remove <think> and <component> tags from displayed content
    let content = text.replace(thinkRegex, "");
    content = content.replace(/<component>[\s\S]*?(?:<\/component>|$)/g, "");
    // Strip any <files> block even if it's malformed or incomplete (prevents raw code from appearing in chat).
    content = content.replace(/<files\b[\s\S]*?(<\/files>|$)/gi, "");
    content = content.trim();

    return { reasoning, content, code, files, entryFile };
  };

  const extractArtifactsFromResponse = (
    text: string,
  ): {
    code?: string;
    files?: Record<string, string>;
    entryFile?: string;
    language: string;
  } => {
    const { code, files, entryFile } = parseThinkingAndContent(text);

    if (files && Object.keys(files).length > 0) {
      const entry =
        (entryFile && files[entryFile] ? entryFile : undefined) ||
        (files["/entry.tsx"] ? "/entry.tsx" : undefined) ||
        (files["/App.tsx"] ? "/App.tsx" : undefined) ||
        Object.keys(files)[0];
      return { files, entryFile, language: "tsx", code: files[entry] };
    }

    if (code) {
      let sanitized = code;
      const lines = sanitized.split("\n");
      const halfLength = Math.floor(lines.length / 2);
      if (halfLength > 10) {
        const firstHalf = lines.slice(0, halfLength).join("\n");
        const secondHalf = lines.slice(halfLength).join("\n");
        if (firstHalf.trim() === secondHalf.trim()) {
          sanitized = firstHalf.trim();
        }
      }
      return { language: "tsx", code: sanitized };
    }

    return { language: "tsx" };
  };

  // File editing handlers
  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path);
    setViewMode("code");
  }, []);

  const handleFileEdit = useCallback((path: string, content: string) => {
    setEditedFiles((prev) => ({
      ...prev,
      [path]: content,
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveFile = useCallback(() => {
    if (!selectedFile || !hasUnsavedChanges) return;

    setGeneratedComponent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        files: {
          ...prev.files,
          ...editedFiles,
        },
      };
    });

    setHasUnsavedChanges(false);
    toast.success("File saved successfully!");
  }, [selectedFile, hasUnsavedChanges, editedFiles]);

  // Auto-select first file when code generated
  useEffect(() => {
    if (generatedComponent?.files && !selectedFile) {
      const firstFile = Object.keys(generatedComponent.files)[0];
      if (firstFile) {
        setSelectedFile(firstFile);
      }
    }
  }, [generatedComponent, selectedFile]);

  // Auto-open panel when generation starts
  useEffect(() => {
    if (currentlyGeneratingFile && !isPanelOpen) {
      setIsPanelOpen(true);
    }
  }, [currentlyGeneratingFile, isPanelOpen]);

  const handleSubmit = useCallback(
    async ({ text }: { text?: string }) => {
      if (!text?.trim() || isGenerating) return;

      const userMessage: GeneratorMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);

      const assistantMessage: GeneratorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          reasoning_details: msg.reasoning_details,
        }));

        const buildProjectContext = () => {
          const baseFiles = generatedComponent?.files
            ? { ...generatedComponent.files, ...editedFiles }
            : null;
          if (!baseFiles) return null;

          const allPaths = Object.keys(baseFiles).sort();
          const mentioned =
            text.match(/\/[A-Za-z0-9_\-./]+?\.(tsx|ts|jsx|js|css|json)/g) || [];
          const prioritized = [
            generatedComponent?.entryFile,
            selectedFile,
            ...mentioned,
          ]
            .filter(Boolean)
            .map((p) => (String(p).startsWith("/") ? String(p) : `/${p}`));

          const seen = new Set<string>();
          const picks: string[] = [];
          for (const p of prioritized) {
            if (!p) continue;
            if (seen.has(p)) continue;
            if (!baseFiles[p]) continue;
            seen.add(p);
            picks.push(p);
            if (picks.length >= 6) break;
          }

          // If nothing specific is referenced, include entry + a few top-level files.
          if (picks.length === 0) {
            const fallback = allPaths.filter((p) =>
              /^\/(App|entry)\.(tsx|ts)$/.test(p),
            );
            for (const p of fallback) {
              if (!seen.has(p) && baseFiles[p]) {
                seen.add(p);
                picks.push(p);
              }
            }
            for (const p of allPaths) {
              if (picks.length >= 4) break;
              if (seen.has(p)) continue;
              if (!baseFiles[p]) continue;
              if (p.endsWith(".tsx") || p.endsWith(".ts")) {
                seen.add(p);
                picks.push(p);
              }
            }
          }

          const maxChars = 30000;
          let out = `PROJECT CONTEXT (read-only):\n`;
          out += `FILES:\n${allPaths.join("\n")}\n\n`;
          out += `IMPORTANT:\n- Treat these files as the current project state.\n- If you are fixing/editing, output ONLY changed files inside <files>.\n\n`;

          for (const p of picks) {
            const content = String(baseFiles[p] || "");
            if (!content.trim()) continue;
            const chunk = `--- FILE: ${p} ---\n${content}\n\n`;
            if (out.length + chunk.length > maxChars) break;
            out += chunk;
          }

          return out;
        };

        const projectContext = buildProjectContext();

        const runGeneration = async (
          promptToSend: string,
          seedContent = "",
        ) => {
          abortControllerRef.current = new AbortController();
          const response = await fetch("/api/generate-component", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptToSend,
              conversationHistory,
              projectContext,
              reasoningEnabled,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
              errData.error || "Generation failed. The AI might be busy.",
            );
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = seedContent;
          let accumulatedReasoning = "";
          let finalReasoningDetails: any = null;
          let buffer = "";
          let updateTimer: NodeJS.Timeout | null = null;
          let streamMode: "unknown" | "structured" | "plain" = "unknown";

          const updateMessages = () => {
            const {
              reasoning,
              content: displayContent,
              code,
              files,
              entryFile,
            } = parseThinkingAndContent(accumulatedContent);

            const displayReasoning = accumulatedReasoning || reasoning;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? {
                    ...msg,
                    content:
                      displayContent?.trim() ||
                      (accumulatedReasoning && !displayContent
                        ? ""
                        : displayContent) ||
                      (files
                        ? "Generated project files. Opening preview…"
                        : "Generating…"),
                    reasoning: displayReasoning,
                    reasoning_details: finalReasoningDetails,
                    code,
                    files,
                    entryFile,
                  }
                  : msg,
              ),
            );

            if (files && (Object.keys(files).length > 0 || code)) {
              const nextEntry =
                (entryFile && files[entryFile] ? entryFile : undefined) ||
                (files["/entry.tsx"] ? "/entry.tsx" : undefined) ||
                (files["/App.tsx"] ? "/App.tsx" : undefined) ||
                Object.keys(files)[0];

              setGeneratedComponent((prev) => {
                const mergedFiles = {
                  ...(prev?.files || {}),
                  ...files,
                };
                return {
                  code:
                    (nextEntry && mergedFiles[nextEntry]) ||
                    files[nextEntry] ||
                    code ||
                    prev?.code ||
                    "",
                  files: mergedFiles,
                  entryFile: nextEntry || entryFile || prev?.entryFile,
                  language: "tsx",
                  title: prev?.title || "Generated Component",
                };
              });
              setIsPanelOpen(true);
            }
          };

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // Final content is in accumulatedContent
                updateMessages();
                if (updateTimer) clearTimeout(updateTimer);
                setCurrentlyGeneratingFile(null);
                break;
              }

              // For plain text stream from Vercel AI SDK toTextStreamResponse()
              // The decoded value IS the content - no parsing needed
              const chunk = decoder.decode(value, { stream: true });

              // Check if it looks like structured SSE (legacy format) or plain text
              const looksStructured = /(?:^|\n)(?:0:|data: )/.test(chunk);
              if (streamMode === "unknown") {
                streamMode = looksStructured ? "structured" : "plain";
              }

              if (streamMode === "structured") {
                // Handle structured formats (Vercel AI SDK data format or legacy SSE)
                buffer += chunk;
                const lines = buffer.split("\n");
                buffer = lines[lines.length - 1];

                for (let i = 0; i < lines.length - 1; i++) {
                  const line = lines[i].trim();
                  if (!line) continue;

                  let contentDelta = "";

                  // Handle Vercel AI SDK format: 0:"text content"
                  if (line.startsWith("0:")) {
                    try {
                      const textContent = JSON.parse(line.slice(2));
                      if (typeof textContent === "string") {
                        contentDelta = textContent;
                      }
                    } catch {
                      // ignore parse errors
                    }
                  }
                  // Handle finish message: d:{"finishReason":"stop"}
                  else if (line.startsWith("d:") || line.startsWith("e:")) {
                    continue;
                  }
                  // Handle legacy SSE format
                  else if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (!data || data === "[DONE]") continue;
                    try {
                      const parsed = JSON.parse(data);
                      const delta = parsed.choices?.[0]?.delta || {};
                      contentDelta = delta.content || "";
                    } catch {
                      // ignore
                    }
                  }

                  if (contentDelta) {
                    accumulatedContent += contentDelta;
                  }
                }
              } else {
                // Plain text stream - just accumulate directly
                accumulatedContent += chunk;
              }

              // --- SLOP GUARD (check after each chunk) ---
              const contentSlop = accumulatedContent.slice(-400);
              const isSlop = (str: string) => {
                if (str.length < 200) return false;

                // 1. Detect long consecutive identical sequences
                for (let len = 2; len <= 12; len++) {
                  const tail = str.slice(-len);
                  // Ignore tail if it's just code symbols, whitespace, or boilerplate
                  if (
                    /^[ \n\t\r\.,\-\/\\{}\(\)\[\]<>='";\:&!@#$%^&*\|?+~`]+$/.test(
                      tail,
                    )
                  )
                    continue;

                  // threshold: 40 repetitions is practically impossible in normal code
                  const repeatedTail = tail.repeat(40);
                  if (str.includes(repeatedTail)) return true;
                }

                // 2. Detect non-Latin gibberish loops
                const nonLatinTail = str.slice(-100);
                const nonLatinCount = (
                  nonLatinTail.match(/[^\x00-\x7F]/g) || []
                ).length;
                if (nonLatinCount > 85) return true;

                return false;
              };

              if (isSlop(contentSlop)) {
                console.error("Pathological slop detected, aborting stream.");
                abortControllerRef.current?.abort();
                toast.error(
                  "AI generation loop detected. Aborted to save context.",
                );
                break;
              }
              // ----------------------------

              // Check for code artifacts in current chunk to open the panel
              if (
                chunk.includes("<files") ||
                chunk.includes("<component>") ||
                /<file\s+path=["']/.test(chunk)
              ) {
                setIsPanelOpen(true);
                setIsFullscreen(false);
                setViewMode("code");
                setGeneratedComponent(
                  (prev) =>
                    prev ?? {
                      code: "",
                      files: undefined,
                      entryFile: undefined,
                      language: "tsx",
                      title: "Generated Component",
                    },
                );
              }

              // Check for file path in current chunk
              const filePathMatch = chunk.match(
                /<file\s+path=["']([^"']+)["']/,
              );
              if (filePathMatch) {
                const filePath = filePathMatch[1];
                const normalized = filePath.startsWith("/")
                  ? filePath
                  : `/${filePath}`;
                setCurrentlyGeneratingFile(normalized);
              }

              if (updateTimer) clearTimeout(updateTimer);
              updateTimer = setTimeout(updateMessages, 50);
            }
          }

          return accumulatedContent;
        };

        let raw = await runGeneration(text.trim());

        if (abortControllerRef.current?.signal.aborted) return;

        const needsContinuation = (content: string) => {
          if (!/<files\b/i.test(content)) return false;
          if (!/<\/files>/i.test(content)) return true;
          const openFiles = (
            content.match(/<file\s+path=["'][^"']+["'][^>]*>/gi) || []
          ).length;
          const closeFiles = (content.match(/<\/file>/gi) || []).length;
          return openFiles > closeFiles;
        };

        const maxContinuationAttempts = 2;
        let continuationAttempts = 0;
        while (
          raw &&
          needsContinuation(raw) &&
          continuationAttempts < maxContinuationAttempts
        ) {
          const tail = raw.slice(-2000);
          const continuePrompt = `Continue exactly from the last character of the previous output.\n\nPrevious output ended with:\n${tail}\n\nContinue the same <files> block only. Do not repeat any content. Do not include explanations or markdown.`;
          raw = await runGeneration(continuePrompt, raw);
          if (abortControllerRef.current?.signal.aborted) return;
          continuationAttempts += 1;
        }

        let artifacts = raw ? extractArtifactsFromResponse(raw) : null;

        // If the model didn't output <files>/<component>, retry once with a strict formatting instruction.
        if (
          (!artifacts?.files || Object.keys(artifacts.files).length === 0) &&
          !artifacts?.code
        ) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  content: "Formatting output…",
                  reasoning: "",
                  files: undefined,
                  code: "",
                }
                : msg,
            ),
          );

          const strictPrompt = `${text.trim()}\n\nIMPORTANT:\n- Respond ONLY with valid XML-like tags.\n- Start with <files entry=\"/App.tsx\"> and include one or more <file path=\"...\"> blocks.\n- Do not include markdown fences.\n- Do not include explanations outside the <files> block.`;

          raw = await runGeneration(strictPrompt);
          if (abortControllerRef.current?.signal.aborted) return;
          artifacts = raw ? extractArtifactsFromResponse(raw) : null;
        }

        if (raw && artifacts && (artifacts.files || artifacts.code)) {
          const { code, files, entryFile, language } = artifacts;
          setGeneratedComponent((prev) => {
            const mergedFiles = files
              ? { ...(prev?.files || {}), ...files }
              : prev?.files;
            return {
              code: code || prev?.code,
              files: mergedFiles,
              entryFile: entryFile || prev?.entryFile,
              language,
              title: "Generated Component",
            };
          });
          setIsPanelOpen(true);
        } else {
          toast.error("AI did not return files. Please try again.");
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          toast.info("Generation stopped");
        } else {
          console.error("Error:", error);
          toast.error("Failed to generate component");

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                  ...msg,
                  content: "Sorry, I encountered an error. Please try again.",
                }
                : msg,
            ),
          );
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isGenerating, generatedComponent, editedFiles, selectedFile],
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const setClampedPreviewWidthPct = useCallback((pct: number) => {
    setPreviewWidthPct(Math.min(72, Math.max(28, pct)));
  }, []);

  const resizeFromClientX = useCallback(
    (clientX: number) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width) return;
      const x = clientX - rect.left;
      const chatPct = (x / rect.width) * 100;
      setClampedPreviewWidthPct(100 - chatPct);
    },
    [setClampedPreviewWidthPct],
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (!splitContainerRef.current) return;
      isResizingRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      resizeFromClientX(e.clientX);
    },
    [resizeFromClientX],
  );

  useEffect(() => {
    window.localStorage.setItem(
      "component-generator:preview-width-pct",
      String(previewWidthPct),
    );
  }, [previewWidthPct]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isResizingRef.current) return;
      resizeFromClientX(e.clientX);
    };
    const onUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizeFromClientX]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const isMobile = !isDesktop;

  return (
    <div className="flex h-screen w-full flex-col font-sans overflow-hidden">
      {/* Header */}
      <GeneratorHeader
        hasGenerated={!!generatedComponent}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen(!isPanelOpen)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        onResetSplit={() => setPreviewWidthPct(50)}
      />

      {/* Main Content - Responsive Split Layout */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden relative bg-muted/5 dark:bg-muted/2"
      >
        {/* Chat Section */}
        <div
          className={cn(
            "flex flex-col transition-all duration-300 ease-in-out bg-background relative z-0 min-h-0",
            // Mobile: Always full width/height unless covered
            "flex-1 w-full lg:h-full",
            // Desktop: Resizable width handling
            isPanelOpen && !isFullscreen
              ? "lg:flex-none lg:border-r border-border/40"
              : "lg:flex-1 lg:w-full",
          )}
          style={
            // Apply width only on desktop when panel is open and not fullscreen
            isDesktop && isPanelOpen && !isFullscreen
              ? { width: `${100 - previewWidthPct}%` }
              : undefined
          }
        >
          {/* Progressive Blur Overlays - Lightened and Slimmed */}
          <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-background via-background/20 to-transparent pointer-events-none z-20" />
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none z-20" />

          <Conversation className="flex-1 overflow-hidden min-h-0 relative">
            <ConversationContent
              className={cn(
                "flex flex-col w-full max-w-6xl mx-auto",
                messages.length === 0
                  ? "min-h-full justify-center py-12 md:py-24"
                  : "p-3 sm:p-6 space-y-6 pb-2",
              )}
            >
              {messages.length === 0 ? (
                /* Premium Static Empty State */
                <div className="flex flex-col items-center justify-center max-w-6xl mx-auto text-center px-4 flex-1 relative w-full">
                  <div className="space-y-6 w-full">
                    <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-foreground uppercase leading-[0.9] scale-y-110">
                      SHADWAY <span className="text-primary not-italic tracking-normal">ARCHITECT</span>
                    </h2>
                    <p className="max-w-2xl mx-auto text-sm md:text-lg text-muted-foreground/50 font-medium leading-relaxed px-4">
                      The next-gen AI engineering engine. Transform your vision into production-ready React components with unprecedented speed and precision.
                    </p>
                  </div>

                  <div className="w-full mt-8 md:mt-12">
                    <SuggestionsGrid
                      suggestions={activeSuggestions}
                      onPick={(p) => handleSubmit({ text: p })}
                      onRefresh={refreshSuggestions}
                      isRefreshing={isRefreshingSuggestions}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 pb-4">
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <Message
                        key={message.id}
                        from={message.role}
                        className={cn(
                          "duration-300",
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start",
                        )}
                      >
                        <MessageContent
                          className={cn(
                            "w-full px-0 py-0 rounded-none",
                            message.role === "user"
                              ? "items-end"
                              : "items-start",
                          )}
                        >
                          {message.role === "user" ? (
                            <div className="group relative inline-block max-w-[90%] sm:max-w-2xl lg:max-w-3xl self-end">
                              <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 rounded-[24px] blur-md opacity-0 group-hover:opacity-100 transition duration-700" />
                              <div className="relative rounded-[22px] bg-foreground text-background dark:bg-zinc-100 dark:text-zinc-900 px-6 py-3.5 shadow-sm text-[15px] leading-relaxed font-medium">
                                {message.content}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full space-y-6">
                              {/* Status Badge */}
                              {message.files && (
                                <div className="flex items-center gap-3 p-4 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl text-sm font-medium animate-in zoom-in-95 duration-500 shadow-sm backdrop-blur-sm sm:max-w-max">
                                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <CheckIcon className="h-4 w-4" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold">
                                      Generation Complete
                                    </span>
                                    <span className="text-xs opacity-70">
                                      Project files ready
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Thinking Process */}
                              {message.reasoning && (
                                <ThinkingProcess
                                  content={message.reasoning}
                                  isFinished={
                                    !!(message.content || message.files)
                                  }
                                />
                              )}

                              {/* AI Response Text - Removed re-triggering animations */}
                              {message.content && (
                                <div className="prose-wrapper">
                                  <AIResponse className="text-[15px] leading-relaxed text-foreground font-sans tracking-tight">
                                    {message.content}
                                  </AIResponse>
                                </div>
                              )}

                              {/* Artifacts Grid */}
                              {message.files &&
                                Object.keys(message.files).length > 0 && (
                                  <div className="space-y-4 animate-in slide-in-from-left-4 duration-500">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-50 ml-1">
                                      Artifacts
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {Object.keys(message.files)
                                        .slice(0, 4)
                                        .map((path) => (
                                          <div
                                            key={path}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors group/file cursor-default"
                                          >
                                            <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center border border-border/50 group-hover/file:border-primary/30 transition-colors shrink-0">
                                              <FileIconComponent path={path} />
                                            </div>
                                            <span className="truncate text-xs font-mono text-muted-foreground group-hover/file:text-foreground transition-colors min-w-0">
                                              {path}
                                            </span>
                                          </div>
                                        ))}
                                      {Object.keys(message.files).length >
                                        4 && (
                                          <div className="flex items-center justify-center p-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60">
                                            +{" "}
                                            {Object.keys(message.files).length -
                                              4}{" "}
                                            more
                                          </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-border/40">
                                      <Button
                                        size="sm"
                                        className="h-10 px-6 bg-primary text-primary-foreground hover:opacity-90 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
                                        onClick={() => {
                                          setGeneratedComponent({
                                            code: message.code,
                                            files: message.files,
                                            entryFile: message.entryFile,
                                            language: "tsx",
                                            title: "Generated Component",
                                          });
                                          setIsPanelOpen(true);
                                          setIsFullscreen(false);
                                          setViewMode("preview");
                                        }}
                                      >
                                        <EyeIcon className="h-4 w-4 mr-2" />
                                        Launch Preview
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setGeneratedComponent({
                                            code: message.code,
                                            files: message.files,
                                            entryFile: message.entryFile,
                                            language: "tsx",
                                            title: "Generated Component",
                                          });
                                          setIsPanelOpen(true);
                                          setIsFullscreen(false);
                                          setViewMode("code");
                                        }}
                                        className="h-10 px-6 border-border hover:bg-muted/50 rounded-xl transition-all w-full sm:w-auto"
                                      >
                                        <Code2Icon className="h-4 w-4 mr-2" />
                                        Code
                                      </Button>
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </MessageContent>
                      </Message>
                    ))}
                    {isGenerating &&
                      !messages[messages.length - 1]?.reasoning && (
                        <div className="flex items-center gap-4 py-6 animate-in fade-in slide-in-from-left-2 duration-500 max-w-xl px-4 translate-y-2 self-start ml-2">
                          <div className="relative h-10 w-10 shrink-0">
                            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                            <div className="relative h-full w-full rounded-full border-2 border-t-primary border-r-primary/50 border-b-primary/10 border-l-transparent animate-spin" />
                            <SparklesIcon className="absolute inset-0 m-auto h-4 w-4 text-primary animate-pulse" />
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[13px] font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent animate-pulse">
                              Initializing Architect...
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-black">
                                Waking up vibes
                              </span>
                              <div className="flex gap-1">
                                <span className="h-0.5 w-0.5 rounded-full bg-primary/30 animate-bounce delay-0" />
                                <span className="h-0.5 w-0.5 rounded-full bg-primary/30 animate-bounce delay-150" />
                                <span className="h-0.5 w-0.5 rounded-full bg-primary/30 animate-bounce delay-300" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Fixed Input Area - Centered and Elevated */}
          <div className="relative px-6 pb-12 pt-0 shrink-0 bg-transparent z-10 mt-auto">
            <div className="mx-auto w-full max-w-3xl relative">
              <PromptInput onSubmit={handleSubmit} className="w-full">
                <PromptInputBody className="relative flex flex-col w-full rounded-2xl border border-border bg-background/95 dark:bg-background/40 backdrop-blur-xl shadow-xl hover:shadow-primary/5 transition-all duration-700 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/50 group overflow-hidden">
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/10 via-transparent to-primary/5 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none z-0" />

                  <PromptInputTextarea
                    placeholder={
                      messages.length === 0
                        ? "What are we building today?"
                        : "Refine your design..."
                    }
                    disabled={isGenerating}
                    className="relative z-10 min-h-[44px] md:min-h-[48px] w-full p-4 md:p-5 text-[15px] md:text-base border-0 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50 font-medium leading-tight overflow-y-auto no-scrollbar resize-none"
                  />

                  <PromptInputFooter className="relative z-10 px-3 md:px-4 pb-3 md:pb-4 pt-0 border-0 bg-transparent flex items-center justify-between">
                    <PromptInputTools className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground/50 hover:text-foreground h-8 w-8 md:h-9 md:w-9 rounded-full transition-all hover:bg-muted/50"
                        type="button"
                        onClick={() => toast.info("Attachments coming soon!")}
                      >
                        <PaperclipIcon className="h-4 w-4" />
                      </Button>

                      <div className="h-3 w-[1px] bg-border/60 mx-0.5" />

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReasoningEnabled(!reasoningEnabled)}
                        className={cn(
                          "h-8 px-3 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border shadow-sm",
                          reasoningEnabled
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-muted/20 text-muted-foreground/60 border-transparent hover:bg-muted/30",
                        )}
                      >
                        <SparklesIcon
                          className={cn(
                            "h-3 w-3 mr-1.5",
                            reasoningEnabled ? "animate-pulse" : "opacity-40",
                          )}
                        />
                        <span>{reasoningEnabled ? "Architect" : "Base"}</span>
                      </Button>

                      {isGenerating && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleStop}
                          className="h-8 px-3 text-[9px] font-bold uppercase text-destructive border border-destructive/20 rounded-full hover:bg-destructive/5"
                        >
                          Stop
                        </Button>
                      )}
                    </PromptInputTools>

                    <div className="flex items-center gap-2">
                      <PromptInputSubmit
                        disabled={isGenerating}
                        className={cn(
                          "h-9 w-9 md:h-10 md:w-10 rounded-xl transition-all duration-300 flex items-center justify-center",
                          isGenerating
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/20",
                        )}
                      >
                        <Zap
                          className={cn(
                            "h-4 w-4",
                            isGenerating && "animate-pulse text-primary-foreground"
                          )}
                        />
                      </PromptInputSubmit>
                    </div>
                  </PromptInputFooter>
                </PromptInputBody>
              </PromptInput>
            </div>
          </div>
        </div>

        {/* Desktop Splitter Handle */}
        {
          isDesktop && generatedComponent && isPanelOpen && !isFullscreen && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
              onPointerDown={startResize}
              className="hidden lg:flex w-2 group/splitter z-50 cursor-col-resize items-center justify-center px-1 transition-all"
            >
              <div className="h-[20%] w-[1px] bg-border group-hover/splitter:bg-primary/50 group-hover/splitter:w-[2px] rounded-full transition-all" />
              <div className="absolute h-8 w-1.5 bg-border/20 group-hover/splitter:bg-primary/20 rounded-full backdrop-blur-sm border border-border/50 transition-all opacity-0 group-hover/splitter:opacity-100" />
            </div>
          )
        }

        {/* Right Panel - Code/Preview */}
        <AnimatePresence>
          {generatedComponent && isPanelOpen && (
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.98, x: 20 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, x: 0 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.98, x: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "flex flex-col bg-background text-foreground transition-all duration-300 border border-border/60 shadow-2xl overflow-hidden backdrop-blur-xl",
                isMobile || isFullscreen
                  ? "fixed inset-0 z-50 w-full h-full rounded-none"
                  : "relative flex-none h-[calc(100%-1.5rem)] my-3 mr-3 rounded-2xl md:rounded-3xl z-40",
              )}
              style={
                isDesktop && !isFullscreen
                  ? { width: `${previewWidthPct}%`, height: "calc(100% - 1.5rem)" }
                  : undefined
              }
            >
              {/* Panel Header */}
              <div className="flex-none h-14 flex items-center bg-muted/40 border-b border-border/60 select-none backdrop-blur-xl px-4 justify-between">
                <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl border border-border/80 shadow-inner">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300",
                      viewMode === "preview"
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                        : "text-muted-foreground hover:text-foreground hover:bg-background",
                    )}
                  >
                    <EyeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </button>
                  <button
                    onClick={() => setViewMode("code")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300",
                      viewMode === "code"
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                        : "text-muted-foreground hover:text-foreground hover:bg-background",
                    )}
                  >
                    <Code2Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">Code</span>
                  </button>
                </div>

                {isGenerating && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20 animate-pulse ml-4">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">Architect Generating...</span>
                  </div>
                )}

                {viewMode === "preview" && (
                  <div className="ml-2 border-l border-border pl-2">
                    <ColorSchemeEditor
                      value={colorScheme}
                      onChange={setColorScheme}
                      isDark={isDark}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {!isMobile ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsPanelOpen(false)}
                      className="h-9 w-9 p-0 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-all border border-transparent hover:border-destructive/20"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setIsPanelOpen(false)}
                      className="h-9 truncate px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20"
                    >
                      Close
                    </Button>
                  )}
                </div>
              </div>

              {/* Content */}
              {/* Content Panels with Persistence */}
              <div className="flex-1 flex flex-col min-h-0 bg-background relative overflow-hidden h-full">
                {/* Preview Panel */}
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col min-h-0 bg-white dark:bg-zinc-950 transition-all duration-300",
                    viewMode === "preview" ? "opacity-100 z-10 visible scale-100" : "opacity-0 z-0 invisible scale-[0.98]"
                  )}
                >
                  <SandpackRuntimePreview
                    showConsole={false}
                    code={generatedComponent.code || ""}
                    files={{
                      ...(generatedComponent.files || {}),
                      ...editedFiles,
                    }}
                    entryFile={generatedComponent.entryFile}
                    className="flex-1 min-h-0 h-full"
                    colorScheme={colorScheme}
                  />
                </div>

                {/* Code Editor Panel */}
                <div
                  className={cn(
                    "absolute inset-0 flex min-h-0 w-full transition-all duration-300",
                    viewMode === "code" ? "opacity-100 z-10 visible scale-100" : "opacity-0 z-0 invisible scale-[0.98]"
                  )}
                >
                  {/* Sidebar */}
                  <div
                    className={cn(
                      "flex-none border-r border-border bg-muted/20 flex flex-col transition-all",
                      isMobile ? "w-0 overflow-hidden hidden" : "w-60",
                    )}
                  >
                    <div className="flex-1 overflow-y-auto min-h-0">
                      <FileTree
                        files={generatedComponent.files || {}}
                        selectedFile={selectedFile}
                        onFileSelect={handleFileSelect}
                        generatingFile={currentlyGeneratingFile}
                      />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-card">
                    {/* Mobile File Dropdown */}
                    {isMobile && generatedComponent.files && (
                      <div className="p-2 border-b border-border bg-muted/10 flex-none">
                        <select
                          className="w-full text-xs p-2 rounded border border-border bg-background text-foreground"
                          value={selectedFile || ""}
                          onChange={(e) => handleFileSelect(e.target.value)}
                        >
                          {Object.keys(generatedComponent.files).map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Editor */}
                    <div className="flex-1 min-h-0 relative">
                      {selectedFile ? (
                        <Editor
                          height="100%"
                          defaultLanguage="typescript"
                          language={
                            selectedFile.endsWith(".css")
                              ? "css"
                              : selectedFile.endsWith(".json")
                                ? "json"
                                : "typescript"
                          }
                          value={
                            editedFiles[selectedFile] ||
                            generatedComponent.files?.[selectedFile] ||
                            ""
                          }
                          onChange={(value) =>
                            selectedFile &&
                            handleFileEdit(selectedFile, value || "")
                          }
                          theme={isDark ? "vs-dark" : "light"}
                          options={{
                            minimap: { enabled: !isMobile },
                            fontSize: isMobile ? 12 : 13,
                            fontFamily:
                              "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                            wordWrap: "on",
                            padding: { top: 12 },
                            automaticLayout: true,
                            lineNumbers: "on",
                            scrollBeyondLastLine: true,
                            renderLineHighlight: "line",
                            cursorBlinking: "smooth",
                            smoothScrolling: true,
                            renderValidationDecorations: "off",
                            "semanticHighlighting.enabled": false,
                          }}
                          beforeMount={(monaco) => {
                            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                              noSemanticValidation: true,
                              noSyntaxValidation: true,
                            });
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                          Select file to edit...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div >
    </div >
  );
}
