import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { prompt, conversationHistory, projectContext, reasoningEnabled } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
        "X-Title": "Shadway Component Generator",
      },
    });

    const messages: any[] = [
      {
        role: "system",
        content: `You are Shadway - an elite full-stack developer. You are helpful, professional, and precise.

**CONVERSATION RULES:**
- If the user greets you or asks a non-technical question, respond briefly and naturally in English.
- Do NOT generate code artifacts unless specifically requested.
- **STRICT ENGLISH ONLY:** Never use Chinese characters or repetitive nonsense.

**CODE GENERATION RULES:**
- **QUALITY:** Build production-grade, premium Vite + React apps. Every detail must feel world-class.
- **TAILWIND V4 SEMANTICS:** Use Tailwind CSS v4 semantic classes EXCLUSIVELY (e.g., bg-primary, text-muted-foreground, border-border, rounded-lg).
- **CRITICAL:** DO NOT use @import "tailwindcss", @theme, or tailwind.config.js/ts. The environment handles styling via standard classes.
- **FULL SCALE:** Always build full-page responsive layouts. Use min-h-screen and w-full for top-level containers to ensure they fill the preview panel.
- **SHADCN STANDARDS:** Follow latest Shadcn UI patterns. Use semantic tokens correctly.
- **LIBRARIES:** Use Lucide React for icons and Framer Motion for premium animations.
- **ROUTING:** Use HashRouter from react-router-dom for all multi-page layouts.
- **DESIGN:** Implement high-end aesthetics: glassmorphism, subtle gradients, and perfect typography using the Inter font.

**OUTPUT FORMAT (Only when building):**
- ALL architectural planning must reside inside <think> tags.
- The project files must be encapsulated in a <files entry="/App.tsx"> block.
- DO NOT provide any text or explanation outside of these tags during code generation.
- Example: <think>Architectural plan...</think> <files><file path="/App.tsx">...</file></files>`,
      },
      ...(projectContext
        ? [
          {
            role: "user" as const,
            content: String(projectContext),
          },
        ]
        : []),
      ...(conversationHistory || []),
      {
        role: "user" as const,
        content: prompt,
      },
    ];

    const stream = (await openai.chat.completions.create({
      model: "xiaomi/mimo-v2-flash:free",
      messages: messages as any,
      stream: true,
      reasoning: { enabled: reasoningEnabled ?? true },
      frequency_penalty: 0.5,
      presence_penalty: 0.3,
    } as any).catch((err: any) => {
      console.error("OpenRouter Error:", err);
      throw err;
    })) as any;

    const encoder = new TextEncoder();
    let isClosed = false;
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (isClosed) break;

            const delta = chunk.choices?.[0]?.delta || {};
            const content = delta.content || "";
            const reasoning = (delta as any).reasoning || "";
            const reasoning_details = (delta as any).reasoning_details;

            if (content || reasoning || reasoning_details) {
              const sseData = `data: ${JSON.stringify({
                choices: [
                  {
                    delta: { content, reasoning, reasoning_details },
                  },
                ],
              })}\n\n`;

              try {
                if (!isClosed) {
                  controller.enqueue(encoder.encode(sseData));
                }
              } catch (e) {
                isClosed = true;
                break;
              }
            }
          }
        } catch (error: any) {
          if (!isClosed) {
            console.error("Stream Error:", error);
            const errorMsg = error.message || "Provider stream error";
            const errorSSE = `data: ${JSON.stringify({ error: errorMsg })}\n\n`;
            try {
              controller.enqueue(encoder.encode(errorSSE));
            } catch (e) { }
          }
        } finally {
          if (!isClosed) {
            try {
              controller.close();
            } catch (e) { }
            isClosed = true;
          }
        }
      },
      cancel() {
        isClosed = true;
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering in some proxies
      },
    });
  } catch (error: any) {
    console.error("API high-level error:", error);
    const status = error.status || 500;
    const message = error.message || "Something went wrong";

    // Check for common provider errors
    if (message.includes("524") || message.includes("timeout")) {
      return NextResponse.json(
        { error: "The AI provider timed out. This often happens with free models during peak times. Please try again in a few moments." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
