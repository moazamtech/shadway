import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

export const runtime = "edge";

type Suggestion = {
  icon: string;
  title: string;
  prompt: string;
};

const LANDING_CONCEPTS = [
  "SaaS product landing",
  "crypto memecoin launch",
  "marketing landing for tech/IT company",
  "fintech budgeting platform",
  "healthcare operations dashboard",
  "climate-tech analytics platform",
  "logistics & fleet management",
  "AI customer support platform",
  "creator monetization suite",
  "remote team collaboration suite",
  "B2B cybersecurity compliance",
  "edtech cohort learning platform",
];

const COMPONENT_CONCEPTS = [
  "hero split layout",
  "hero centered headline",
  "hero with social proof",
  "hero with product preview",
  "hero with lead form",
  "hero + stats strip",
  "hero with video modal",
  "hero with feature pills",
  "hero with comparison mini-cards",
  "hero with timeline teaser",
  "hero with testimonial pill",
  "hero with trust badges",
];

const STYLE_FLAVORS = [
  "editorial minimal",
  "neo brutal clean",
  "glassmorphism soft",
  "bold geometric",
  "enterprise polished",
  "modern contrast",
  "premium monochrome",
  "vibrant gradient",
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
  if (!/fully responsive/i.test(out)) out += " Fully responsive.";
  if (!/light\/dark mode/i.test(out)) out += " Supports light/dark mode.";
  return out;
}

function buildDynamicFallback(
  landingThemes: string[],
  componentThemes: string[],
): Suggestion[] {
  const landing = landingThemes.map((theme, idx) => {
    const style = STYLE_FLAVORS[idx % STYLE_FLAVORS.length];
    const title = theme
      .replace(/platform|suite|landing|for|&/gi, "")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
    return {
      icon: "landing",
      title: title ? `${title} Page` : `Landing ${idx + 1}`,
      prompt: ensurePromptConstraints(
        `${theme} landing page with hero, feature grid, social proof, pricing, FAQ, and footer. ${style} visual language with clear CTA hierarchy.`,
      ),
    };
  });

  const blocks = componentThemes.map((theme, idx) => {
    const style = STYLE_FLAVORS[(idx + 3) % STYLE_FLAVORS.length];
    return {
      icon: "layout",
      title: `Hero ${idx + 1}`,
      prompt: ensurePromptConstraints(
        `${theme} with strong headline, supporting copy, primary and secondary CTAs, and trust elements. ${style} styling with practical spacing and reusable structure.`,
      ),
    };
  });

  return uniqByContent(normalizeSuggestions([...landing, ...blocks])).slice(
    0,
    6,
  );
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

    // Per-request seed + theme buckets nudges the model away from repeating the same ideas.
    const seed = crypto.randomUUID();
    const landingThemes = pickUnique(LANDING_CONCEPTS, 3);
    const componentThemes = pickUnique(COMPONENT_CONCEPTS, 3);

    const systemPrompt = `You are a UI/UX assistant for a design-to-code platform.
Generate 6 suggestions TOTAL, mixing:
- 3 Landing pages (full pages)
- 3 Blocks (single sections/blocks)

Each suggestion must be an object with:
- icon: a lucide icon key (one of: "landing","component","layout","nav","pricing","auth","stats","testimonials","contact","sparkles")
- title: a short title (2-4 words)
- prompt: a simple, buildable prompt (18-35 words) describing layout + visual style + key elements + responsiveness

Hard constraints:
- Keep prompts simple and implementable.
- Make ideas distinct from each other (different industries, layouts, or visual languages).
- Avoid repeating the same themes across requests.
- NEVER reuse exact titles from common defaults such as "SaaS Landing", "Hero Split", "Hero Centered", "Hero Proof".
- The 3 landing page ideas MUST use different industries/concepts from each other.
- The 3 block ideas MUST be different hero patterns.
- Every suggestion must mention "fully responsive" and "light/dark mode".
- For landing pages, include concrete sections (hero, features, pricing, social proof, FAQ, footer, etc).

Return JSON ONLY in this shape:
{ "suggestions": [ ... ] }`;

    const makeRequest = async (
      seed: string,
      requestLandingThemes: string[],
      requestComponentThemes: string[],
      existingTitles: string[] = [],
    ) => {
      try {
        const { text } = await generateText({
          model: gateway("mistral/devstral-2"),
          system: systemPrompt,
          prompt: `Seed: ${seed}
Timestamp: ${new Date().toISOString()}
Landing themes: ${requestLandingThemes.join(", ")}
Component themes: ${requestComponentThemes.join(", ")}
Avoid these titles: ${existingTitles.join(", ") || "none"}
Generate 6 fresh, unique suggestions now.`,
          temperature: 1.2,
        });
        return parseSuggestionsContent(text || "[]");
      } catch (err: any) {
        const statusCode = err?.statusCode ?? err?.status;
        if (statusCode === 404) {
          if (!longcatUnavailable) {
            longcatUnavailable = true;
            console.warn(
              "generate-suggestions: meituan/longcat-flash-chat unavailable (404). Using dynamic fallback suggestions.",
            );
          }
          return [];
        }
        console.error("generate-suggestions AI call failed:", err);
        return [];
      }
    };

    const firstPass = await makeRequest(seed, landingThemes, componentThemes);
    let merged = uniqByContent(
      normalizeSuggestions(firstPass).map((s) => ({
        ...s,
        prompt: ensurePromptConstraints(s.prompt),
      })),
    );

    if (merged.length < 6 && !longcatUnavailable) {
      const seed2 = crypto.randomUUID();
      const secondPass = await makeRequest(
        seed2,
        pickUnique(LANDING_CONCEPTS, 3),
        pickUnique(COMPONENT_CONCEPTS, 3),
        merged.map((item) => item.title),
      );
      merged = uniqByContent(
        [...merged, ...normalizeSuggestions(secondPass)].map((s) => ({
          ...s,
          prompt: ensurePromptConstraints(s.prompt),
        })),
      );
    }

    const dynamicFallback = buildDynamicFallback(
      pickUnique(LANDING_CONCEPTS, 3),
      pickUnique(COMPONENT_CONCEPTS, 3),
    );
    const finalSuggestions = [...merged, ...dynamicFallback].slice(0, 6);

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
