"use client";

import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
} from "@/components/ai-elements/chain-of-thought";
import { SandpackRuntimePreview } from "@/components/sandpack-preview";
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
  Maximize2Icon,
  Minimize2Icon,
  CodeIcon,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  code?: string;
  timestamp: Date;
};

type GeneratedComponent = {
  code: string;
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
const SMART_SUGGESTIONS = [
  {
    emoji: "💳",
    title: "Pricing Section",
    prompt:
      "Create a modern pricing section with 3 tiers (Basic, Pro, Enterprise), toggle for monthly/yearly pricing, feature lists with checkmarks, and a 'Most Popular' badge on the middle tier",
  },
  {
    emoji: "📊",
    title: "Analytics Dashboard",
    prompt:
      "Create an analytics dashboard card showing key metrics with animated counters, trend indicators (up/down arrows), percentage changes, and a mini chart visualization",
  },
  {
    emoji: "💬",
    title: "Testimonial Slider",
    prompt:
      "Create a testimonial carousel with customer photos, 5-star ratings, review text, company logos, automatic rotation, and navigation dots",
  },
  {
    emoji: "📝",
    title: "Contact Form",
    prompt:
      "Create a professional contact form with name, email, subject, message fields, form validation, error states, success message, and a submit button with loading state",
  },
  {
    emoji: "🎯",
    title: "Feature Grid",
    prompt:
      "Create a responsive feature grid (3 columns on desktop, 1 on mobile) with icons, titles, descriptions, and subtle hover effects for each feature card",
  },
  {
    emoji: "🎨",
    title: "Product Card",
    prompt:
      "Create a product card with image, title, price, rating stars, 'Add to Cart' button, favorite icon, and a sale badge if discounted",
  },
  {
    emoji: "📅",
    title: "Event Calendar",
    prompt:
      "Create a mini event calendar showing the current month, clickable dates, event indicators (dots), and a list of upcoming events for the selected date",
  },
  {
    emoji: "🔔",
    title: "Notification Panel",
    prompt:
      "Create a notification panel with different notification types (success, warning, error, info), timestamps, mark as read functionality, and clear all button",
  },
];

export default function ComponentGeneratorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComponent, setGeneratedComponent] =
    useState<GeneratedComponent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  ): { reasoning: string; content: string; code: string } => {
    // Extract reasoning from <think> tags
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const thinkMatches = [...text.matchAll(thinkRegex)];
    const reasoning = thinkMatches.map((match) => match[1].trim()).join("\n\n");

    // Extract code from <component> tags
    const componentRegex = /<component>([\s\S]*?)<\/component>/;
    const componentMatch = text.match(componentRegex);
    const code = componentMatch ? componentMatch[1].trim() : "";

    // Remove <think> and <component> tags from displayed content
    let content = text.replace(thinkRegex, "");
    content = content.replace(/<component>[\s\S]*?<\/component>/g, "");
    content = content.trim();

    return { reasoning, content, code };
  };

  const extractCodeFromMarkdown = (
    text: string,
  ): { code: string; language: string } => {
    // Extract from <component> tags only
    const componentRegex = /<component>([\s\S]*?)<\/component>/;
    const componentMatch = text.match(componentRegex);

    if (componentMatch) {
      let code = componentMatch[1].trim();

      // Remove any duplicate code (if the code appears twice in exact halves)
      const lines = code.split("\n");
      const halfLength = Math.floor(lines.length / 2);

      if (halfLength > 10) {
        const firstHalf = lines.slice(0, halfLength).join("\n");
        const secondHalf = lines.slice(halfLength).join("\n");

        if (firstHalf.trim() === secondHalf.trim()) {
          code = firstHalf.trim();
        }
      }

      return {
        language: "tsx",
        code: code,
      };
    }

    return {
      language: "tsx",
      code: "",
    };
  };

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
        abortControllerRef.current = new AbortController();

        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await fetch("/api/generate-component", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: text,
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
          } = parseThinkingAndContent(accumulatedContent);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: displayContent, reasoning, code }
                : msg,
            ),
          );
        };

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Process any remaining buffered data
              if (buffer.trim()) {
                const lines = buffer.split("\n");
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data && data !== "[DONE]") {
                      try {
                        const parsed = JSON.parse(data);
                        accumulatedContent +=
                          parsed.choices?.[0]?.delta?.content || "";
                      } catch (e) {
                        // Skip invalid JSON
                      }
                    }
                  }
                }
              }
              updateMessages();
              if (updateTimer) clearTimeout(updateTimer);
              break;
            }

            // Add to buffer and process complete lines
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            // Keep the last incomplete line in the buffer
            buffer = lines[lines.length - 1];

            // Process complete lines
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data && data !== "[DONE]") {
                  try {
                    const parsed = JSON.parse(data);
                    accumulatedContent +=
                      parsed.choices?.[0]?.delta?.content || "";
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }

            // Debounce UI updates for better performance
            if (updateTimer) clearTimeout(updateTimer);
            updateTimer = setTimeout(updateMessages, 50);
          }
        }

        // Extract and set the generated component
        if (accumulatedContent) {
          const { code, language } =
            extractCodeFromMarkdown(accumulatedContent);
          if (code) {
            setGeneratedComponent({
              code,
              language,
              title: "Generated Component",
            });
            setIsPanelOpen(true);
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
      {/* Header - Modern VibeCode Branding */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-2 px-3 md:h-16 md:gap-4 md:px-6 lg:px-8">
          {/* Left Side - VibeCode Logo and Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <Zap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold md:text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                VibeCode
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                AI Component Generator
              </p>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">AI Ready</span>
            </div>
            {generatedComponent && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewWidthPct(50)}
                  className="hidden lg:flex"
                  title="Reset split"
                >
                  Reset Split
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden md:flex"
                  title={
                    isFullscreen ? "Exit fullscreen" : "Fullscreen preview"
                  }
                >
                  {isFullscreen ? (
                    <Minimize2Icon className="h-4 w-4" />
                  ) : (
                    <Maximize2Icon className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant={isPanelOpen ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className="text-xs md:text-sm"
                >
                  {isPanelOpen ? (
                    <>
                      <XIcon className="mr-0 h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Hide Preview</span>
                    </>
                  ) : (
                    <>
                      <Code2Icon className="mr-0 h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Show Preview</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

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
                    title="Welcome to VibeCode"
                    description="Generate beautiful, production-ready React components with AI. Just describe what you need, and watch the magic happen."
                    icon={
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 shadow-lg">
                        <SparklesIcon className="h-10 w-10 text-primary" />
                      </div>
                    }
                  >
                    <div className="mt-8 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                          Try these examples
                        </h3>
                        <button
                          onClick={refreshSuggestions}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <SparklesIcon className="h-3 w-3" />
                          Refresh
                        </button>
                      </div>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {activeSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              handleSubmit({
                                text: suggestion.prompt,
                              })
                            }
                            className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative">
                              <div className="font-semibold mb-1.5 group-hover:text-primary transition-colors flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <span className="text-lg">
                                    {suggestion.emoji}
                                  </span>
                                </div>
                                {suggestion.title}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {suggestion.prompt.split(",")[0]}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Or describe your own component below
                      </p>
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
                              {message.code && (
                                <CodeBlock
                                  code={message.code}
                                  language="tsx"
                                  isActive={
                                    generatedComponent?.code === message.code
                                  }
                                  onRun={() => {
                                    setGeneratedComponent({
                                      code: message.code || "",
                                      language: "tsx",
                                      title: "Generated Component",
                                    });
                                    setIsPanelOpen(true);
                                    setIsFullscreen(false);
                                  }}
                                />
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
                    placeholder="Describe your component... (e.g., 'Create a responsive contact form with validation')"
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

        {/* Preview Panel */}
        {generatedComponent && isPanelOpen && (
          <div
            className={cn(
              "border-t lg:border-t-0 transition-all duration-300 bg-muted/30 overflow-hidden flex flex-col",
              isFullscreen ? "w-full" : "w-full lg:flex-none",
            )}
            style={
              isDesktop && !isFullscreen
                ? { width: `${previewWidthPct}%` }
                : undefined
            }
          >
            <div className="flex-1 min-h-0">
              <SandpackRuntimePreview
                showConsole={false}
                code={generatedComponent.code}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
