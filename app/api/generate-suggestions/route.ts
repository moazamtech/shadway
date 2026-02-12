import { generateText } from "ai";

export const runtime = "nodejs";

type Suggestion = {
  icon: string;
  title: string;
  prompt: string;
};

function normalizeSuggestions(list: Suggestion[]): Suggestion[] {
  return list
    .filter((item) => item && item.title && item.prompt)
    .map((item) => ({
      icon: item.icon || "sparkles",
      title: String(item.title).trim().slice(0, 40),
      prompt: String(item.prompt).trim().replace(/\s+/g, " "),
    }));
}

function uniqByContent(list: Suggestion[]) {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = `${item.title.toLowerCase()}|${item.prompt.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensurePromptConstraints(prompt: string) {
  let out = prompt.trim().replace(/\s+/g, " ");
  out = out.replace(/\blanding page\b/gi, "component module");
  out = out.replace(/\blanding\b/gi, "component");
  if (!/fully responsive/i.test(out)) out += " Fully responsive.";
  if (!/light\/dark mode/i.test(out)) out += " Supports light/dark mode.";
  if (!/heavy animations/i.test(out))
    out += " Heavy animations with polished micro-interactions.";
  return out;
}

function parseSuggestionsContent(content: string): Suggestion[] {
  try {
    let jsonContent = content;
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    const objectMatch = content.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    } else if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    const parsed = JSON.parse(jsonContent);
    if (Array.isArray(parsed)) return parsed as Suggestion[];
    if (parsed && typeof parsed === "object") {
      const firstArray = Object.values(parsed).find((val) =>
        Array.isArray(val),
      );
      if (Array.isArray(firstArray)) return firstArray as Suggestion[];
    }
  } catch {
    return [];
  }
  return [];
}

function generateRandomCategory(): string {
  const categories = [
    "data visualization",
    "user input",
    "Navbar",
    "feedback",
    "media",
    "Hero Sections",
    "e-commerce",
    "productivity",
    "communication",
    "gaming",
    "finance",
    "health",
    "education",
    "creative tools",
    "developer tools",
    "file management",
    "scheduling",
    "analytics",
    "authentication",
    "collaboration",
    "entertainment",
    "utilities",
    "dashboard widgets",
    "form elements",
    "content display",
  ];
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return categories[array[0] % categories.length];
}

export async function POST() {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing AI_GATEWAY_API_KEY" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const requestId = crypto.randomUUID();
    const randomCategories = Array.from({ length: 3 }, () =>
      generateRandomCategory(),
    );
    const randomNumber = crypto.getRandomValues(new Uint32Array(1))[0];

    const systemPrompt = `You are a wildly creative UI/UX idea generator for a design-to-code platform.
Your job is to invent 6 COMPLETELY ORIGINAL and UNIQUE component ideas every single time.

CRITICAL: You must NEVER repeat ideas. Every response must contain brand new, never-before-seen concepts.
Think of entirely new interaction patterns, novel UI paradigms, and unexpected component behaviors.
Be inventive — imagine components that don't exist yet unique on concept components and also fully response suggestion and color scheme and fully take it the component hero section.

Each suggestion must be an object with:
- icon: a lucide icon key (one of or more unqiue from these : "component","layout","nav","pricing","auth","stats","testimonials","contact","sparkles")
- title: a short creative title (2-4 words)
- prompt: a detailed buildable prompt (22-45 words) describing the component behavior, animation style, interaction states, and implementation details

Hard constraints:
- Do NOT mention landing pages, homepages, hero sections, pricing pages, or full-site structure.
- Every suggestion must be a single reusable component/module, NOT a full page.
- Heavy animations are mandatory: choreographed transitions, layered motion, and micro-interactions.
- All 6 ideas must be from DIFFERENT domains and have DIFFERENT interaction patterns.
- Every suggestion must include "fully responsive" and "light/dark mode" in the prompt.
- Keep prompts practical for React + Tailwind + Framer Motion.

Return ONLY valid JSON in this exact shape:
{ "suggestions": [ { "icon": "...", "title": "...", "prompt": "..." }, ... ] }`;

    const userPrompt = `Request ID: ${requestId}
Random seed: ${randomNumber}
Timestamp: ${new Date().toISOString()}
Focus areas for inspiration (but don't limit yourself): ${randomCategories.join(", ")}

Invent 6 completely fresh, creative, never-before-seen component ideas NOW.
Each must be totally different from the others. Surprise me with originality.`;

    let suggestions: Suggestion[] = [];

    try {
      const { text } = await generateText({
        model: "meituan/longcat-flash-chat",
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 1.0,
      });

      const parsed = parseSuggestionsContent(text || "[]");
      suggestions = uniqByContent(
        normalizeSuggestions(parsed).map((s) => ({
          ...s,
          prompt: ensurePromptConstraints(s.prompt),
        })),
      );
      suggestions = suggestions.filter(
        (s) => !/\blanding|homepage|hero\b/i.test(s.prompt + " " + s.title),
      );
    } catch (err: unknown) {
      console.error("generate-suggestions AI call failed:", err);
    }

    // If AI didn't return enough, do a second attempt with a fresh seed
    if (suggestions.length < 6) {
      try {
        const retryId = crypto.randomUUID();
        const retryNumber = crypto.getRandomValues(new Uint32Array(1))[0];
        const retryCategories = Array.from({ length: 3 }, () =>
          generateRandomCategory(),
        );

        const { text } = await generateText({
          model: "meituan/longcat-flash-chat",
          system: systemPrompt,
          prompt: `Request ID: ${retryId}
Random seed: ${retryNumber}
Timestamp: ${new Date().toISOString()}
Focus areas: ${retryCategories.join(", ")}
Already generated titles to AVOID: ${suggestions.map((s) => s.title).join(", ") || "none"}

Generate 6 completely NEW and DIFFERENT component ideas. Do NOT repeat any concept.`,
          temperature: 1.0,
        });

        const parsed = parseSuggestionsContent(text || "[]");
        const extra = uniqByContent(
          normalizeSuggestions(parsed).map((s) => ({
            ...s,
            prompt: ensurePromptConstraints(s.prompt),
          })),
        ).filter(
          (s) => !/\blanding|homepage|hero\b/i.test(s.prompt + " " + s.title),
        );

        suggestions = uniqByContent([...suggestions, ...extra]);
      } catch (err: unknown) {
        console.error("generate-suggestions retry failed:", err);
      }
    }

    const finalSuggestions = suggestions.slice(0, 6);

    return new Response(JSON.stringify(finalSuggestions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Suggestion generation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate suggestions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
