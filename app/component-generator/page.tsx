"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
} from "@/components/ai-elements/chain-of-thought";
import { SandpackRuntimePreview } from "@/components/sandpack-preview";
import { FileTree } from "@/app/component-generator/components/file-tree";
import { GeneratorHeader } from "@/app/component-generator/components/generator-header";
import {
  SuggestionsGrid,
  type Suggestion,
} from "@/app/component-generator/components/suggestions-grid";
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
  FileIcon,
  EyeIcon,
  SaveIcon,
  Loader2Icon,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";

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
        content: "⚡ Generating your component...",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const runGeneration = async (promptToSend: string) => {
          abortControllerRef.current = new AbortController();
          const response = await fetch("/api/generate-component", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptToSend,
              conversationHistory,
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

              setGeneratedComponent((prev) => ({
                code: files[nextEntry] || code || prev?.code || "",
                files: files,
                entryFile: nextEntry || entryFile || prev?.entryFile,
                language: "tsx",
                title: prev?.title || "Generated Component",
              }));
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
          setGeneratedComponent({
            code,
            files,
            entryFile,
            language,
            title: "Generated Component",
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
    [messages, isGenerating],
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

  return (
    <div className="flex h-screen flex-col bg-background">
      <GeneratorHeader
        hasGenerated={Boolean(generatedComponent)}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen(!isPanelOpen)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        onResetSplit={() => setPreviewWidthPct(50)}
      />

      {/* Main Content - Responsive Split Layout */}
      <div
        ref={splitContainerRef}
        className="flex flex-1 flex-col lg:flex-row overflow-hidden"
      >
        {/* Chat Section */}
        <div
          className={cn(
            "min-h-0 flex flex-col transition-all duration-300 ease-in-out w-full lg:border-r",
            isDesktop && generatedComponent && isPanelOpen && !isFullscreen
              ? "lg:flex-none"
              : "lg:flex-1",
            isFullscreen && "hidden lg:flex lg:w-0",
          )}
          style={
            isDesktop && generatedComponent && isPanelOpen && !isFullscreen
              ? { width: `${100 - previewWidthPct}%` }
              : undefined
          }
        >
          <Conversation className="flex-1 overflow-y-auto no-scrollbar">
            <ConversationContent
              className={
                messages.length === 0
                  ? "flex items-center justify-center min-h-full"
                  : ""
              }
            >
              <div
                className={cn(
                  "w-full px-3 sm:px-4 md:px-6",
                  messages.length === 0
                    ? "max-w-5xl mx-auto py-8"
                    : "max-w-4xl mx-auto",
                )}
              >
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    title="Welcome to VibeCode AI"
                    description="Your advanced React development assistant. Chat with me to discuss code, architecture, and best practices, or ask me to build complete multi-page applications with any packages you need."
                    icon={
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 shadow-lg">
                        <SparklesIcon className="h-10 w-10 text-primary" />
                      </div>
                    }
                  >
                    <SuggestionsGrid
                      suggestions={activeSuggestions}
                      onRefresh={refreshSuggestions}
                      onPick={(prompt) => handleSubmit({ text: prompt })}
                    />
                    <div className="mt-6 text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Or ask me anything, or describe what you want to build
                      </p>
                      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Code2Icon className="h-3 w-3" />
                          <span>Multi-Page Apps</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          <span>Any NPM Package</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <SparklesIcon className="h-3 w-3" />
                          <span>Conversational AI</span>
                        </div>
                      </div>
                    </div>
                  </ConversationEmptyState>
                ) : (
                  <div className="space-y-6 py-6">
                    {messages.map((message) => (
                      <Message key={message.id} from={message.role}>
                        <MessageAvatar
                          src={
                            message.role === "user"
                              ? "/logos/671ff00d29c65f1f25fb28c0_95.png"
                              : "/logos/66e99db1f5c63f46f7415051_020.png"
                          }
                          name={message.role === "user" ? "You" : "VibeCode AI"}
                          className="h-8 w-8 md:h-9 md:w-9"
                        />
                        <MessageContent variant="flat">
                          {message.role === "user" ? (
                            <p className="m-0 text-sm md:text-base">
                              {message.content}
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {message.reasoning && (
                                <ChainOfThought defaultOpen={false}>
                                  <ChainOfThoughtHeader>
                                    <div className="flex items-center gap-2">
                                      <SparklesIcon className="h-4 w-4" />
                                      AI Thinking Process
                                    </div>
                                  </ChainOfThoughtHeader>
                                  <ChainOfThoughtContent>
                                    <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                                      {message.reasoning}
                                    </div>
                                  </ChainOfThoughtContent>
                                </ChainOfThought>
                              )}
                              {message.content && (
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                  <AIResponse>{message.content}</AIResponse>
                                </div>
                              )}
                              {message.files &&
                                Object.keys(message.files).length > 0 && (
                                  <div className="mt-4 p-4 rounded-lg border bg-card">
                                    <div className="flex items-start gap-3">
                                      <div className="p-2 rounded-lg bg-primary/10">
                                        <CodeIcon className="h-5 w-5 text-primary" />
                                      </div>
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-sm mb-1">
                                          Project Generated Successfully!
                                        </h4>
                                        <p className="text-sm text-muted-foreground mb-3">
                                          {Object.keys(message.files).length}{" "}
                                          files created
                                        </p>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
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
                                            View Preview
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
                                          >
                                            <Code2Icon className="h-4 w-4 mr-2" />
                                            View Code
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </MessageContent>
                      </Message>
                    ))}
                  </div>
                )}
              </div>
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Input Section - Enhanced */}
          <div className="border-t p-2 sm:p-3 md:p-4 shrink-0 bg-background">
            <div className="mx-auto w-full max-w-4xl">
              <PromptInput onSubmit={handleSubmit} className="w-full">
                <PromptInputBody>
                  <PromptInputTextarea
                    placeholder="Ask me anything or describe what you want to build... (e.g., 'Build a portfolio site with 4 pages' or 'How do I use React Router?')"
                    disabled={isGenerating}
                    className="min-h-12 md:min-h-16 text-sm md:text-base resize-none"
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    {isGenerating && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleStop}
                        className="text-xs"
                      >
                        <XIcon className="mr-2 h-3 w-3" />
                        Stop
                      </Button>
                    )}
                    <p className="hidden md:block text-xs text-muted-foreground">
                      Press{" "}
                      <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">
                        Enter
                      </kbd>{" "}
                      to send
                    </p>
                  </PromptInputTools>
                  <PromptInputSubmit
                    disabled={isGenerating}
                    status={isGenerating ? "streaming" : undefined}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>

        {/* Desktop resize handle */}
        {isDesktop && generatedComponent && isPanelOpen && !isFullscreen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            onPointerDown={startResize}
            className="hidden lg:flex w-3 cursor-col-resize items-stretch bg-transparent hover:bg-muted/60 transition-colors"
          >
            <div className="mx-auto my-2 w-px rounded-full bg-border/70" />
          </div>
        )}

        {/* Preview/Code Panel */}
        {generatedComponent && isPanelOpen && (
          <div
            className={cn(
              "border-t lg:border-t-0 transition-all duration-300 bg-background overflow-hidden flex flex-col",
              isFullscreen ? "w-full" : "w-full lg:flex-none",
            )}
            style={
              isDesktop && !isFullscreen
                ? { width: `${previewWidthPct}%` }
                : undefined
            }
          >
            {/* Toggle Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={viewMode === "preview" ? "default" : "ghost"}
                    onClick={() => setViewMode("preview")}
                    className="h-8 gap-2"
                  >
                    <EyeIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "code" ? "default" : "ghost"}
                    onClick={() => setViewMode("code")}
                    className="h-8 gap-2"
                  >
                    <Code2Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">Code</span>
                  </Button>
                </div>

                {/* Live generation status */}
                {currentlyGeneratingFile && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 border border-primary/20">
                    <Loader2Icon className="h-3 w-3 text-primary animate-spin" />
                    <span className="text-xs text-primary font-medium hidden md:inline">
                      Generating {currentlyGeneratingFile.split("/").pop()}...
                    </span>
                    <span className="text-xs text-primary font-medium md:hidden">
                      Generating...
                    </span>
                  </div>
                )}
              </div>

              {viewMode === "code" &&
                selectedFile &&
                !currentlyGeneratingFile && (
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <span className="text-xs text-muted-foreground">
                        Unsaved changes
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleSaveFile}
                      disabled={!hasUnsavedChanges}
                      className="h-8 gap-2"
                    >
                      <SaveIcon className="h-3 w-3" />
                      <span className="hidden sm:inline">Save</span>
                    </Button>
                  </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 flex min-h-0">
              {/* Main Content */}
              <div className="flex-1 min-h-0">
                {viewMode === "preview" ? (
                  <div className="h-full w-full">
                    {isGenerating || currentlyGeneratingFile ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center space-y-2 p-6 max-w-sm">
                          <Loader2Icon className="h-10 w-10 mx-auto opacity-70 animate-spin" />
                          <p className="text-sm">Generating files…</p>
                          <p className="text-xs leading-relaxed">
                            Switch to{" "}
                            <span className="font-medium text-foreground">
                              Code
                            </span>{" "}
                            to watch files appear in real time.
                          </p>
                        </div>
                      </div>
                    ) : generatedComponent.files &&
                      Object.keys(generatedComponent.files).length > 0 ? (
                      <SandpackRuntimePreview
                        showConsole={true}
                        code={generatedComponent.code || ""}
                        files={{
                          ...generatedComponent.files,
                          ...editedFiles,
                        }}
                        entryFile={generatedComponent.entryFile}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center space-y-2">
                          <Code2Icon className="h-12 w-12 mx-auto opacity-50" />
                          <p className="text-sm">No files to preview</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex min-h-0">
                    {generatedComponent.files &&
                      Object.keys(generatedComponent.files).length > 1 && (
                        <div className="hidden md:block w-64 border-r bg-card overflow-y-auto">
                          <FileTree
                            files={generatedComponent.files}
                            selectedFile={selectedFile}
                            onFileSelect={handleFileSelect}
                            generatingFile={currentlyGeneratingFile}
                          />
                        </div>
                      )}

                    <div className="flex-1 min-h-0 flex flex-col bg-background">
                      {selectedFile ? (
                        <>
                          <div className="px-4 py-2 border-b bg-card text-sm text-muted-foreground flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileIcon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{selectedFile}</span>
                            </div>

                            {generatedComponent.files &&
                              Object.keys(generatedComponent.files).length >
                                1 && (
                                <select
                                  className="md:hidden h-8 max-w-[45%] rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                  value={selectedFile}
                                  onChange={(e) =>
                                    handleFileSelect(e.target.value)
                                  }
                                  aria-label="Select file"
                                >
                                  {Object.keys(generatedComponent.files).map(
                                    (path) => (
                                      <option key={path} value={path}>
                                        {path}
                                      </option>
                                    ),
                                  )}
                                </select>
                              )}
                          </div>
                          <Editor
                            height="100%"
                            defaultLanguage="typescript"
                            language={
                              selectedFile?.endsWith(".tsx") ||
                              selectedFile?.endsWith(".ts")
                                ? "typescript"
                                : selectedFile?.endsWith(".css")
                                  ? "css"
                                  : selectedFile?.endsWith(".json")
                                    ? "json"
                                    : "javascript"
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
                            theme={isDark ? "vs-dark" : "vs"}
                            options={{
                              minimap: { enabled: false },
                              renderValidationDecorations: "off",
                              fontSize: 14,
                              lineNumbers: "on",
                              scrollBeyondLastLine: true,
                              wordWrap: "on",
                              automaticLayout: true,
                              readOnly: !selectedFile,
                            }}
                          />
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center space-y-2">
                            <FileIcon className="h-12 w-12 mx-auto opacity-50" />
                            <p className="text-sm">
                              Select a file from the tree to edit
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
