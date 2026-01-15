import OpenAI from "openai";

export const runtime = "edge";

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
        "X-Title": "Shadway Suggestion Generator",
    },
});

export async function POST(req: Request) {
    try {
        const systemPrompt = `You are a creative UI/UX design assistant. 
    Generate 4 unique, futuristic, and highly creative UI component ideas for a design-to-code platform.
    
    Each suggestion must have:
    - emoji: A single relevant emoji.
    - title: A short, punchy title (2-3 words).
    - prompt: A detailed, engineering-focused prompt that describes the component's layout, aesthetic, and behavior.
    
    Format the output as a JSON array of objects.
    
    Constraints:
    - Focus on futuristic, sleek, and high-end professional UI.
    - Use terms like "glassmorphism", "bento grid", "dynamic micro-interactions", "SVG masking", "neo-brutalism", "AI-driven layout".
    - Each prompt should be 15-25 words.
    
    Return ONLY the JSON array.`;

        const response = await client.chat.completions.create({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate 4 fresh UI component suggestions." }
            ],
            response_format: { type: "json_object" },
            temperature: 0.8,
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
            } else if (parsed && typeof parsed === 'object') {
                // Return the first array found in the object, or the object itself if no array
                const firstArray = Object.values(parsed).find(val => Array.isArray(val));
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
        return new Response(JSON.stringify({ error: "Failed to generate suggestions" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
