import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

export const runtime = "edge";

type Suggestion = {
  icon: string;
  title: string;
  prompt: string;
};

const COMPONENT_CONCEPTS = [
  "magnetic command palette",
  "kinetic onboarding stepper",
  "neural loading state module",
  "reactive pricing configurator",
  "animated feedback panel",
  "morphing settings control dock",
  "signal-based notification stack",
  "timeline scrubber with motion cues",
  "gesture-driven media controller",
  "data card with live transitions",
  "interactive comparison slider",
  "command center widget rail",
  "animated auth interaction panel",
  "floating contextual action dock",
  "workflow status matrix",
  "modal choreography system",
  "input orchestration surface",
  "dashboard micro-interaction bundle",
];

const STYLE_FLAVORS = [
  "futuristic minimal",
  "clean cyber interface",
  "high-contrast glass layer",
  "precision geometric",
  "sleek enterprise motion",
  "modern kinetic ui",
  "premium monochrome neon accent",
  "technical blueprint aesthetic",
];

function pickUnique(source: string[], count: number) {
  return [...source].sort(() => Math.random() - 0.5).slice(0, count);
}

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

function buildDynamicFallback(componentThemes: string[]): Suggestion[] {
  const blocks = componentThemes.map((theme, idx) => {
    const style = STYLE_FLAVORS[(idx + 3) % STYLE_FLAVORS.length];
    return {
      icon: "layout",
      title: `Concept ${idx + 1}`,
      prompt: ensurePromptConstraints(
        `${theme} component concept with advanced motion choreography, layered transitions, and interactive states. ${style} styling with production-ready structure and clear interaction flow.`,
      ),
    };
  });

  return uniqByContent(normalizeSuggestions(blocks)).slice(0, 6);
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

    // Per-request seed + theme buckets nudge ideas away from repetition.
    const seed = crypto.randomUUID();
    const componentThemes = pickUnique(COMPONENT_CONCEPTS, 6);

    const systemPrompt = `You are a UI/UX assistant for a design-to-code platform.
Generate exactly 6 unique suggestions.
Only generate COMPONENT concepts, never full pages and never landing page ideas.
Focus on heavy, premium animations and futuristic interaction patterns.

Each suggestion must be an object with:
- icon: a lucide icon key (one of: "component","layout","nav","pricing","auth","stats","testimonials","contact","sparkles")
- title: a short title (2-4 words)
- prompt: a buildable prompt (22-45 words) describing component behavior, heavy animation style, interaction states, and implementation constraints

Hard constraints:
- Do NOT mention landing pages, homepages, hero sections, pricing pages, or full-site structure.
- Every suggestion must be a reusable component/module.
- Heavy animations are mandatory: choreographed transitions, layered motion, and micro-interactions.
- Make all 6 ideas structurally different from each other.
- Avoid generic repeats; each result must feel like a new concept family.
- Every suggestion must mention "fully responsive" and "light/dark mode".
- Keep prompts practical for implementation in React + Tailwind + Framer Motion.

Return JSON ONLY in this shape:
{ "suggestions": [ ... ] }`;

    const makeRequest = async (
      seed: string,
      requestComponentThemes: string[],
      existingTitles: string[] = [],
      existingFingerprints: string[] = [],
    ) => {
      try {
        const { text } = await generateText({
          model: gateway("openai/gpt-oss-120b"),
          system: systemPrompt,
          prompt: `Seed: ${seed}
Timestamp: ${new Date().toISOString()}
Component themes: ${requestComponentThemes.join(", ")}
Avoid these titles: ${existingTitles.join(", ") || "none"}
Avoid these concept fingerprints: ${existingFingerprints.join(" | ") || "none"}
Generate 6 fresh, unique suggestions now.`,
          temperature: 1.2,
        });
        return parseSuggestionsContent(text || "[]");
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err !== null
            ? ((err as { statusCode?: number; status?: number }).statusCode ??
              (err as { statusCode?: number; status?: number }).status)
            : undefined;
        if (statusCode === 404) {
          if (!longcatUnavailable) {
            longcatUnavailable = true;
            console.warn(
              "generate-suggestions: primary model unavailable (404). Using dynamic fallback suggestions.",
            );
          }
          return [];
        }
        console.error("generate-suggestions AI call failed:", err);
        return [];
      }
    };

    const firstPass = await makeRequest(seed, componentThemes);
    let merged = uniqByContent(
      normalizeSuggestions(firstPass).map((s) => ({
        ...s,
        prompt: ensurePromptConstraints(s.prompt),
      })),
    );
    merged = merged.filter((s) => !/\blanding|homepage|hero\b/i.test(s.prompt));
    merged = merged.filter((s) => !/\blanding|homepage|hero\b/i.test(s.title));

    if (merged.length < 6 && !longcatUnavailable) {
      const seed2 = crypto.randomUUID();
      const secondPass = await makeRequest(
        seed2,
        pickUnique(COMPONENT_CONCEPTS, 6),
        merged.map((item) => item.title),
        merged.map(
          (item) =>
            `${item.title.toLowerCase()}::${item.prompt.toLowerCase().slice(0, 80)}`,
        ),
      );
      merged = uniqByContent(
        [...merged, ...normalizeSuggestions(secondPass)].map((s) => ({
          ...s,
          prompt: ensurePromptConstraints(s.prompt),
        })),
      );
      merged = merged.filter(
        (s) => !/\blanding|homepage|hero\b/i.test(s.prompt),
      );
      merged = merged.filter(
        (s) => !/\blanding|homepage|hero\b/i.test(s.title),
      );
    }

    const dynamicFallback = buildDynamicFallback(
      pickUnique(COMPONENT_CONCEPTS, 6),
    );
    const finalSuggestions = [...merged, ...dynamicFallback]
      .filter((s) => !/\blanding|homepage|hero\b/i.test(s.prompt))
      .filter((s) => !/\blanding|homepage|hero\b/i.test(s.title))
      .slice(0, 6);

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
let longcatUnavailable = false;
