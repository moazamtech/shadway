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

export async function POST(req: Request) {
  try {
    // Per-request seed + theme buckets nudges the model away from repeating the same ideas.
    const seed = crypto.randomUUID();
    const buckets = [
      "minimal editorial landing page",
      "bold product marketing landing page",
      "crypto / web3 landing page",
      "AI SaaS landing page",
      "portfolio / studio landing page",
      "dashboard component set",
      "pricing + FAQ component",
      "auth / onboarding component",
      "navbar + footer component",
      "testimonials + stats component",
    ];
    const pickedBuckets = [...buckets]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

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

Return JSON ONLY in this shape:
{ "suggestions": [ ... ] }`;

    const response = await client.chat.completions.create({
      model: "xiaomi/mimo-v2-flash:free",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Seed: ${seed}\nThemes: ${pickedBuckets.join(", ")}\nGenerate 6 fresh, unique suggestions now.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 1.0,
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

    return new Response(JSON.stringify(suggestions), {
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
