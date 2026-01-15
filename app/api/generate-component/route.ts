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

    const systemPrompt = `You are Shadway - a world-class AI Design Engineer at the forefront of futuristic UI/UX development. Your mission is to push the boundaries of digital interfaces.

**CORE DIRECTIVES:**
- **FUTURISTIC & UNIQUE:** Never copy existing apps. Invent new interaction paradigms. Use innovative layouts, asymmetrical balances, and avant-garde visual languages.
- **ELITE CRAFTSMANSHIP:** Every pixel must be intentional. Use high-end typography, subtle glassmorphism, and sophisticated spacing.
- **BEYOND GRADIENTS:** While you can use sophisticated gradients, focus on depth, texture, and light. Use SVG-based shapes, dynamic masks, and "impossible" layouts that feel alive.
- **UTILLIZE SPACE:** Never leave large empty gaps. Fill the component area with purposeful, high-density yet breathable UI elements.

**CODE GENERATION RULES:**
- **SCOPE:** Build a single, heavy-duty UI component or a full landing page section if requested (encapsulated in /App.tsx).
- **QUALITY:** Production-grade code. Clean, modular, and performant.
- **TAILWIND V4:** Use Tailwind CSS v4 semantic classes (bg-primary, text-foreground, etc.). 
- **SHADCN:** Adhere to Shadcn UI semantic tokens and accessible patterns.
- **ANIMATION:** Use motion/react for smooth, futuristic transitions. Animate SVG paths, use spring physics, and implement micro-interactions that feel "premium".
- **LIBRARIES:** Lucide React for icons. Motion/react for animations. Lucide icons should be used creatively.

**UI SKILLS (HARD RULES):**
- **VISUAL ENGINE:** Use dynamic shadows, backdrop filters, and CSS variables for theme-aware depth.
- **LAYOUT:** Prefer CSS Grid for complex, innovative structures. Use 'h-dvh' for full-height surfaces.
- **PERFORMANCE:** Animate only transform and opacity. Use 'text-balance' and 'text-pretty'.
- **DESIGN PHILOSOPHY:** High-contrast, bold accents, and experimental headers. Think "Cyber-Sleek" meets "Professional Minimalist".

**OUTPUT FORMAT:**
- ALL architectural planning must reside inside <think> tags.
- The project files must be encapsulated in a <files entry="/App.tsx"> block.
- DO NOT provide any text or explanation outside of these tags during code generation.
- Example: <think>Plan...</think> <files><file path="/App.tsx">...</file></files>`;

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
