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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  RefreshCw,
  UploadCloud,
  Sun,
  Moon,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StickToBottom } from "use-stick-to-bottom";
import {
  SANDPACK_BASE_FILES,
  SANDPACK_SHADCN_FILES,
} from "@/lib/sandpack-files";

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

const FileIconComponent = ({
  path,
  className,
}: {
  path: string;
  className?: string;
}) => {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (ext === "tsx" || ext === "jsx")
    return <FileCode2Icon className={cn("h-4 w-4 text-cyan-500", className)} />;
  if (ext === "ts" || ext === "js")
    return <Code2Icon className={cn("h-4 w-4 text-blue-500", className)} />;
  if (ext === "css")
    return <Hash className={cn("h-4 w-4 text-purple-500", className)} />;
  if (ext === "json")
    return <FileJson className={cn("h-4 w-4 text-amber-500", className)} />;
  return (
    <FileIcon className={cn("h-4 w-4 text-muted-foreground", className)} />
  );
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
  const [isOpen, setIsOpen] = useState(false); // Default to closed for a cleaner 'loader' look

  if (!content) return null;

  return (
    <div className="group/thinking mb-4 overflow-hidden rounded-2xl border border-border/40 bg-muted/5 transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          {!isFinished ? (
            <div className="flex h-5 w-5 items-center justify-center">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckIcon className="h-3 w-3 text-emerald-500" />
            </div>
          )}
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/60 transition-colors group-hover/thinking:text-foreground">
            {isFinished ? "Analysis Finalized" : "Architecting Masterpiece..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isFinished && (
            <div className="flex gap-1 pr-2">
              <span className="h-0.5 w-0.5 rounded-full bg-primary/40 animate-bounce delay-0" />
              <span className="h-0.5 w-0.5 rounded-full bg-primary/40 animate-bounce delay-150" />
              <span className="h-0.5 w-0.5 rounded-full bg-primary/40 animate-bounce delay-300" />
            </div>
          )}
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 opacity-30 group-hover/thinking:opacity-80 transition-all duration-300",
              isOpen && "rotate-90",
            )}
          />
        </div>
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
              <div className="relative rounded-xl bg-background/40 p-3.5 text-xs leading-relaxed text-muted-foreground/60 font-mono shadow-inner border border-border/10 italic">
                {content}
                {!isFinished && (
                  <span className="inline-block w-1 h-3 ml-1 bg-primary/30 animate-pulse align-middle" />
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
  icon?: string;
  title: string;
  prompt: string;
};

const SMART_SUGGESTIONS: Suggestion[] = [
  {
    icon: "landing",
    title: "SaaS Landing",
    prompt:
      "SaaS landing page with hero + 2 CTAs, logo strip, 3-feature grid, pricing toggle, FAQ, and footer. Clean spacing, responsive, light/dark.",
  },
  {
    icon: "landing",
    title: "Memecoin Launch",
    prompt:
      "Crypto memecoin landing with bold hero, tokenomics cards, roadmap timeline, community stats, and audit badge. Neon accents, fully responsive, light/dark.",
  },
  {
    icon: "landing",
    title: "IT Marketing",
    prompt:
      "Tech/IT services marketing landing with services grid, case studies, client logos, KPI strip, and contact CTA. Sleek corporate, responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Hero Split",
    prompt:
      "Hero section with split layout, bold headline, subtext, 2 CTAs, and a product preview card. Fully responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Hero with Proof",
    prompt:
      "Hero section with logo strip + social proof stats, minimal form or CTA, and a soft gradient backdrop. Fully responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Hero Centered",
    prompt:
      "Centered hero section with headline, 2 CTAs, short value props, and a small testimonial pill. Fully responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Footer",
    prompt:
      "Design a multi-column footer with product/company/resources links, newsletter input, and legal row. Add a small brand mark and light divider lines.",
  },
  {
    icon: "stats",
    title: "Stats Strip",
    prompt:
      "Add a stats strip with 4 metrics, tiny captions, and a faint grid background. Include a simple count-up animation when scrolled into view.",
  },
];

export default function ComponentGeneratorPage() {
  const { resolvedTheme } = useTheme();
  const { data: session } = useSession();
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
    SMART_SUGGESTIONS.slice(0, 6),
  );
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [isPreviewDark, setIsPreviewDark] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingPublishDetails, setIsGeneratingPublishDetails] =
    useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishCategory, setPublishCategory] = useState("");
  const [publishTags, setPublishTags] = useState("");
  const [publishThumbnailUrl, setPublishThumbnailUrl] = useState("");
  const publishThumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = session?.user?.role === "admin";

  // Rotate suggestions for variety
  // AI-powered suggestions refresh
  const refreshSuggestions = useCallback(async () => {
    setIsRefreshingSuggestions(true);
    try {
      const resp = await fetch("/api/generate-suggestions", { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          setActiveSuggestions(data.slice(0, 6));
          return;
        }
      }
      // Fallback to shuffle if API fails
      const shuffled = [...SMART_SUGGESTIONS].sort(() => Math.random() - 0.5);
      setActiveSuggestions(shuffled.slice(0, 6));
    } catch (e) {
      const shuffled = [...SMART_SUGGESTIONS].sort(() => Math.random() - 0.5);
      setActiveSuggestions(shuffled.slice(0, 6));
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
      const filesStart = input.search(/<files\b/i);
      const firstFileTag = input.search(/<(?:file|entry)\b/i);

      // If we don't find <files> but we do find <file> or <entry>, we use that as the start
      const start = filesStart !== -1 ? filesStart : firstFileTag;

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
      // Handle <file path="..."> or <entry path="..."> or <file name="...">
      const tagRegex =
        /<(?:file|entry)\s+(?:path|name)=["']([^"']+)["'][^>]*>/gi;
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

        // Look for either </file> or </entry>
        const closeFileIdx = block.indexOf("</file>", contentStart);
        const closeEntryIdx = block.indexOf("</entry>", contentStart);

        let closeIdx = -1;
        if (
          closeFileIdx !== -1 &&
          (closeEntryIdx === -1 || closeFileIdx < closeEntryIdx)
        ) {
          closeIdx = closeFileIdx;
        } else {
          closeIdx = closeEntryIdx;
        }

        if (closeIdx !== -1 && closeIdx < nextTagStart) sliceEnd = closeIdx;

        const content = block.slice(contentStart, sliceEnd).trim();
        if (content) files[normalized] = content;
      }

      const finalFiles = Object.keys(files).length ? files : undefined;
      if (!entryFile)
        entryFile =
          finalFiles?.["/entry.tsx"] ||
          finalFiles?.["/App.tsx"] ||
          (finalFiles ? Object.keys(finalFiles)[0] : undefined);
      return { files: finalFiles, entryFile };
    };

    const { files, entryFile } = extractFilesLoose(text);

    // Remove all XML-like tags and their internal content from the displayed chat text
    let content = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    content = content.replace(/<files\b[\s\S]*?(<\/files>|$)/gi, "");
    content = content.replace(/<component\b[\s\S]*?(<\/component>|$)/gi, "");
    content = content.replace(
      /<(?:file|entry)\b[\s\S]*?(?:<\/(?:file|entry)>|$)/gi,
      "",
    );

    // Aggressively remove any lingering markdown code fences to prevent "spillage" in chat
    content = content.replace(/```[\s\S]*?(```|$)/g, "");

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

  // File operation handlers
  const handleFileAdd = useCallback((path: string, isFolder: boolean) => {
    if (isFolder) {
      // For folders, we don't create actual entries, just a placeholder file inside
      const placeholderPath = `${path}/.gitkeep`;
      setGeneratedComponent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          files: {
            ...prev.files,
            [placeholderPath]: "",
          },
        };
      });
      toast.success(`Folder created: ${path}`);
    } else {
      setGeneratedComponent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          files: {
            ...prev.files,
            [path]: "// New file\n",
          },
        };
      });
      setSelectedFile(path);
      toast.success(`File created: ${path}`);
    }
  }, []);

  const handleFileRename = useCallback(
    (oldPath: string, newPath: string) => {
      setGeneratedComponent((prev) => {
        if (!prev || !prev.files) return prev;

        const { [oldPath]: content, ...restFiles } = prev.files;
        if (content === undefined) return prev;

        // Update selected file if it was the renamed file
        if (selectedFile === oldPath) {
          setSelectedFile(newPath);
        }

        // Update edited files if the renamed file was edited
        if (editedFiles[oldPath]) {
          setEditedFiles((prevEdited) => {
            const { [oldPath]: editedContent, ...restEdited } = prevEdited;
            return { ...restEdited, [newPath]: editedContent };
          });
        }

        return {
          ...prev,
          files: {
            ...restFiles,
            [newPath]: content,
          },
        };
      });
      toast.success(`Renamed: ${oldPath} → ${newPath}`);
    },
    [selectedFile, editedFiles],
  );

  const handleFileDelete = useCallback(
    (path: string) => {
      setGeneratedComponent((prev) => {
        if (!prev || !prev.files) return prev;

        const { [path]: _, ...restFiles } = prev.files;

        // Clear selected file if it was deleted
        if (selectedFile === path) {
          setSelectedFile(null);
        }

        // Remove from edited files
        setEditedFiles((prevEdited) => {
          const { [path]: __, ...restEdited } = prevEdited;
          return restEdited;
        });

        return {
          ...prev,
          files: restFiles,
        };
      });
      toast.success(`Deleted: ${path}`);
    },
    [selectedFile],
  );

  const [copiedFileContent, setCopiedFileContent] = useState<string | null>(
    null,
  );

  const handleFileCopy = useCallback(
    (path: string) => {
      const allFiles = {
        ...SANDPACK_BASE_FILES,
        ...SANDPACK_SHADCN_FILES,
        ...(generatedComponent?.files || {}),
      };

      const content = allFiles[path];
      if (content !== undefined) {
        setCopiedFileContent(content);
        toast.success(`Copied: ${path}`);
      }
    },
    [generatedComponent],
  );

  const handleFilePaste = useCallback(
    (targetPath: string) => {
      if (copiedFileContent === null) {
        toast.error("No file copied");
        return;
      }

      // Generate a new filename by appending "copy" or incrementing
      const fileName = targetPath.split("/").pop() || "file";
      const baseName = fileName.replace(/\.[^.]+$/, "");
      const ext = fileName.includes(".")
        ? fileName.substring(fileName.lastIndexOf("."))
        : "";

      let newPath = `${targetPath}/${baseName}_copy${ext}`;
      let counter = 1;

      const allFiles = {
        ...SANDPACK_BASE_FILES,
        ...SANDPACK_SHADCN_FILES,
        ...(generatedComponent?.files || {}),
      };

      while (allFiles[newPath]) {
        newPath = `${targetPath}/${baseName}_copy${counter}${ext}`;
        counter++;
      }

      setGeneratedComponent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          files: {
            ...prev.files,
            [newPath]: copiedFileContent,
          },
        };
      });

      toast.success(`Pasted to: ${newPath}`);
    },
    [copiedFileContent, generatedComponent],
  );

  const getLastUserPrompt = useCallback(() => {
    const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
    return lastUser?.content?.trim() || "";
  }, [messages]);

  const openPublishDialog = useCallback(() => {
    if (!generatedComponent) {
      toast.error("Generate a component before publishing.");
      return;
    }
    setPublishTitle(
      generatedComponent.title &&
        generatedComponent.title !== "Generated Component"
        ? generatedComponent.title
        : "New Vibecode Component",
    );
    const prompt = getLastUserPrompt();
    setPublishDescription(
      prompt
        ? prompt.slice(0, 280)
        : "AI-generated component built in Shadway.",
    );
    setIsPublishOpen(true);
  }, [generatedComponent, getLastUserPrompt]);

  const handleGeneratePublishDetails = useCallback(async () => {
    if (!generatedComponent) {
      toast.error("Generate a component before generating details.");
      return;
    }

    setIsGeneratingPublishDetails(true);
    try {
      const response = await fetch("/api/vibecode/generate-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: getLastUserPrompt(),
          code: generatedComponent.code,
          files: generatedComponent.files,
          entryFile: generatedComponent.entryFile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to generate details");
      }

      const data = await response.json();
      if (typeof data?.title === "string") {
        setPublishTitle(data.title);
      }
      if (typeof data?.description === "string") {
        setPublishDescription(data.description);
      }
      if (typeof data?.category === "string") {
        setPublishCategory(data.category);
      }
      if (Array.isArray(data?.tags)) {
        setPublishTags(data.tags.join(", "));
      }

      toast.success("Generated details from AI.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate details";
      toast.error(message);
    } finally {
      setIsGeneratingPublishDetails(false);
    }
  }, [generatedComponent, getLastUserPrompt]);

  const handleThumbnailUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploadingThumbnail(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.error || "Failed to upload thumbnail");
        }

        const data = await response.json();
        if (data?.url) {
          setPublishThumbnailUrl(data.url);
          toast.success("Thumbnail uploaded.");
        } else {
          throw new Error("Upload succeeded without a URL");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to upload thumbnail";
        toast.error(message);
      } finally {
        setIsUploadingThumbnail(false);
        event.target.value = "";
      }
    },
    [],
  );

  const handlePublish = useCallback(async () => {
    if (!generatedComponent) {
      toast.error("No generated component to publish.");
      return;
    }
    if (!isAdmin) {
      toast.error("Admin access required to publish.");
      return;
    }
    if (!publishTitle.trim() || !publishDescription.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    if (isUploadingThumbnail) {
      toast.error("Please wait for the thumbnail upload to finish.");
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch("/api/vibecode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: publishTitle,
          description: publishDescription,
          category: publishCategory || undefined,
          tags: publishTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          thumbnailUrl: publishThumbnailUrl || undefined,
          prompt: getLastUserPrompt(),
          code: generatedComponent.code,
          files: generatedComponent.files,
          entryFile:
            generatedComponent.files &&
            generatedComponent.entryFile &&
            generatedComponent.files[generatedComponent.entryFile]
              ? generatedComponent.entryFile
              : undefined,
          language: generatedComponent.language || "tsx",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to publish component");
      }

      const data = await response.json();
      toast.success("Component published to Vibecode!");
      setIsPublishOpen(false);
      if (data?.slug) {
        toast.success(`Published as ${data.slug}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to publish component";
      toast.error(message);
    } finally {
      setIsPublishing(false);
    }
  }, [
    generatedComponent,
    isAdmin,
    publishTitle,
    publishDescription,
    publishCategory,
    publishTags,
    publishThumbnailUrl,
    isUploadingThumbnail,
    getLastUserPrompt,
  ]);

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
            ? {
                ...SANDPACK_BASE_FILES,
                ...SANDPACK_SHADCN_FILES,
                ...generatedComponent.files,
                ...editedFiles,
              }
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
                      content: displayContent?.trim() || "",
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
          setViewMode("preview");
          setPreviewReloadKey((prev) => prev + 1);
        } else {
          // If no artifacts found, still update with what we have (content/reasoning)
          // but don't force a retry. The enhanced prompt should handle this.
          if (!raw) {
            toast.error("AI did not return any content. Please try again.");
          }
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

  const handleReset = useCallback(() => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
    }
    setMessages([]);
    setGeneratedComponent(null);
    setIsPanelOpen(false);
    setEditedFiles({});
    setSelectedFile(null);
    setHasUnsavedChanges(false);
    setCurrentlyGeneratingFile(null);
    setIsGenerating(false);
    toast.success("New session started");
  }, [isGenerating]);

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
        onReset={handleReset}
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-12 bg-gradient-to-b from-background via-background/40 to-transparent pointer-events-none z-10 backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-3xl h-36 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-20 backdrop-blur-[12px] [mask-image:linear-gradient(to_top,black,transparent)]" />

          <Conversation className="flex-1 overflow-hidden min-h-0 relative">
            <ConversationContent
              className={cn(
                "flex flex-col w-full max-w-3xl mx-auto",
                messages.length === 0
                  ? "min-h-full justify-center py-12 md:py-24"
                  : "p-3 sm:p-6 space-y-6 pb-32",
              )}
            >
              {messages.length === 0 ? (
                /* Premium Static Empty State */
                <div className="flex flex-col items-center justify-center max-w-3xl mx-auto text-center px-4 flex-1 relative w-full">
                  <div className="space-y-6 w-full">
                    <h2 className="text-2xl md:text-4xl font-serif lg:text-5xl font-black tracking-tighter text-foreground uppercase leading-[0.9] scale-y-110">
                      SHADWAY{" "}
                      <span className="text-primary not-italic tracking-normal">
                        ARCHITECT
                      </span>
                    </h2>
                    <p className="max-w-xl mx-auto text-[11px] md:text-sm text-muted-foreground/40 font-medium leading-relaxed px-4">
                      The next-gen AI engineering engine. Transform vision into
                      production-ready React components with unprecedented
                      speed.
                    </p>
                  </div>

                  <div className="w-full mt-4 md:mt-6">
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
                              ? "items-end ml-auto"
                              : "items-start",
                          )}
                        >
                          {message.role === "user" ? (
                            <div className="flex w-full justify-end pr-6 md:pr-8 lg:pr-10">
                              <div className="group relative flex max-w-[85%] sm:max-w-2xl lg:max-w-3xl">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 rounded-[24px] blur-md opacity-0 group-hover:opacity-100 transition duration-700" />
                                <div className="relative rounded-[22px] bg-foreground text-background dark:bg-zinc-100 dark:text-zinc-900 px-6 py-3.5 shadow-sm text-[14px] leading-relaxed font-medium">
                                  {message.content}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full space-y-8">
                              {/* Thinking Process - Always First */}
                              {message.reasoning && (
                                <div className="max-w-xl mx-auto w-full">
                                  <ThinkingProcess
                                    content={message.reasoning}
                                    isFinished={
                                      !!(message.content || message.files)
                                    }
                                  />
                                </div>
                              )}

                              {/* AI Response Text - Premium Conversational Typography */}
                              {message.content && (
                                <div className="max-w-3xl px-1">
                                  <AIResponse className="text-[15px] leading-[1.6] text-foreground/90 font-medium tracking-tight">
                                    {message.content}
                                  </AIResponse>
                                </div>
                              )}

                              {/* Compact Artifact Capsule Card */}
                              {message.files &&
                                Object.keys(message.files).length > 0 && (
                                  <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-lg max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-700">
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                                    <div className="p-4 md:p-5 space-y-4">
                                      <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                          <CheckIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <h3 className="text-xs font-extrabold uppercase tracking-[0.2em] text-foreground/80">
                                            Deploy Ready
                                          </h3>
                                          <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-widest mt-0.5">
                                            {Object.keys(message.files).length}{" "}
                                            files synced
                                          </p>
                                        </div>
                                        <div className="ml-auto flex items-center gap-1.5">
                                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                                          <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider">
                                            Ready
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-1.5">
                                        {Object.keys(message.files)
                                          .slice(0, 4)
                                          .map((path) => (
                                            <div
                                              key={path}
                                              className="inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full bg-muted/20 border border-border/40 hover:border-primary/30 transition-all duration-300"
                                            >
                                              <div className="h-5 w-5 rounded-full bg-background flex items-center justify-center border border-border/20">
                                                <FileIconComponent
                                                  path={path}
                                                  className="h-3 w-3"
                                                />
                                              </div>
                                              <span className="text-[10px] font-semibold text-muted-foreground/80 truncate max-w-[72px]">
                                                {path.split("/").pop()}
                                              </span>
                                            </div>
                                          ))}
                                        {Object.keys(message.files).length >
                                          4 && (
                                          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted/15 border border-transparent text-[10px] font-semibold text-muted-foreground/50">
                                            +
                                            {Object.keys(message.files).length -
                                              4}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                          size="sm"
                                          className="h-10 sm:flex-1 bg-primary text-primary-foreground font-semibold text-[11px] rounded-lg shadow-sm transition-all hover:shadow-md hover:shadow-primary/15"
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
                                          <Zap className="h-3.5 w-3.5 mr-2" />
                                          Preview
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
                                          className="h-10 sm:flex-1 border-border/60 bg-transparent hover:bg-muted/30 text-foreground/80 font-semibold text-[11px] rounded-lg transition-all"
                                        >
                                          <Code2Icon className="h-3.5 w-3.5 mr-2" />
                                          Code
                                        </Button>
                                      </div>
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
                        <div className="flex items-center gap-3 py-4 animate-in fade-in slide-in-from-left-1 duration-500 self-start ml-4">
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          <span className="text-[11px] font-bold tracking-wider text-muted-foreground/50 uppercase">
                            Architecting...
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Fixed Input Area - Centered and Elevated */}
          <div className="relative px-6 pb-12 pt-0 shrink-0 bg-transparent z-30 mt-auto">
            <div className="mx-auto w-full max-w-3xl relative">
              <PromptInput
                onSubmit={handleSubmit}
                className="w-full [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none [&_[data-slot=input-group]]:rounded-none [&_[data-slot=input-group]]:ring-0 [&_[data-slot=input-group]]:outline-none [&_[data-slot=input-group]]:focus-within:ring-0 [&_[data-slot=input-group]]:focus-within:outline-none"
              >
                <PromptInputBody>
                  <div className="relative w-full rounded-[24px] border border-border/60 bg-background/85 shadow-[0_16px_50px_-32px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-primary/40 hover:shadow-[0_18px_60px_-32px_rgba(0,0,0,0.6)] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(140px_80px_at_12%_20%,hsl(var(--primary)/0.10),transparent_60%),radial-gradient(140px_80px_at_88%_80%,hsl(var(--primary)/0.08),transparent_55%)] opacity-0 transition-opacity pointer-events-none z-0 focus-within:opacity-100" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                    <PromptInputTextarea
                      placeholder={
                        messages.length === 0
                          ? "What are we building today?"
                          : "Refine your design..."
                      }
                      disabled={isGenerating}
                      className="relative z-10 h-12 md:h-14 max-h-14 min-h-12 w-full px-3 md:px-4 pt-3 md:pt-3.5 pb-2 text-sm border-0 focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50 font-medium leading-relaxed overflow-y-auto no-scrollbar resize-none text-pretty [field-sizing:fixed]"
                    />

                    <PromptInputFooter className="relative z-10 px-3 md:px-4 pb-3 md:pb-3.5 pt-0 border-0 bg-transparent flex items-center justify-between">
                      <PromptInputTools className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground/60 hover:text-foreground h-8 w-8 md:h-9 md:w-9 rounded-lg transition-all hover:bg-muted/60"
                          type="button"
                          onClick={() => toast.info("Attachments coming soon!")}
                        >
                          <PaperclipIcon className="h-4 w-4" />
                        </Button>

                        <div className="h-3 w-[1px] bg-border/50 mx-0.5" />
                      </PromptInputTools>

                      <div className="flex items-center gap-2">
                        <PromptInputSubmit
                          disabled={false}
                          onClick={isGenerating ? handleStop : undefined}
                          className={cn(
                            "h-9 w-9 md:h-10 md:w-10 rounded-xl transition-all duration-300 flex items-center justify-center",
                            isGenerating
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/20",
                          )}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </PromptInputSubmit>
                      </div>
                    </PromptInputFooter>
                  </div>
                </PromptInputBody>
              </PromptInput>
            </div>
          </div>
        </div>

        {/* Desktop Splitter Handle */}
        {isDesktop && generatedComponent && isPanelOpen && !isFullscreen && (
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
        )}

        {/* Right Panel - Code/Preview */}
        <AnimatePresence>
          {generatedComponent && isPanelOpen && (
            <motion.div
              initial={
                isMobile ? { y: "100%" } : { opacity: 0, scale: 0.98, x: 20 }
              }
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, x: 0 }}
              exit={
                isMobile ? { y: "100%" } : { opacity: 0, scale: 0.98, x: 20 }
              }
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn(
                "flex flex-col bg-background text-foreground transition-all duration-300 border border-border/60 shadow-2xl overflow-hidden backdrop-blur-xl",
                isMobile || isFullscreen
                  ? "fixed inset-0 z-50 w-full h-full rounded-none"
                  : "relative flex-none h-[calc(100%-1.5rem)] my-3 mr-3 rounded-2xl md:rounded-3xl z-40",
              )}
              style={
                isDesktop && !isFullscreen
                  ? {
                      width: `${previewWidthPct}%`,
                      height: "calc(100% - 1.5rem)",
                    }
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

                <div className="ml-2 border-l border-border/40 pl-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewReloadKey((prev) => prev + 1)}
                    className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-primary/10 text-muted-foreground/80 hover:text-primary transition-all hover:shadow-sm"
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                    Reload
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsPreviewDark((prev) => !prev);
                    }}
                    className="h-8 w-8 rounded-lg hover:bg-primary/10 text-muted-foreground/80 hover:text-primary transition-all hover:shadow-sm"
                    title={isPreviewDark ? "Switch to light" : "Switch to dark"}
                  >
                    {isPreviewDark ? (
                      <Sun className="h-3.5 w-3.5" />
                    ) : (
                      <Moon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {isAdmin && (
                  <div className="ml-2 border-l border-border pl-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openPublishDialog}
                      className="h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wider border-primary/40 hover:border-primary/70 hover:bg-primary/10 text-primary transition-all"
                    >
                      <SparklesIcon className="mr-2 h-3.5 w-3.5" />
                      Publish
                    </Button>
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
                    "absolute inset-0 flex flex-col min-h-0 transition-all duration-300",
                    isPreviewDark ? "bg-zinc-950" : "bg-white",
                    viewMode === "preview"
                      ? "opacity-100 z-10 visible scale-100"
                      : "opacity-0 z-0 invisible scale-[0.98]",
                  )}
                >
                  <SandpackRuntimePreview
                    key={`preview-${previewReloadKey}`}
                    showConsole={false}
                    code={generatedComponent.code || ""}
                    files={{
                      ...(generatedComponent.files || {}),
                      ...editedFiles,
                    }}
                    entryFile={generatedComponent.entryFile}
                    className="flex-1 min-h-0 h-full"
                    isDarkTheme={isPreviewDark}
                  />
                </div>

                {/* Code Editor Panel */}
                <div
                  className={cn(
                    "absolute inset-0 flex min-h-0 w-full transition-all duration-300",
                    viewMode === "code"
                      ? "opacity-100 z-10 visible scale-100"
                      : "opacity-0 z-0 invisible scale-[0.98]",
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
                        files={{
                          ...SANDPACK_BASE_FILES,
                          ...SANDPACK_SHADCN_FILES,
                          ...(generatedComponent.files || {}),
                        }}
                        selectedFile={selectedFile}
                        onFileSelect={handleFileSelect}
                        generatingFile={currentlyGeneratingFile}
                        onFileAdd={handleFileAdd}
                        onFileRename={handleFileRename}
                        onFileDelete={handleFileDelete}
                        onFileCopy={handleFileCopy}
                        onFilePaste={handleFilePaste}
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
                          {Object.keys({
                            ...SANDPACK_BASE_FILES,
                            ...SANDPACK_SHADCN_FILES,
                            ...(generatedComponent.files || {}),
                          }).map((f) => (
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
                            (
                              {
                                ...SANDPACK_BASE_FILES,
                                ...SANDPACK_SHADCN_FILES,
                                ...(generatedComponent.files || {}),
                              } as Record<string, string>
                            )[selectedFile] ||
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
                            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
                              {
                                noSemanticValidation: true,
                                noSyntaxValidation: true,
                              },
                            );
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
      </div>

      <Dialog open={isPublishOpen} onOpenChange={setIsPublishOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Publish to Vibecode</DialogTitle>
            <DialogDescription>
              Share this generated component on the public Vibecode gallery.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Generate a clean title, description, category, and tags from the
              component.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGeneratePublishDetails}
              disabled={isGeneratingPublishDetails}
              className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider"
            >
              {isGeneratingPublishDetails
                ? "Generating..."
                : "Generate with AI"}
            </Button>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="publish-title">Title</Label>
              <Input
                id="publish-title"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                placeholder="Polished Hero Section"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="publish-description">Description</Label>
              <Textarea
                id="publish-description"
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                placeholder="High-impact hero with motion and layered gradients."
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="publish-category">Category</Label>
              <Input
                id="publish-category"
                value={publishCategory}
                onChange={(e) => setPublishCategory(e.target.value)}
                placeholder="Landing, Pricing, Hero, Footer"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="publish-tags">Tags (comma-separated)</Label>
              <Input
                id="publish-tags"
                value={publishTags}
                onChange={(e) => setPublishTags(e.target.value)}
                placeholder="glassmorphism, premium, shadcn"
              />
            </div>
            <div className="grid gap-2">
              <Label>Thumbnail image (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={publishThumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => publishThumbnailInputRef.current?.click()}
                  disabled={isUploadingThumbnail}
                  className="h-9 px-3 text-xs"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {isUploadingThumbnail
                    ? "Uploading..."
                    : publishThumbnailUrl
                      ? "Replace image"
                      : "Upload image"}
                </Button>
                {publishThumbnailUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPublishThumbnailUrl("")}
                    className="h-9 px-3 text-xs text-muted-foreground"
                  >
                    Remove
                  </Button>
                )}
              </div>
              {publishThumbnailUrl && (
                <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                  <Image
                    src={publishThumbnailUrl}
                    alt="Thumbnail preview"
                    width={960}
                    height={540}
                    className="h-auto w-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPublishOpen(false)}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isPublishing || isUploadingThumbnail}
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
