import OpenAI from "openai";

export const maxDuration = 60;

function getClient() {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
      "X-Title": "Shadway Chat",
    },
  });
}

type Message = {
  role: "user" | "assistant" | "system";
  content:
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  reasoning_details?: unknown;
};

/**
 * The wire format of a message, as OpenRouter takes it.
 *
 * `reasoning_details` is an OpenRouter extension, so it does not exist on the
 * SDK's own message type and has to travel alongside it.
 */
type ChatMessage = {
  role: Message["role"];
  content: Message["content"];
  reasoning_details?: unknown;
};

// Models that support reasoning
const REASONING_MODELS = [
  "deepseek/deepseek-r1:free",
  "xiaomi/mimo-v2-flash:free",
  "allenai/olmo-3.1-32b-think:free",
  "arcee-ai/trinity-mini:free",
];

export async function POST(req: Request) {
  const {
    messages,
    model = "google/gemini-2.0-flash-exp:free",
  }: { messages: Message[]; model?: string } = await req.json();

  const supportsReasoning = REASONING_MODELS.includes(model);

  const chatMessages: ChatMessage[] = messages.map((m) => {
    const msg: ChatMessage = {
      role: m.role,
      content: m.content,
    };
    if (m.reasoning_details) {
      msg.reasoning_details = m.reasoning_details;
    }
    return msg;
  });

  /**
   * The SDK's message type does not know about OpenRouter's `reasoning` flag,
   * and the content this route accepts is looser than the SDK's own, so the
   * request is asserted into the streaming parameter type.
   */
  const stream = await getClient().chat.completions.create({
    model,
    messages: chatMessages,
    stream: true,
    ...(supportsReasoning ? { reasoning: { enabled: true } } : {}),
  } as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming);

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
          throw new Error("Response is not a stream");
        }

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          const content = choice?.delta?.content;

          if (content) {
            const data = `0:${JSON.stringify(content)}\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Handle reasoning_details if present
          const delta = choice?.delta;
          if (delta && "reasoning_details" in delta && delta.reasoning_details) {
            const reasoningData = `r:${JSON.stringify(delta.reasoning_details)}\n`;
            controller.enqueue(encoder.encode(reasoningData));
          }
        }
        controller.close();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const errorData = `e:${JSON.stringify({ error: errorMessage })}\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
