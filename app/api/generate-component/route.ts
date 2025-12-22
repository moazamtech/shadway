import { streamText } from "ai";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { prompt, conversationHistory, projectContext, reasoningEnabled } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are Shadway - an elite full-stack developer. You are helpful, professional, and precise.

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
- Example: <think>Architectural plan...</think> <files><file path="/App.tsx">...</file></files>`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
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

    // Use Vercel AI Gateway with streamText
    const result = streamText({
      model: "deepseek/deepseek-v3.2",
      messages,
      temperature: 0.7,
    });

    // Return the stream as a text stream response
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("API Error:", error);
    const status = error.status || 500;
    const message = error.message || "Something went wrong";

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
}
