import OpenAI from "openai";

export const runtime = "edge";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
    "X-Title": "Shadway Suggestion Generator",
  },
});

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

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  {
    icon: "landing",
    title: "SaaS Landing",
    prompt:
      "SaaS landing page with hero + 2 CTAs, logo strip, feature grid, pricing toggle, FAQ, and footer. Sleek spacing, fully responsive, light/dark.",
  },
  {
    icon: "landing",
    title: "Memecoin Launch",
    prompt:
      "Crypto memecoin landing with bold hero, tokenomics cards, roadmap timeline, community stats, and audit badge. Neon accents, responsive, light/dark.",
  },
  {
    icon: "landing",
    title: "IT Marketing",
    prompt:
      "Tech/IT services marketing landing with services grid, client logos, KPI strip, case studies, and strong CTA. Clean corporate, responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Hero Split",
    prompt:
      "Hero section with split layout, bold headline, subtext, 2 CTAs, and a product preview card. Fully responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Hero Proof",
    prompt:
      "Hero section with logo strip + social proof stats, minimal form or CTA, and a soft gradient backdrop. Fully responsive, light/dark.",
  },
  {
    icon: "layout",
    title: "Hero Centered",
    prompt:
      "Centered hero section with headline, 2 CTAs, short value props, and a small testimonial pill. Fully responsive, light/dark.",
  },
];

function pickUnique(source: string[], count: number) {
  return [...source].sort(() => Math.random() - 0.5).slice(0, count);
}

function normalizeSuggestions(list: Suggestion[]): Suggestion[] {
  const clean = list
    .filter((item) => item && item.title && item.prompt)
    .map((item) => ({
      icon: item.icon || "sparkles",
      title: String(item.title).trim().slice(0, 40),
      prompt: String(item.prompt).trim().replace(/\s+/g, " "),
    }));
  return clean;
}

export async function POST(req: Request) {
  try {
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
- The 3 landing page ideas MUST use different industries/concepts from each other.
- The 3 block ideas MUST be different hero patterns.
- Every suggestion must mention "fully responsive" and "light/dark mode".
- For landing pages, include concrete sections (hero, features, pricing, social proof, FAQ, footer, etc).

Return JSON ONLY in this shape:
{ "suggestions": [ ... ] }`;

    const response = await client.chat.completions.create({
      model: "allenai/molmo-2-8b:free",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Seed: ${seed}
Landing themes: ${landingThemes.join(", ")}
Component themes: ${componentThemes.join(", ")}
Generate 6 fresh, unique suggestions now.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 1.1,
    });

    const content = response.choices[0].message.content || "[]";
    let suggestions = [];

    try {
      // Robust JSON extraction: look for [ ] or { } blocks
      let jsonContent = content;
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      const objectMatch = content.match(/\{[\s\S]*\}/);

      if (arrayMatch) {
        jsonContent = arrayMatch[0];
      } else if (objectMatch) {
        jsonContent = objectMatch[0];
      }

      const parsed = JSON.parse(jsonContent);
      // Handle potential wrapper object like { "suggestions": [...] }
      if (Array.isArray(parsed)) {
        suggestions = parsed;
      } else if (parsed && typeof parsed === "object") {
        // Return the first array found in the object, or the object itself if no array
        const firstArray = Object.values(parsed).find((val) =>
          Array.isArray(val),
        );
        suggestions = firstArray || [parsed];
      }
    } catch (e) {
      console.error("Failed to parse AI suggestions content:", content);
      console.error("Parse Error:", e);
    }

    const normalized = normalizeSuggestions(suggestions);
    const finalSuggestions =
      normalized.length === 6 ? normalized : FALLBACK_SUGGESTIONS;

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
