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
import { SparklesIcon, XIcon, Code2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  timestamp: Date;
};

type GeneratedComponent = {
  code: string;
  language: string;
  title: string;
};

export default function ComponentGeneratorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComponent, setGeneratedComponent] = useState<GeneratedComponent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [savedComponentName, setSavedComponentName] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Inject preview panel styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = previewPanelStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const parseThinkingAndContent = (text: string): { reasoning: string; content: string } => {
    // Extract reasoning from <think> tags
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const thinkMatches = [...text.matchAll(thinkRegex)];
    const reasoning = thinkMatches.map(match => match[1].trim()).join('\n\n');

    // Remove <think> and <component> tags from displayed content
    let content = text.replace(thinkRegex, '');
    content = content.replace(/<component>[\s\S]*?<\/component>/g, '');
    content = content.trim();

    return { reasoning, content };
  };

  const extractCodeFromMarkdown = (text: string): { code: string; language: string } => {
    // Extract from <component> tags only
    const componentRegex = /<component>([\s\S]*?)<\/component>/;
    const componentMatch = text.match(componentRegex);

    if (componentMatch) {
      let code = componentMatch[1].trim();

      // Remove any duplicate code (if the code appears twice in exact halves)
      const lines = code.split('\n');
      const halfLength = Math.floor(lines.length / 2);

      if (halfLength > 10) {
        const firstHalf = lines.slice(0, halfLength).join('\n');
        const secondHalf = lines.slice(halfLength).join('\n');

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
          const { reasoning, content: displayContent } = parseThinkingAndContent(accumulatedContent);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: displayContent, reasoning }
                : msg
            )
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
                        accumulatedContent += parsed.choices?.[0]?.delta?.content || "";
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
                    accumulatedContent += parsed.choices?.[0]?.delta?.content || "";
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
          const { code, language } = extractCodeFromMarkdown(accumulatedContent);
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
                ? { ...msg, content: "Sorry, I encountered an error. Please try again." }
                : msg
            )
          );
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isGenerating]
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-background to-muted/20">
        <div className="container flex h-14 items-center gap-4 px-4 md:h-16">
          {/* Left Side - Logo and Title */}
          <div className="flex items-center gap-2 md:gap-3">
            <Image src="/logos/66b3e5b47785ef9d9fc8040b_89.png" alt="Shadcn Logo" width={74} height={74} className="text-primary md:w-12 md:h-12" />
            <div>
              <h1 className="text-base font-semibold md:text-lg">Shadway Component Generator</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Powered by AI</p>
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="ml-auto flex items-center gap-2">
            <p className="hidden text-sm text-muted-foreground lg:block">
              Generate production-ready Shadcn UI components
            </p>
            {generatedComponent && (
              <Button
                variant={isPanelOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="ml-2"
              >
                {isPanelOpen ? (
                  <>
                    <XIcon className="mr-2 h-4 w-4" />
                    Hide Code
                  </>
                ) : (
                  <>
                    <Code2Icon className="mr-2 h-4 w-4" />
                    Show Code
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Chat Section - Centered */}
        <div className={cn(
          "min-h-0 flex flex-col transition-all duration-300",
          generatedComponent && isPanelOpen ? 'w-full lg:w-1/2' : 'w-full'
        )}>
          <Conversation className="flex-1 overflow-y-auto hide-scrollbar">
            <ConversationContent className={messages.length === 0 ? "flex items-center justify-center min-h-full" : ""}>
              <div className={cn(
                "w-full px-4",
                messages.length === 0 ? 'max-w-4xl mx-auto' : 'max-w-3xl mx-auto'
              )}>
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    title="Welcome to Shadway Component Generator"
                    description="Describe any Shadcn UI component you need, and I'll generate production-ready React code for you"
                    icon={
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 md:h-20 md:w-20">
                        <SparklesIcon className="h-8 w-8 text-primary md:h-10 md:w-10" />
                      </div>
                    }
                  >
                    <div className="mt-6 grid gap-2 text-left sm:grid-cols-2 lg:grid-cols-4">
                      <button
                        onClick={() => handleSubmit({ text: "Create a pricing card component with three tiers" })}
                        className="rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <div className="font-medium">Pricing Card</div>
                        <div className="text-xs text-muted-foreground">Three-tier pricing</div>
                      </button>
                      <button
                        onClick={() => handleSubmit({ text: "Create a testimonial carousel component" })}
                        className="rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <div className="font-medium">Testimonial</div>
                        <div className="text-xs text-muted-foreground">Customer reviews</div>
                      </button>
                      <button
                        onClick={() => handleSubmit({ text: "Create a feature grid component with icons" })}
                        className="rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <div className="font-medium">Feature Grid</div>
                        <div className="text-xs text-muted-foreground">Product features</div>
                      </button>
                      <button
                        onClick={() => handleSubmit({ text: "Create a stats dashboard card component" })}
                        className="rounded-lg border bg-card p-3 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <div className="font-medium">Stats Card</div>
                        <div className="text-xs text-muted-foreground">Key metrics</div>
                      </button>
                    </div>
                  </ConversationEmptyState>
                ) : (
                  <div className="space-y-4 py-4">
                    {messages.map((message) => (
                      <Message key={message.id} from={message.role}>
                        <MessageAvatar
                          src={message.role === "user" ? "/logos/671ff00d29c65f1f25fb28c0_95.png" : "/logos/66e99db1f5c63f46f7415051_020.png"}
                          name={message.role === "user" ? "You" : "Shadway AI"}
                          className="h-8 w-8"
                        />
                        <MessageContent variant="flat">
                          {message.role === "user" ? (
                            <p className="m-0">{message.content}</p>
                          ) : (
                            <div className="space-y-3">
                              {message.reasoning && (
                                <ChainOfThought defaultOpen={true}>
                                  <ChainOfThoughtHeader>
                                    AI Thinking Process
                                  </ChainOfThoughtHeader>
                                  <ChainOfThoughtContent>
                                    <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                                      {message.reasoning}
                                    </div>
                                  </ChainOfThoughtContent>
                                </ChainOfThought>
                              )}
                              {message.content && (
                                <AIResponse>
                                  {message.content}
                                </AIResponse>
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

          {/* Input - Centered with max width */}
          <div className="border-t p-3 md:p-4 shrink-0">
            <div className="mx-auto w-full max-w-4xl">
              <PromptInput onSubmit={handleSubmit} className="w-full">
                <PromptInputBody>
                  <PromptInputTextarea
                    placeholder="Describe the component you want to generate..."
                    disabled={isGenerating}
                    className="min-h-12 md:min-h-16"
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    {isGenerating && (
                      <Button size="sm" variant="ghost" onClick={handleStop}>
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

        {/* Preview Panel - Only Sandpack */}
        {generatedComponent && isPanelOpen && (
          <div className={cn(
            "preview-panel-container border-t lg:border-t-0 lg:border-l w-full lg:w-1/2",
            "transition-all duration-300 bg-muted/30 overflow-hidden"
          )}>
            <div className="preview-panel-content h-full hide-scrollbar">
              <SandpackRuntimePreview showConsole={false} code={generatedComponent.code} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
