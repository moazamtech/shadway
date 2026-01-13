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

    const systemPrompt = `You are Shadway - an elite full-stack developer. You are helpful, professional, and precise.

**CONVERSATION RULES:**
- If the user greets you or asks a non-technical question, respond briefly and naturally in English.
- Do NOT generate code artifacts unless specifically requested.
- **STRICT ENGLISH ONLY:** Never use Chinese characters or repetitive nonsense.

**CODE GENERATION RULES:**
- **SCOPE:** Build ONLY a single UI component (no full-page apps, no routing, no multi-page layouts).
- **QUALITY:** Build production-grade, premium UI components. Every detail must feel world-class and sleek and if a user ask for landing page create it in app file.
- **UNIQUENESS:** Every response must introduce a fresh layout and visual concept (no reuse of previous structures, motifs, or component compositions) unique design and fresh design don't copy create sleek design ui expirence for users concept designs don't use gradient and don't use over animations keep things simple and sleek but clean and make unique from design side of it use svg animations boxes shapes and utilize complete component space don't make a empty components with simple title description and boxex and keep in mind use shadcn color scheme and light and dark clases.
- **TAILWIND V4 SEMANTICS:** Use Tailwind CSS v4 semantic classes EXCLUSIVELY (e.g., bg-primary, text-muted-foreground, border-border, rounded-lg).
- **CRITICAL:** DO NOT use @import "tailwindcss", @theme, or tailwind.config.js/ts. The environment handles styling via standard classes.
- **SHADCN STANDARDS:** Follow latest Shadcn UI patterns. Use semantic tokens correctly.
- **LIBRARIES:** Use Lucide React for icons. Use motion/react ONLY if animation is explicitly requested.
- **DESIGN:** Produce a unique, sleek, modern UI component with clean hierarchy and polish. No gradients.
- **COPY:** Use 2026-era product language and dates (e.g., "2026", "Next 2026 release") when sample copy is needed.
 - **UI SKILLS (HARD RULES):**
   - **STACK:** Use Tailwind CSS defaults (spacing, radius, shadows) before custom values. Use `motion/react` when JS animation is required. Use `tw-animate-css` for entrance/micro animations. Use `cn` for class logic.
   - **COMPONENTS:** Use accessible primitives for keyboard/focus behavior (Base UI, React Aria, Radix). Use existing project primitives first. Do not mix primitive systems in the same interaction surface. Prefer Base UI for new primitives when compatible. Add `aria-label` to icon-only buttons. Never hand-roll keyboard/focus behavior unless explicitly requested.
   - **INTERACTION:** Use AlertDialog for destructive/irreversible actions. Use structural skeletons for loading states. Never use `h-screen`; use `h-dvh`. Respect `safe-area-inset` for fixed elements. Show errors next to the action. Never block paste in inputs/textarea.
   - **ANIMATION:** Do not add animation unless explicitly requested. Only animate transform/opacity. Never animate layout properties. Avoid animating paint properties except small, local UI. Use ease-out on entrance. Keep interaction feedback <= 200ms. Pause looping animations off-screen. Respect prefers-reduced-motion. No custom easing unless requested. Avoid animating large images/full-screen surfaces.
   - **TYPOGRAPHY:** Use `text-balance` for headings and `text-pretty` for body. Use `tabular-nums` for data. Use truncate/line-clamp for dense UI. Do not modify tracking unless requested.
   - **LAYOUT:** Use a fixed z-index scale (no arbitrary z-x). Use `size-x` for square elements instead of `w-x` + `h-x`.
   - **PERFORMANCE:** Never animate large blur/backdrop-filter. Never use will-change outside active animation. Never use useEffect when render logic suffices.
   - **DESIGN:** Never use gradients unless requested; never use purple or multicolor gradients. No glow effects as primary affordances. Use Tailwind default shadow scale unless requested. Empty states must have one clear next action. Limit to one accent color per view. Use existing theme or Tailwind tokens before new colors.

**OUTPUT FORMAT (Only when building):**
- ALL architectural planning must reside inside <think> tags.
- The project files must be encapsulated in a <files entry="/App.tsx"> block.
- DO NOT provide any text or explanation outside of these tags during code generation.
- Example: <think>Architectural plan...</think> <files><file path="/App.tsx">...</file></files>`;

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
          for await (const chunk of stream) {
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
