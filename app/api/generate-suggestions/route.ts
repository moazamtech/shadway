import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Suggestion = {
  icon: string;
  title: string;
  prompt: string;
};

type SuggestionsRequestBody = {
  excludeTitles?: string[];
};

const HERO_DOMAINS = [
  "fintech",
  "healthtech",
  "developer tools",
  "AI productivity",
  "climate tech",
  "cybersecurity",
  "edtech",
  "creator platforms",
  "mobility",
  "B2B SaaS",
  "commerce",
  "analytics",
];

const HERO_MOTIFS = [
  "kinetic product reveal",
  "stacked device composition",
  "scroll-reactive spotlight",
  "split narrative layout",
  "floating metrics stage",
  "cinematic dashboard preview",
  "layered product canvas",
  "orbital card choreography",
  "signal-driven data glow",
  "precision grid reveal",
  "ambient parallax framing",
  "editorial asymmetry",
];

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  {
    icon: "sparkles",
    title: "Pulse Ledger Hero",
    prompt:
      "Design a sleek fintech hero section for a modern payments platform with crisp typography, layered product preview, unique motion reveals, fully responsive layout, and light/dark mode.",
  },
  {
    icon: "layout",
    title: "CareFlow Hero",
    prompt:
      "Create a clean healthcare SaaS hero section with serene spacing, live care coordination visuals, subtle unique animations, fully responsive structure, and light/dark mode.",
  },
  {
    icon: "component",
    title: "Forge Stack Hero",
    prompt:
      "Build a sleek developer tools hero section with code-window layering, precise grid rhythm, unique hover motion, fully responsive behavior, and light/dark mode.",
  },
  {
    icon: "layout",
    title: "Northstar Hero",
    prompt:
      "Design a clean climate tech hero section with atmospheric gradients, product storytelling, unique scroll-based animation, fully responsive composition, and light/dark mode.",
  },
  {
    icon: "sparkles",
    title: "Signal Vault Hero",
    prompt:
      "Create a cybersecurity hero section with sharp contrast, trust-building visual layers, unique animated security signals, fully responsive layout, and light/dark mode.",
  },
  {
    icon: "layout",
    title: "Studio Arc Hero",
    prompt:
      "Build a creator platform hero section with editorial composition, premium typography, unique floating motion system, fully responsive design, and light/dark mode.",
  },
  {
    icon: "stats",
    title: "Beacon Ops Hero",
    prompt:
      "Design a B2B analytics hero section with sleek charts, strong hierarchy, unique staggered entrance animations, fully responsive layout, and light/dark mode.",
  },
  {
    icon: "nav",
    title: "Atlas Ride Hero",
    prompt:
      "Create a mobility startup hero section with clean map-inspired framing, unique directional motion accents, fully responsive composition, and light/dark mode.",
  },
];

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

function uniqByTitle(list: Suggestion[]) {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ensurePromptConstraints(prompt: string) {
  let out = prompt.trim().replace(/\s+/g, " ");
  if (!/\bhero section\b/i.test(out)) out += " Hero section.";
  out = out.replace(/\bmodule\b/gi, "hero section");
  out = out.replace(/\bcomponent\b/gi, "hero section");
  if (!/fully responsive/i.test(out)) out += " Fully responsive.";
  if (!/light\/dark mode/i.test(out)) out += " Supports light/dark mode.";
  if (!/sleek|clean/i.test(out)) out += " Sleek clean design.";
  if (!/unique .*animation|unique motion|unique animations/i.test(out)) {
    out += " Includes unique animations.";
  }
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
      const firstArray = Object.values(parsed).find((value) =>
        Array.isArray(value),
      );
      if (Array.isArray(firstArray)) return firstArray as Suggestion[];
    }
  } catch {
    return [];
  }
  return [];
}

function pickRandomItems(source: string[], count: number) {
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function hasRepeatedCoreConcepts(list: Suggestion[]) {
  const normalized = list.map((item) =>
    `${item.title} ${item.prompt}`
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );

  const conceptWords = [
    "dashboard",
    "workspace",
    "panel",
    "rail",
    "queue",
    "command",
    "palette",
    "tracker",
    "feed",
    "cards",
    "switcher",
    "launcher",
    "console",
    "grid",
  ];

  return conceptWords.some((word) => {
    const hits = normalized.filter((tokens) => tokens.includes(word)).length;
    return hits >= 3;
  });
}

function filterAndFinalizeSuggestions(
  suggestions: Suggestion[],
  excludedTitles: Set<string>,
) {
  return uniqByTitle(
    uniqByContent(
      normalizeSuggestions(suggestions).map((suggestion) => ({
        ...suggestion,
        prompt: ensurePromptConstraints(suggestion.prompt),
      })),
    ),
  )
    .filter((suggestion) =>
      /\bhero section\b/i.test(`${suggestion.prompt} ${suggestion.title}`),
    )
    .filter(
      (suggestion) => !excludedTitles.has(suggestion.title.toLowerCase()),
    );
}

function pickFallbackSuggestions(excludedTitles: Set<string>) {
  const filtered = FALLBACK_SUGGESTIONS.filter(
    (suggestion) => !excludedTitles.has(suggestion.title.toLowerCase()),
  );
  const pool = filtered.length > 0 ? filtered : FALLBACK_SUGGESTIONS;
  return filterAndFinalizeSuggestions(pool, excludedTitles).slice(0, 6);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as SuggestionsRequestBody;
    const excludedTitles = new Set(
      Array.isArray(body.excludeTitles)
        ? body.excludeTitles
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().toLowerCase())
        : [],
    );

    if (!process.env.AI_GATEWAY_API_KEY) {
      return NextResponse.json(pickFallbackSuggestions(excludedTitles));
    }

    const requestId = crypto.randomUUID();
    const randomCategories = pickRandomItems(HERO_DOMAINS, 4);
    const randomPatterns = pickRandomItems(HERO_MOTIFS, 4);
    const randomNumber = crypto.getRandomValues(new Uint32Array(1))[0];

    const systemPrompt = `You generate inventive hero section prompts for a vibecoding platform.

The platform needs fresh hero ideas users can send to an AI builder.

Return 6 suggestions that feel:
- original
- product-minded
- modern
- buildable
- sleek
- clean
- professional
- visually sharp

Each suggestion must be an object with:
- icon: one of "component","layout","nav","pricing","auth","stats","testimonials","contact","sparkles"
- title: a short distinctive title, 2-4 words
- prompt: a concise but vivid build prompt, 18-32 words

Hard constraints:
- Every suggestion MUST be for a hero section.
- Do NOT generate cards, dashboards, forms, navbars, footers, pricing sections, testimonials, or generic modules.
- Each hero section must come from a different product domain.
- Each hero section must use a clearly different visual motif or animation system.
- Every prompt must explicitly mention sleek clean design.
- Every prompt must explicitly mention unique animations.
- Include a believable project or product context in the prompt.
- Every prompt must include "fully responsive" and "light/dark mode".
- Keep the language practical for a modern React UI build.
- Avoid generic startup copy and repeated wording across the set.

Return ONLY valid JSON in this exact shape:
{ "suggestions": [ { "icon": "...", "title": "...", "prompt": "..." }, ... ] }`;

    const initialPrompt = `Request ID: ${requestId}
Random seed: ${randomNumber}
Timestamp: ${new Date().toISOString()}
Product domains to spread across the set: ${randomCategories.join(", ")}
Hero motifs to spread across the set: ${randomPatterns.join(", ")}
Titles to avoid: ${Array.from(excludedTitles).join(", ") || "none"}

Invent 6 completely fresh hero section suggestions for a vibecoding platform to hand off to an AI builder.
Keep them distinct from each other, do not reuse any avoided title, and make each idea clearly different in both product domain and visual behavior.`;

    let suggestions: Suggestion[] = [];

    try {
      const { text } = await generateText({
        model: gateway("mistral/devstral-small-2507"),
        system: systemPrompt,
        prompt: initialPrompt,
        temperature: 1,
      });

      suggestions = filterAndFinalizeSuggestions(
        parseSuggestionsContent(text || "[]"),
        excludedTitles,
      );
      if (hasRepeatedCoreConcepts(suggestions)) {
        suggestions = [];
      }
    } catch (error) {
      console.error("generate-suggestions AI call failed:", error);
    }

    if (suggestions.length < 6) {
      try {
        const retryId = crypto.randomUUID();
        const retryNumber = crypto.getRandomValues(new Uint32Array(1))[0];
        const retryCategories = pickRandomItems(HERO_DOMAINS, 4);
        const retryPatterns = pickRandomItems(HERO_MOTIFS, 4);

        const { text } = await generateText({
          model: gateway("mistral/devstral-small-2507"),
          system: systemPrompt,
          prompt: `Request ID: ${retryId}
Random seed: ${retryNumber}
Timestamp: ${new Date().toISOString()}
Product domains: ${retryCategories.join(", ")}
Hero motifs to spread across the set: ${retryPatterns.join(", ")}
Already generated titles to AVOID: ${suggestions.map((item) => item.title).join(", ") || "none"}

Generate 6 completely NEW and DIFFERENT hero section ideas with distinct product contexts and clearly different visual behaviors. Do NOT repeat any concept family.`,
          temperature: 1,
        });

        const extraSuggestions = filterAndFinalizeSuggestions(
          parseSuggestionsContent(text || "[]"),
          excludedTitles,
        );

        suggestions = uniqByTitle(
          uniqByContent([...suggestions, ...extraSuggestions]),
        );
        if (hasRepeatedCoreConcepts(suggestions)) {
          suggestions = extraSuggestions;
        }
      } catch (error) {
        console.error("generate-suggestions retry failed:", error);
      }
    }

    const finalSuggestions = suggestions.slice(0, 6);
    if (finalSuggestions.length > 0) {
      return NextResponse.json(finalSuggestions);
    }

    return NextResponse.json(pickFallbackSuggestions(excludedTitles));
  } catch (error) {
    console.error("Suggestion generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 },
    );
  }
}
