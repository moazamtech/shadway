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
  "no-code nonprofit fundraiser",
  "electric bike subscription",
  "remote yoga studio",
  "biotech research platform",
  "indie music label",
  "sustainable packaging startup",
  "city travel pass",
  "AI legal assistant",
  "real estate micro-living",
  "artisan coffee roaster",
  "cybersecurity audit firm",
  "edtech language tutor",
];

const COMPONENT_CONCEPTS = [
  "pricing comparison",
  "testimonial carousel",
  "stats + KPI strip",
  "feature grid",
  "auth onboarding",
  "newsletter signup",
  "FAQ accordion",
  "app header/nav",
  "footer sitemap",
  "contact form",
  "roadmap timeline",
  "case study block",
];

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  {
    icon: "landing",
    title: "Electric Bike",
    prompt:
      "Design an electric bike subscription landing page with bold hero, pricing tiers, city map strip, and a clean, minimal footer.",
  },
  {
    icon: "landing",
    title: "AI Legal",
    prompt:
      "Create an AI legal assistant landing page with trust badges, compliance highlights, a step-by-step workflow, and a calm, professional look.",
  },
  {
    icon: "landing",
    title: "Remote Yoga",
    prompt:
      "Build a remote yoga studio landing page with class schedule cards, instructor avatars, testimonials, and a warm, airy aesthetic.",
  },
  {
    icon: "pricing",
    title: "Pricing Table",
    prompt:
      "Make a pricing comparison section with monthly/yearly toggle, three plans, feature checklist, and a highlighted recommended plan.",
  },
  {
    icon: "testimonials",
    title: "Testimonial Grid",
    prompt:
      "Create a testimonials grid with star ratings, avatar + role, short quotes, and subtle card hover states.",
  },
  {
    icon: "nav",
    title: "Sticky Navbar",
    prompt:
      "Design a sticky navbar with product dropdown, search input, login button, and a responsive mobile sheet menu.",
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
- 3 Components (single sections/blocks)

Each suggestion must be an object with:
- icon: a lucide icon key (one of: "landing","component","layout","nav","pricing","auth","stats","testimonials","contact","sparkles")
- title: a short title (2-4 words)
- prompt: a simple, buildable prompt (15-30 words) describing layout + visual style + key elements

Hard constraints:
- Keep prompts simple and implementable.
- Make ideas distinct from each other (different industries, layouts, or visual languages).
- Avoid repeating the same themes across requests.
- The 3 landing page ideas MUST use different industries/concepts from each other.
- The 3 component ideas MUST be different section types.

Return JSON ONLY in this shape:
{ "suggestions": [ ... ] }`;

    const response = await client.chat.completions.create({
      model: "arcee-ai/trinity-mini:free",
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
