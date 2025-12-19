"use client";

import { SandpackRuntimePreview } from "@/components/sandpack-preview";
import { FileTree } from "@/app/component-generator/components/file-tree";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
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
  CopyIcon,
  CheckIcon,
  CodeIcon,
  EyeIcon,
  FileIcon,
  SaveIcon,
  Loader2Icon,
  Zap,
  Maximize2Icon,
  Minimize2Icon,
  PaperclipIcon,
  Link,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
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

const getFileTabIconClass = (path?: string | null) => {
  if (!path) return "codicon-file";
  const name = path.split("/").pop() || "";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    tsx: "codicon-file-code",
    ts: "codicon-file-code",
    jsx: "codicon-file-code",
    js: "codicon-file-code",
    css: "codicon-symbol-color",
    scss: "codicon-symbol-color",
    json: "codicon-symbol-object",
    md: "codicon-markdown",
    html: "codicon-file-code",
    svg: "codicon-file-media",
    png: "codicon-file-media",
    jpg: "codicon-file-media",
    jpeg: "codicon-file-media",
    gif: "codicon-file-media",
  };
  return iconMap[ext] || "codicon-file";
};

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
    <div className="relative group my-4 rounded-lg border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <CodeIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRun && (
            <button
              onClick={onRun}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary/30"
                  : "text-foreground hover:text-primary bg-background hover:bg-accent",
              )}
            >
              {isActive ? (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Running
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Run
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground hover:text-primary bg-background hover:bg-accent rounded-md transition-all duration-200 border"
          >
            {copied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-500">Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                Copy Code
              </>
            )}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto bg-muted/30 no-scrollbar">
        <pre className="p-4 text-sm leading-relaxed">
          <code className="text-foreground font-mono text-xs sm:text-sm">
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Smart AI-powered suggestions
type Suggestion = {
  emoji: string;
  title: string;
  prompt: string;
};

const SMART_SUGGESTIONS: Suggestion[] = [
  {
    emoji: "🚀",
    title: "Multi-Page Portfolio",
    prompt:
      "Build a complete portfolio website with Home, About, Projects, and Contact views in /app folder using HashRouter. Include smooth page transitions with framer-motion and a responsive navbar.",
  },
  {
    emoji: "🛒",
    title: "E-Commerce App",
    prompt:
      "Create a full e-commerce app with product listing, product details, shopping cart, and checkout pages. Use zustand for state management and include product filtering.",
  },
  {
    emoji: "📊",
    title: "Dashboard with Charts",
    prompt:
      "Build an analytics dashboard with multiple pages (Overview, Analytics, Reports). Include interactive charts, metrics cards, and data tables with filtering.",
  },
  {
    emoji: "💬",
    title: "Chat Application",
    prompt:
      "Create a real-time chat interface with message list, chat rooms, and user profiles. Include message timestamps, typing indicators, and online status.",
  },
  {
    emoji: "📝",
    title: "Blog Platform",
    prompt:
      "Build a blog platform with Home (post listing), Post Detail, Create Post, and Author Profile pages. Use react-hook-form for post creation.",
  },
  {
    emoji: "🎮",
    title: "Game Dashboard",
    prompt:
      "Create a gaming dashboard with leaderboard, player stats, achievements, and match history pages. Include animated transitions and interactive elements.",
  },
  {
    emoji: "🎵",
    title: "Music Player App",
    prompt:
      "Build a music player with library, playlists, now playing, and search pages. Include player controls, playlist management, and smooth animations.",
  },
  {
    emoji: "📚",
    title: "Learning Platform",
    prompt:
      "Create an online learning platform with course catalog, course details, lesson viewer, and progress tracking pages. Use react-router-dom for navigation.",
  },
];

export default function ComponentGeneratorPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComponent, setGeneratedComponent] =
    useState<GeneratedComponent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentlyGeneratingFile, setCurrentlyGeneratingFile] = useState<
    string | null
  >(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(false);
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
  const refreshSuggestions = useCallback(() => {
    const shuffled = [...SMART_SUGGESTIONS].sort(() => Math.random() - 0.5);
    setActiveSuggestions(shuffled.slice(0, 4));
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

    // Extract code from <component> tags
    const componentRegex = /<component>([\s\S]*?)<\/component>/;
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
    content = content.replace(/<component>[\s\S]*?<\/component>/g, "");
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

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);

      const assistantMessage: Message = {
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

        const runGeneration = async (promptToSend: string) => {
          abortControllerRef.current = new AbortController();
          const response = await fetch("/api/generate-component", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptToSend,
              conversationHistory,
              projectContext,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            throw new Error("Failed to generate component");
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = "";
          let buffer = "";
          let updateTimer: NodeJS.Timeout | null = null;

          const updateMessages = () => {
            const {
              reasoning,
              content: displayContent,
              code,
              files,
              entryFile,
            } = parseThinkingAndContent(accumulatedContent);
            const safeDisplay =
              displayContent?.trim() ||
              (files
                ? "Generated project files. Opening preview…"
                : "Generating…");
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? {
                    ...msg,
                    content: safeDisplay,
                    reasoning,
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
                if (buffer.trim()) {
                  const lines = buffer.split("\n");
                  for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const data = line.slice(6);
                    if (!data || data === "[DONE]") continue;
                    try {
                      const parsed = JSON.parse(data);
                      accumulatedContent +=
                        parsed.choices?.[0]?.delta?.content || "";
                    } catch {
                      // ignore
                    }
                  }
                }
                updateMessages();
                if (updateTimer) clearTimeout(updateTimer);
                setCurrentlyGeneratingFile(null);
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines[lines.length - 1];

              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6);
                if (!data || data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content || "";
                  if (!delta) continue;
                  accumulatedContent += delta;

                  // Open the panel ONLY when the model starts emitting code artifacts.
                  if (
                    delta.includes("<files") ||
                    delta.includes("<component>") ||
                    /<file\\s+path=[\"']/.test(delta)
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

                  const filePathMatch = delta.match(
                    /<file\s+path=["']([^"']+)["']/,
                  );
                  if (filePathMatch) {
                    const filePath = filePathMatch[1];
                    const normalized = filePath.startsWith("/")
                      ? filePath
                      : `/${filePath}`;
                    setCurrentlyGeneratingFile(normalized);
                  }
                } catch {
                  // ignore
                }
              }

              if (updateTimer) clearTimeout(updateTimer);
              updateTimer = setTimeout(updateMessages, 50);
            }
          }

          return accumulatedContent;
        };

        let raw = await runGeneration(text.trim());

        if (abortControllerRef.current?.signal.aborted) return;

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
    <div className="flex h-screen w-full flex-col bg-background font-sans overflow-hidden">
      {/* Header */}
      <header className="flex-none h-14 border-b border-border bg-background/80 backdrop-blur-md z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {generatedComponent && !isPanelOpen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPanelOpen(true)}
              className="h-9 gap-2 shadow-sm"
            >
              <EyeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content - Responsive Split Layout */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden relative"
      >
        {/* Chat Section */}
        <div
          className={cn(
            "flex flex-col transition-all duration-300 ease-in-out bg-background relative z-0 min-h-0",
            // Mobile: Always full width/height unless covered
            "flex-1 w-full lg:h-full",
            // Desktop: Resizable width handling
            isPanelOpen && !isFullscreen ? "lg:flex-none lg:border-r border-border/40" : "lg:flex-1 lg:w-full"
          )}
          style={
            // Apply width only on desktop when panel is open and not fullscreen
            isDesktop && isPanelOpen && !isFullscreen
              ? { width: `${100 - previewWidthPct}%` }
              : undefined
          }
        >
          <Conversation className="flex-1 overflow-hidden min-h-0">
            <ConversationContent className={cn("flex flex-col w-full max-w-4xl mx-auto",
              messages.length === 0 ? "h-full justify-center pb-16" : "p-3 sm:p-6 space-y-6 pb-2"
            )}>
              {messages.length === 0 ? (
                /* Empty State / Hero - Perfectly Centered */
                <div className="flex flex-col items-center justify-center space-y-10 text-center animate-in fade-in duration-500 delay-100 flex-1 min-h-0">
                  <div className="space-y-6 max-w-2xl mx-auto px-4">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground drop-shadow-sm">
                      What will you build?
                    </h1>
                    <p className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-lg mx-auto">
                      Generate full-stack React components, pages, or entire apps with VibeCode Architect.
                    </p>
                  </div>

                  {/* Suggestions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl text-left px-4">
                    {activeSuggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit({ text: suggestion.prompt })}
                        className="p-5 rounded-2xl border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-primary/20 transition-all text-sm group flex items-start gap-4 hover:-translate-y-0.5"
                      >
                        <span className="text-2xl pt-0.5">{suggestion.emoji}</span>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-base group-hover:text-primary transition-colors">{suggestion.title}</span>
                          <span className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">{suggestion.prompt}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/50 hover:text-primary/80 cursor-pointer transition-colors py-2" onClick={refreshSuggestions}>
                    <SparklesIcon className="h-3.5 w-3.5" />
                    <span>Refresh ideas</span>
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
                          "animate-in fade-in slide-in-from-bottom-2 duration-300",
                          message.role === "user" ? "justify-end" : "justify-start",
                        )}
                      >
                        <MessageContent className={cn(
                          "w-full px-0 py-0 rounded-none",
                          message.role === "user" ? "items-end" : "items-start"
                        )}>
                          {message.role === "user" ? (
                            <div className="group relative inline-block max-w-[90%] sm:max-w-xl">
                              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
                              <div className="relative rounded-2xl bg-zinc-900 dark:bg-zinc-100 border border-zinc-800 dark:border-zinc-200 px-5 py-3 text-zinc-100 dark:text-zinc-900 shadow-xl text-sm leading-relaxed font-medium">
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
                                    <span className="font-semibold">Generation Complete</span>
                                    <span className="text-xs opacity-70">Project files ready</span>
                                  </div>
                                </div>
                              )}

                              {/* AI Response Text */}
                              {message.content && (
                                <div className="prose-wrapper animate-in fade-in duration-700">
                                  <AIResponse className="text-[15px] leading-relaxed">
                                    {message.content}
                                  </AIResponse>
                                </div>
                              )}

                              {/* Artifacts Grid */}
                              {message.files && Object.keys(message.files).length > 0 && (
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
                                            <span className={cn("opacity-70 text-xs", getFileTabIconClass(path))} />
                                          </div>
                                          <span className="truncate text-xs font-mono text-muted-foreground group-hover/file:text-foreground transition-colors min-w-0">{path}</span>
                                        </div>
                                      ))}
                                    {Object.keys(message.files).length > 4 && (
                                      <div className="flex items-center justify-center p-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60">
                                        + {Object.keys(message.files).length - 4} more
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
                    {isGenerating && (
                      <div className="flex items-center gap-4 py-8 animate-in fade-in duration-500 max-w-xl mx-auto px-4">
                        <div className="relative h-10 w-10 shrink-0">
                          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                          <div className="relative h-full w-full rounded-full border-2 border-t-primary border-r-primary/50 border-b-primary/20 border-l-transparent animate-spin" />
                          <SparklesIcon className="absolute inset-0 m-auto h-4 w-4 text-primary animate-pulse" />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold tracking-tight truncate">Architecting...</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60 truncate">AI processing</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Fixed Input Area - Always Visible */}
          <div className="relative p-12 sm:p-16 shrink-0 bg-transparent z-10">
            <div className="mx-auto w-full max-w-3xl relative">
              <PromptInput onSubmit={handleSubmit} className="w-full">
                <PromptInputBody className="relative flex flex-col w-full rounded-2xl border border-border/50 bg-background/80 backdrop-blur-2xl shadow-lg hover:shadow-primary/5 transition-all duration-500 focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30 group">
                  <div className="absolute -inset-[0.1px] bg-gradient-to-tr from-primary/10 to-transparent rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                  <PromptInputTextarea
                    placeholder={messages.length === 0 ? "Describe your dream application..." : "Ask a follow-up question..."}
                    disabled={isGenerating}
                    className="min-h-[44px] md:min-h-[52px] w-full p-3 md:p-4 text-sm md:text-base border-0 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/30 font-medium leading-relaxed overflow-y-auto no-scrollbar resize-none"
                  />
                  <PromptInputFooter className="px-3 md:px-4 pb-3 md:pb-4 pt-0 border-0 bg-transparent flex items-center justify-between">
                    <PromptInputTools>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground/40 hover:text-foreground h-8 w-8 md:h-9 md:w-9 rounded-full transition-all hover:bg-muted/50"
                        type="button"
                        onClick={() => toast.info("Attachments coming soon!")}
                      >
                        <PaperclipIcon className="h-4 w-4" />
                      </Button>
                      {isGenerating && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleStop}
                          className="ml-2 h-7 text-[9px] font-bold tracking-widest uppercase text-destructive hover:text-destructive hover:bg-destructive/10 px-3 rounded-full border border-destructive/20 transition-all active:scale-95"
                        >
                          Stop
                        </Button>
                      )}
                    </PromptInputTools>

                    <div className="flex items-center gap-3">
                      <PromptInputSubmit
                        disabled={isGenerating}
                        className={cn(
                          "h-9 w-9 md:h-10 md:w-10 rounded-xl transition-all duration-500 flex items-center justify-center",
                          isGenerating
                            ? "bg-muted text-muted-foreground cursor-not-allowed grayscale"
                            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/20 hover:shadow-primary/40"
                        )}
                        status={isGenerating ? "streaming" : undefined}
                      >
                        <Zap className={cn("h-4 w-4 md:h-5 md:w-5", isGenerating ? "animate-pulse" : "fill-current")} />
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
              className="hidden lg:flex w-1 hover:w-1.5 -ml-0.5 z-10 cursor-col-resize items-stretch bg-border/40 hover:bg-primary/50 transition-all delay-75"
            />
          )
        }

        {/* Right Panel - Code/Preview */}
        <AnimatePresence>
          {
            generatedComponent && isPanelOpen && (
              <motion.div
                initial={isMobile ? { y: "100%" } : { opacity: 0, x: 20 }}
                animate={isMobile ? { y: 0 } : { opacity: 1, x: 0 }}
                exit={isMobile ? { y: "100%" } : { opacity: 0, x: 20 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className={cn(
                  "flex flex-col bg-background text-foreground transition-all duration-300 border-l border-border shadow-2xl min-h-0",
                  // Mobile/Fullscreen: Fixed Cover. Desktop: Flex Item
                  isMobile || isFullscreen ? "fixed inset-0 z-50 w-full h-full" : "relative lg:flex-none min-h-0 h-full"
                )}
                style={
                  isDesktop && !isFullscreen
                    ? { width: `${previewWidthPct}%`, height: '100%' }
                    : undefined
                }
              >
                {/* Panel Header */}
                <div className="flex-none h-12 flex items-center bg-muted/30 border-b border-border select-none backdrop-blur-sm px-2 justify-between">
                  <div className="flex items-center gap-1 h-3/4 bg-muted/20 p-1 rounded-lg border border-border/50">
                    <button
                      onClick={() => setViewMode("preview")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all",
                        viewMode === "preview"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                    <button
                      onClick={() => setViewMode("code")}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-md transition-all",
                        viewMode === "code"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Code2Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Code</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Mobile Specific Close Button Primary */}
                    {isMobile && (
                      <Button
                        size="sm"
                        onClick={() => setIsPanelOpen(false)}
                        className="h-8 w-auto px-3 bg-primary text-primary-foreground hover:bg-primary/90 mr-1"
                      >
                        Done
                      </Button>
                    )}

                    {!isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-8 w-8 p-0"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                      >
                        {isFullscreen ? <Minimize2Icon className="h-4 w-4" /> : <Maximize2Icon className="h-4 w-4" />}
                      </Button>
                    )}
                    {!isMobile && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsPanelOpen(false)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col min-h-0 bg-background relative overflow-hidden">
                  {viewMode === "preview" ? (
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
                      <SandpackRuntimePreview
                        showConsole={!isMobile}
                        code={generatedComponent.code || ""}
                        files={{
                          ...(generatedComponent.files || {}),
                          ...editedFiles,
                        }}
                        entryFile={generatedComponent.entryFile}
                        className="flex-1 min-h-0"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 min-h-0 w-full">
                      {/* Sidebar hidden on mobile code view to save space? or overlay? */}
                      <div className={cn(
                        "flex-none border-r border-border bg-muted/20 flex flex-col transition-all",
                        isMobile ? "w-0 overflow-hidden hidden" : "w-60"
                      )}>
                        <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Explorer</div>
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
                              {Object.keys(generatedComponent.files).map(f => (
                                <option key={f} value={f}>{f}</option>
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
                              language={selectedFile.endsWith(".css") ? "css" : selectedFile.endsWith(".json") ? "json" : "typescript"}
                              value={editedFiles[selectedFile] || generatedComponent.files?.[selectedFile] || ""}
                              onChange={(value) => selectedFile && handleFileEdit(selectedFile, value || "")}
                              theme={isDark ? "vs-dark" : "light"}
                              options={{
                                minimap: { enabled: !isMobile },
                                fontSize: isMobile ? 12 : 13,
                                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                wordWrap: "on",
                                padding: { top: 12 },
                                automaticLayout: true,
                                lineNumbers: "on",
                                scrollBeyondLastLine: false,
                                renderLineHighlight: "line",
                                cursorBlinking: "smooth",
                                smoothScrolling: true,
                                // Hide syntax errors/markers
                                renderValidationDecorations: "off",
                                "semanticHighlighting.enabled": false,
                              }}
                              beforeMount={(monaco) => {
                                // Disable TypeScript diagnostics
                                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                                  noSemanticValidation: true,
                                  noSyntaxValidation: true,
                                });
                                monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                                  noSemanticValidation: true,
                                  noSyntaxValidation: true,
                                });
                              }}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                              Select file...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          }
        </AnimatePresence>
      </div >
    </div >
  );
}
