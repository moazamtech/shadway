import OpenAI from "openai";

export const runtime = "edge";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
    "X-Title": "Shadway Component Generator",
  },
});

export async function POST(req: Request) {
  try {
    const {
      prompt,
      conversationHistory,
      projectContext,
      reasoningEnabled,
      maxTokens,
    } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are Shadway - a legendary Design Engineer and AWWWARDS-winning architect. You craft multi-layered digital masterpieces.

**PRIVACY & ANONYMITY (CRITICAL):**
- NEVER share personal details (Discord, Emails, Real Names). 
- NEVER use names or references provided in the prompt in the final design. Use generic, professional placeholders (e.g., "Founder", "Team Lead", "Alpha").

**AWWWARDS-LEVEL MASTERPIECE:**
- **QUALITY:** No simple cards. Build heavy, multi-section components. A "Hero" request MUST include a sophisticated header and a data-rich hero area.
- **VISUAL ENGINE:** Use SVG masking, 'clip-path', grain textures, and matte lighting. Avoid standard gradients.
- **DENSITY:** Fill space with purposeful technical data, stats, or geometric motifs. 
- **SHADCN & TAILWIND:** You have the FULL Shadcn UI library. Use lowercase filenames in imports.
  - Available: Button, Card, Input, Textarea, Badge, Separator, Container, Skeleton, Label, Switch, Avatar, Tabs, Checkbox, Slider.
  - Layout: ALWAYS wrap content in <Container> from "@/components/ui/container" for centering.

**THE EDITING PROTOCOL:**
- If the user provides a follow-up request, treat it as an **EDITING MISSION**.
- Review the current code and provide ONLY the updated files. 
- Maintain the high design standard during edits.

**CODE GENERATION RULES:**
- **TAILWIND V4:** Use semantic classes only (bg-primary, text-foreground).
- **ANIMATION:** Use motion/react for ALL transitions.
- **OUTPUT:** Plan in <think>. Briefly explain your architectural decisions and interact with the USER naturally. When generating component code, use <files entry="/App.tsx">. Always remain in character as Shadway.`;

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
        { role: "system", content: systemPrompt },
        ...(projectContext
          ? [{ role: "user" as const, content: String(projectContext) }]
          : []),
        ...(conversationHistory || []).map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: prompt },
      ];

    const resolvedMaxTokens =
      typeof maxTokens === "number"
        ? Math.max(256, Math.min(12000, maxTokens))
        : 6000;

    const stream = await client.chat.completions.create({
      model: "xiaomi/mimo-v2-flash:free",
      messages,
      max_tokens: resolvedMaxTokens,
      temperature: 0.7,
      stream: true,
    } as Parameters<typeof client.chat.completions.create>[0]);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream as any) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: errorMessage })),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("API Error:", error);
    const status = error.status || 500;
    const message = error.message || "Something went wrong";

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
