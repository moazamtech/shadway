"use client";

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "@/components/chat-container";
import { DotsLoader } from "@/components/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/message";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  loadChatState,
  persistChatState,
  type PersistedChatState,
} from "@/lib/chat-persistence";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUp,
  Code2,
  Compass,
  Copy,
  GraduationCap,
  ImagePlus,
  MessageSquarePlus,
  Sparkles,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

const MODELS = [
  {
    name: "Mimo V2 Flash",
    value: "xiaomi/mimo-v2-flash:free",
    supportsImages: false,
  },
  {
    name: "Olmo 3.1 Think",
    value: "allenai/olmo-3.1-32b-think:free",
    supportsImages: false,
  },
  {
    name: "Devstral",
    value: "mistralai/devstral-2512:free",
    supportsImages: false,
  },
  {
    name: "DeepSeek V3.1 Nex",
    value: "nex-agi/deepseek-v3.1-nex-n1:free",
    supportsImages: false,
  },
  {
    name: "Trinity Mini",
    value: "arcee-ai/trinity-mini:free",
    supportsImages: false,
  },
  {
    name: "TNG R1T Chimera",
    value: "tngtech/tng-r1t-chimera:free",
    supportsImages: false,
  },
];

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string | ContentPart[];
  reasoning_details?: unknown;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  model: string;
  messages: ChatMessage[];
};

type MessageComponentProps = {
  message: ChatMessage;
  isLastMessage: boolean;
};

function getMessageText(content: string | ContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function getMessageImages(content: string | ContentPart[]): string[] {
  if (typeof content === "string") return [];
  return content
    .filter(
      (p): p is { type: "image_url"; image_url: { url: string } } =>
        p.type === "image_url",
    )
    .map((p) => p.image_url.url);
}

export const MessageComponent = memo(
  ({ message, isLastMessage }: MessageComponentProps) => {
    const isAssistant = message.role === "assistant";
    const text = getMessageText(message.content);
    const images = getMessageImages(message.content);

    const copyText = async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    };

    return (
      <Message
        className={cn(
          "mx-auto flex w-full max-w-3xl flex-col gap-2",
          isAssistant ? "items-start" : "items-end",
        )}
      >
        {isAssistant ? (
          <div className="group flex w-full flex-col gap-2">
            {/* Assistant Avatar & Label */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-foreground/10">
                <Sparkles className="h-3.5 w-3.5 text-foreground/70" />
              </div>
              <span className="text-sm font-semibold text-foreground/80">
                Shadway
              </span>
            </div>

            {/* Message Content */}
            <div className="pl-9">
              <MessageContent
                className="text-foreground prose prose-neutral dark:prose-invert w-full min-w-0 flex-1 max-w-none text-[15px] leading-[1.75] [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-4 [&_ol]:my-4 [&_li]:my-1.5 [&_pre]:my-4 [&_blockquote]:my-4 [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:mt-5 [&_h3]:mb-2 [&_code]:text-[13px]"
                markdown
              >
                {text}
              </MessageContent>

              {/* Actions */}
              <MessageActions
                className={cn(
                  "mt-4 flex gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100",
                  isLastMessage && "opacity-100",
                )}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  onClick={copyText}
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </MessageActions>
            </div>
          </div>
        ) : (
          <div className="group flex w-full flex-col items-end gap-2">
            {/* User Images */}
            {images.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2 max-w-[80%]">
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="Uploaded"
                    className="max-h-52 rounded-2xl border border-border/20 object-cover shadow-sm"
                  />
                ))}
              </div>
            )}

            {/* User Message */}
            {text && (
              <MessageContent className="bg-foreground text-background max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {text}
              </MessageContent>
            )}

            {/* User Actions */}
            <MessageActions
              className={cn(
                "mr-1 flex gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100",
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                onClick={copyText}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </MessageActions>
          </div>
        )}
      </Message>
    );
  },
);

MessageComponent.displayName = "MessageComponent";

const LoadingMessage = memo(() => (
  <Message className="mx-auto flex w-full max-w-3xl flex-col items-start gap-2">
    <div className="flex w-full flex-col gap-2">
      {/* Assistant Avatar & Label */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/5 ring-1 ring-foreground/10">
          <Sparkles className="h-3.5 w-3.5 text-foreground/70 animate-pulse" />
        </div>
        <span className="text-sm font-semibold text-foreground/80">
          Shadway
        </span>
      </div>

      {/* Loading Indicator */}
      <div className="pl-9 flex items-center gap-3 py-1">
        <DotsLoader />
        <span className="text-sm text-muted-foreground/60">Thinking...</span>
      </div>
    </div>
  </Message>
));

LoadingMessage.displayName = "LoadingMessage";

const ErrorMessage = memo(({ error }: { error: string }) => (
  <Message className="not-prose mx-auto flex w-full max-w-3xl flex-col items-start gap-2 px-2 md:px-6">
    <div className="flex w-full flex-col gap-1">
      {/* Error Indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-red-500">
            Error occurred
          </span>
          <p className="text-sm text-red-400/80 break-words">{error}</p>
        </div>
      </div>
    </div>
  </Message>
));

ErrorMessage.displayName = "ErrorMessage";

const MAX_SESSIONS = 8;
const MAX_MESSAGES_PER_SESSION = 40;
const MAX_TEXT_CHARS_PER_MESSAGE = 1200;

function safeSessionTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = getMessageText(firstUser.content).trim();
  return text ? text.slice(0, 42) : "New chat";
}

function normalizeSessions(sessions: ChatSession[]): ChatSession[] {
  const sanitized = sessions
    .filter((s) => s && typeof s.id === "string")
    .map((s) => ({
      ...s,
      title:
        typeof s.title === "string" && s.title.trim() ? s.title : "New chat",
      createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now(),
      model: typeof s.model === "string" ? s.model : MODELS[0].value,
      messages: Array.isArray(s.messages) ? s.messages : [],
    }));

  return sanitized
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_SESSIONS);
}

function ConversationPromptInput() {
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );
  const messages = activeSession?.messages ?? [];
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].value);
  const [images, setImages] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = MODELS.find((m) => m.value === selectedModel);
  const supportsImages = currentModel?.supportsImages ?? false;

  const upsertActiveSession = (patch: Partial<ChatSession>) => {
    setSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === activeSessionId);
      if (existingIndex === -1) return prev;
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...patch };
      return next;
    });
  };

  const updateActiveSessionMessages = (
    update: (messages: ChatMessage[]) => ChatMessage[],
  ) => {
    setSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === activeSessionId);
      if (existingIndex === -1) return prev;
      const next = [...prev];
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        messages: update(existing.messages),
        createdAt: Date.now(),
      };
      return next;
    });
  };

  const createNewSession = (model = selectedModel) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const session: ChatSession = {
      id,
      title: "New chat",
      createdAt: Date.now(),
      model,
      messages: [],
    };

    setSessions((prev) => normalizeSessions([session, ...prev]));
    setActiveSessionId(id);
    setSelectedModel(model);
    setInput("");
    setImages([]);
    setError(null);
    setIsLoading(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  const deleteSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return next;
    });
    if (id === activeSessionId) setActiveSessionId("");
  };

  useEffect(() => {
    const loaded = loadChatState();
    if (!loaded || loaded.sessions.length === 0) {
      createNewSession(MODELS[0].value);
      return;
    }

    const normalized = normalizeSessions(loaded.sessions);
    setSessions(normalized);
    const active =
      normalized.find((s) => s.id === loaded.activeSessionId) ?? normalized[0];
    setActiveSessionId(active?.id ?? "");
    setSelectedModel(active?.model ?? MODELS[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessions.length) return;
    const toPersist: PersistedChatState = {
      activeSessionId,
      sessions: sessions.map((s) => {
        const trimmedMessages = s.messages
          .slice(-MAX_MESSAGES_PER_SESSION)
          .map((m) => {
            const text = getMessageText(m.content);
            const images = getMessageImages(m.content);
            const content: string | ContentPart[] =
              images.length > 0
                ? [
                    ...images.map((url) => ({
                      type: "image_url" as const,
                      image_url: { url },
                    })),
                    ...(text.trim()
                      ? [
                          {
                            type: "text" as const,
                            text: text.slice(0, MAX_TEXT_CHARS_PER_MESSAGE),
                          },
                        ]
                      : []),
                  ]
                : text.slice(0, MAX_TEXT_CHARS_PER_MESSAGE);

            return {
              id: m.id,
              role: m.role,
              content,
            } satisfies ChatMessage;
          });

        return {
          id: s.id,
          title: (s.title || safeSessionTitleFromMessages(s.messages)).slice(
            0,
            64,
          ),
          createdAt: s.createdAt,
          model: s.model,
          messages: trimmedMessages,
        } satisfies ChatSession;
      }),
    };

    const handle = window.setTimeout(() => {
      persistChatState(toPersist);
    }, 200);

    return () => window.clearTimeout(handle);
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;
    upsertActiveSession({
      model: selectedModel,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, activeSessionId]);

  useEffect(() => {
    if (activeSessionId) return;
    if (sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
      setSelectedModel(sessions[0].model);
      return;
    }
    createNewSession(MODELS[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, sessions.length]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async () => {
    if ((!input.trim() && images.length === 0) || isLoading) return;
    if (!activeSessionId) createNewSession(selectedModel);

    let userContent: string | ContentPart[];
    if (images.length > 0) {
      userContent = [
        ...images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img },
        })),
        ...(input.trim()
          ? [{ type: "text" as const, text: input.trim() }]
          : []),
      ];
    } else {
      userContent = input.trim();
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userContent,
    };

    updateActiveSessionMessages((prev) => [...prev, userMessage]);
    upsertActiveSession({
      title: safeSessionTitleFromMessages([...messages, userMessage]),
    });
    setInput("");
    setImages([]);
    setIsLoading(true);
    setError(null);

    const assistantId = (Date.now() + 1).toString();
    updateActiveSessionMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.reasoning_details ? { reasoning_details: m.reasoning_details } : {}),
          })),
          model: selectedModel,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const content = JSON.parse(line.slice(2));
              updateActiveSessionMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          (typeof m.content === "string" ? m.content : "") +
                          content,
                      }
                    : m,
                ),
              );
            } catch {
              // Skip malformed lines
            }
          } else if (line.startsWith("r:")) {
            try {
              const reasoning = JSON.parse(line.slice(2));
              updateActiveSessionMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, reasoning_details: reasoning }
                    : m,
                ),
              );
            } catch {
              // Skip malformed lines
            }
          } else if (line.startsWith("e:")) {
            try {
              const errorData = JSON.parse(line.slice(2));
              throw new Error(errorData.error);
            } catch (e) {
              if (
                e instanceof Error &&
                e.message !== "Unexpected end of JSON input"
              ) {
                throw e;
              }
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
        updateActiveSessionMessages((prev) =>
          prev.filter((m) => m.id !== assistantId),
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SidebarProvider
      defaultOpen={true}
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className={`relative h-dvh overflow-hidden bg-sidebar transition-[padding-top] duration-200 ${sidebarOpen ? "md:pt-3" : ""}`}
    >
      <Sidebar
        variant="sidebar"
        className={`!border-r-0 bg-sidebar [&>div]:!border-r-0 [&_[data-sidebar]]:!border-r-0 transition-all duration-200 ease-in-out ${sidebarOpen ? "md:rounded-tr-3xl md:pt-3" : ""}`}
      >
        <SidebarHeader className="gap-3 p-4">
          {/* Logo and branding */}
          <div className="flex items-center gap-3">
            <div className="relative grid size-9 place-items-center overflow-hidden rounded-lg bg-sidebar-accent">
              <Image
                src="/logo.png"
                alt="Shadway"
                width={28}
                height={28}
                className="size-6 object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                Shadway Chat
              </span>
              <span className="text-xs text-sidebar-foreground/50">
                AI Assistant
              </span>
            </div>
          </div>

          {/* New chat button */}
          <Button
            type="button"
            onClick={() => createNewSession(selectedModel)}
            className="h-10 w-full rounded-lg bg-sidebar-primary text-sidebar-primary-foreground transition-colors hover:bg-sidebar-primary/90"
          >
            New Chat
          </Button>
        </SidebarHeader>

        <SidebarContent className="px-3 pb-4">
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-2 py-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
              Recent Chats
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.map((s) => (
                  <SidebarMenuItem key={s.id}>
                    <SidebarMenuButton
                      isActive={s.id === activeSessionId}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        setSelectedModel(s.model);
                        setError(null);
                        setIsLoading(false);
                        abortControllerRef.current?.abort();
                        abortControllerRef.current = null;
                      }}
                      className="rounded-lg"
                    >
                      <span className="truncate">{s.title}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={() => deleteSession(s.id)}
                      aria-label="Delete chat"
                      title="Delete chat"
                      showOnHover
                    >
                      <Trash2 className="size-3.5" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset
        className={`relative overflow-hidden bg-background transition-all duration-200 ease-in-out ${sidebarOpen ? "md:mt-3 md:h-[calc(100dvh-0.75rem)] md:rounded-tl-3xl" : "h-dvh"}`}
      >
        <div className="relative flex h-full flex-col">
          {/* Header controls */}
          <div className="absolute left-4 top-4 z-30 flex items-center gap-3">
            <SidebarTrigger className="pointer-events-auto size-9 rounded-lg hover:bg-muted transition-colors" />
            <div className="pointer-events-none hidden select-none sm:block">
              <div className="max-w-[30ch] truncate text-sm font-medium text-foreground/70">
                {activeSession?.title ?? "Chat"}
              </div>
            </div>
          </div>

          {/* Theme toggle */}
          <div className="absolute right-4 top-4 z-30">
            <ThemeToggle />
          </div>

          {/* Main chat area */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-background to-transparent" />

            <ChatContainerRoot className="relative h-full space-y-0 overflow-y-auto scroll-smooth">
              <ChatContainerContent className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-32 pt-20 md:px-6">
                {messages.length === 0 && (
                  <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-16 text-center">
                    <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
                      <Sparkles className="size-8 text-primary" />
                    </div>
                    <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                      What can I help you with?
                    </h1>
                    <p className="mt-3 text-base text-muted-foreground">
                      Start a conversation or pick a suggestion below
                    </p>

                    {/* Quick action buttons */}
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                      {[
                        {
                          label: "Math",
                          icon: Sparkles,
                          prompt: "What is 9 + 10?",
                        },
                        {
                          label: "Space",
                          icon: Compass,
                          prompt:
                            "What is a black hole and why is it so scary?",
                        },
                        {
                          label: "Music",
                          icon: Code2,
                          prompt:
                            "Who is Machel Fackson and why do people love him?",
                        },
                        {
                          label: "Random",
                          icon: GraduationCap,
                          prompt:
                            "If a tomato is a fruit, is ketchup a smoothie?",
                        },
                      ].map(({ label, icon: Icon, prompt }) => (
                        <Button
                          key={label}
                          type="button"
                          variant="outline"
                          onClick={() => setInput(prompt)}
                          className="h-11 rounded-xl border-border/50 bg-background/50 px-5 shadow-sm backdrop-blur-sm transition-all hover:bg-background hover:shadow-md"
                        >
                          <Icon className="mr-2 size-4 text-muted-foreground" />
                          {label}
                        </Button>
                      ))}
                    </div>

                    {/* Suggestion cards */}
                    <div className="mt-10 w-full overflow-hidden rounded-2xl border border-border/40 bg-card/50 shadow-lg backdrop-blur-sm">
                      {[
                        "Why do we park in driveways but drive on parkways?",
                        "Can you explain quantum physics like I'm 5?",
                        "What came first, the chicken or the egg?",
                        "Is water wet or does it make things wet?",
                      ].map((t, i) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setInput(t)}
                          className={cn(
                            "w-full px-5 py-4 text-left text-sm text-foreground/80 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                            i !== 0 && "border-t border-border/30",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((message, index) => {
                  const isLastMessage = index === messages.length - 1;

                  if (
                    message.role === "assistant" &&
                    !message.content &&
                    isLoading
                  ) {
                    return null;
                  }

                  return (
                    <MessageComponent
                      key={message.id}
                      message={message}
                      isLastMessage={isLastMessage}
                    />
                  );
                })}

                {isLoading && <LoadingMessage />}
                {error && <ErrorMessage error={error} />}
              </ChatContainerContent>
            </ChatContainerRoot>
          </div>

          {/* Input area */}
          <div className="shrink-0 z-20 py-4">
            <div className="mx-auto w-full max-w-3xl px-4">
              <div className="rounded-3xl border border-border/40 shadow-sm">
                {/* Image previews */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pt-4">
                    {images.map((img, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={img}
                          alt="Preview"
                          className="size-16 rounded-xl border border-border/30 object-cover"
                        />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Textarea */}
                <div className="px-4 pt-4 pb-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSubmit();
                      }
                    }}
                    placeholder="Ask me anything..."
                    rows={1}
                    className="w-full min-h-[44px] max-h-[200px] resize-none bg-transparent text-[15px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none"
                    style={{
                      height: "auto",
                      overflow: "hidden",
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height =
                        Math.min(target.scrollHeight, 200) + "px";
                      target.style.overflow =
                        target.scrollHeight > 200 ? "auto" : "hidden";
                    }}
                  />
                </div>

                {/* Bottom toolbar */}
                <div className="flex items-center justify-between gap-3 px-3 pb-3">
                  <div className="flex items-center gap-1">
                    {/* Model selector */}
                    <Select
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                    >
                      <SelectTrigger className="h-8 w-auto gap-1.5 rounded-lg border-0 bg-muted/50 px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <SelectValue placeholder="Model" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40">
                        {MODELS.map((model) => (
                          <SelectItem
                            key={model.value}
                            value={model.value}
                            className="text-xs"
                          >
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Image upload */}
                    {supportsImages && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <ImagePlus size={16} />
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Stop button when loading */}
                    {isLoading && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => abortControllerRef.current?.abort()}
                        className="h-8 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        Stop
                      </Button>
                    )}

                    {/* Send button */}
                    <Button
                      size="icon"
                      disabled={
                        (!input.trim() && images.length === 0) || isLoading
                      }
                      onClick={onSubmit}
                      className="size-8 rounded-lg bg-foreground text-background shadow-sm transition-all hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {!isLoading ? (
                        <ArrowUp size={16} strokeWidth={2.5} />
                      ) : (
                        <span className="size-2.5 rounded-sm bg-background animate-pulse" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
                Shadway can make mistakes. Consider checking important
                information.
              </p>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default ConversationPromptInput;
