"use client";

// Custom CSS for preview panel sizing and hidden scrollbars
const previewPanelStyles = `
  .preview-panel-container {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .preview-panel-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .preview-panel-content > * {
    flex: 1;
    min-height: 0;
  }

  /* Hide scrollbars while keeping scroll functionality */
  .hide-scrollbar {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }

  .hide-scrollbar::-webkit-scrollbar {
    display: none !important;
  }

  /* Global scrollbar hiding */
  ::-webkit-scrollbar {
    width: 0px !important;
    height: 0px !important;
  }

  ::-webkit-scrollbar-track {
    background: transparent !important;
  }

  ::-webkit-scrollbar-thumb {
    background: transparent !important;
  }

  /* Firefox scrollbar hiding */
  * {
    scrollbar-width: none !important;
  }
`;

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
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
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
}: {
  code: string;
  language?: string;
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
    <div className="relative group my-4 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Code2Icon className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            {language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-all duration-200 hover:scale-105"
        >
          {copied ? (
            <>
              <CheckIcon className="h-3.5 w-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon className="h-3.5 w-3.5" />
              Copy Code
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code className="text-zinc-100 font-mono text-xs sm:text-sm">
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

export default function ComponentGeneratorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComponent, setGeneratedComponent] =
    useState<GeneratedComponent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [savedComponentName, setSavedComponentName] = useState<string | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // Inject preview panel styles
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = previewPanelStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
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
        content: "⏳ Generating component...",
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
            setSavedComponentName(null); // Reset saved state for new component
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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header - Enhanced */}
      <header className="border-b bg-gradient-to-r from-background via-background to-muted/10 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-14 items-center gap-2 px-3 md:h-16 md:gap-4 md:px-6">
          {/* Left Side - Logo and Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <Image
              src="/logos/66b3e5b47785ef9d9fc8040b_89.png"
              alt="Shadcn Logo"
              width={40}
              height={40}
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold md:text-base lg:text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Shadway AI Component Generator
              </h1>
              <p className="hidden text-xs text-muted-foreground lg:block">
                Build beautiful components with AI
              </p>
            </div>
            <h1 className="text-sm font-bold sm:hidden">Shadway AI</h1>
          </div>

          {/* Right Side - Actions */}
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <p className="hidden text-xs text-muted-foreground xl:block max-w-[200px] truncate">
              Generate production-ready components
            </p>
            {generatedComponent && (
              <>
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
                      <span className="hidden md:inline">Hide</span>
                    </>
                  ) : (
                    <>
                      <Code2Icon className="mr-0 h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Show Code</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Improved Layout */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Chat Section - Responsive */}
        <div
          className={cn(
            "min-h-0 flex flex-col transition-all duration-300 ease-in-out",
            generatedComponent && isPanelOpen && !isFullscreen
              ? "w-full lg:w-1/2"
              : "w-full",
            isFullscreen && "hidden lg:flex lg:w-0",
          )}
        >
          <Conversation className="flex-1 overflow-y-auto hide-scrollbar">
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
                    title="Welcome to Shadway AI Component Generator"
                    description="Describe any React component you need, and I'll generate production-ready, fully functional code that runs perfectly in preview"
                    icon={
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 md:h-20 md:w-20 ring-1 ring-primary/10">
                        <SparklesIcon className="h-8 w-8 text-primary md:h-10 md:w-10" />
                      </div>
                    }
                  >
                    <div className="mt-8 grid gap-3 text-left grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                      <button
                        onClick={() =>
                          handleSubmit({
                            text: "Create a modern pricing card component with three tiers, including a popular badge",
                          })
                        }
                        className="group rounded-xl border bg-card p-4 text-left text-sm transition-all hover:bg-accent hover:shadow-md hover:border-primary/20"
                      >
                        <div className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Pricing Card
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Three-tier pricing with badges
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          handleSubmit({
                            text: "Create a testimonial carousel component with avatar, name, and rating",
                          })
                        }
                        className="group rounded-xl border bg-card p-4 text-left text-sm transition-all hover:bg-accent hover:shadow-md hover:border-primary/20"
                      >
                        <div className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Testimonial Carousel
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Customer reviews slider
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          handleSubmit({
                            text: "Create a feature grid component with icons, titles, and descriptions",
                          })
                        }
                        className="group rounded-xl border bg-card p-4 text-left text-sm transition-all hover:bg-accent hover:shadow-md hover:border-primary/20"
                      >
                        <div className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Feature Grid
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Product features showcase
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          handleSubmit({
                            text: "Create a stats dashboard card component with animated numbers",
                          })
                        }
                        className="group rounded-xl border bg-card p-4 text-left text-sm transition-all hover:bg-accent hover:shadow-md hover:border-primary/20"
                      >
                        <div className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          Stats Dashboard
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Animated key metrics
                        </div>
                      </button>
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
                          name={message.role === "user" ? "You" : "Shadway AI"}
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
                                <CodeBlock code={message.code} language="tsx" />
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

          {/* Input - Enhanced Responsive */}
          <div className="border-t p-2 sm:p-3 md:p-4 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto w-full max-w-4xl">
              <PromptInput onSubmit={handleSubmit} className="w-full">
                <PromptInputBody>
                  <PromptInputTextarea
                    placeholder="Describe the component you want to generate... (e.g., 'Create a contact form with validation')"
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

        {/* Preview Panel - Enhanced Responsive */}
        {generatedComponent && isPanelOpen && (
          <div
            className={cn(
              "preview-panel-container border-t lg:border-t-0 lg:border-l transition-all duration-300 bg-muted/30 overflow-hidden",
              isFullscreen ? "w-full" : "w-full lg:w-1/2",
            )}
          >
            <div className="preview-panel-content h-full hide-scrollbar">
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
