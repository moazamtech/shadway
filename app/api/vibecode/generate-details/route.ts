import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
    "X-Title": "Shadway Vibecode Details",
  },
});

type GenerateDetailsBody = {
  prompt?: string;
  code?: string;
  files?: Record<string, string>;
  entryFile?: string;
};

function extractJson(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as GenerateDetailsBody;
    const prompt = body?.prompt?.trim() || "";
    const code = body?.code?.trim() || "";
    const entryFile = body?.entryFile || "";
    const files = body?.files || {};

    const context = [
      prompt ? `User prompt:\n${prompt}` : "",
      code ? `Primary code:\n${code}` : "",
      entryFile && files?.[entryFile]
        ? `Entry file (${entryFile}):\n${files[entryFile]}`
        : "",
      !code && Object.keys(files).length
        ? `Files:\n${Object.entries(files)
            .slice(0, 6)
            .map(([path, content]) => `- ${path}\n${content}`)
            .join("\n\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      {
        role: "system",
        content:
          "You write concise, high-quality metadata for UI components. Return ONLY valid JSON with keys: title, description, category, tags. Title <= 60 chars. Description <= 160 chars. Category is a short label like Hero, Pricing, Footer, Dashboard, Form, Navigation, or Card. Tags is an array of 3-6 short lowercase tags.",
      },
      {
        role: "user",
        content:
          context ||
          "Generate metadata for a UI component. Return JSON only.",
      },
    ];

    const completion = await client.chat.completions.create({
      model: "xiaomi/mimo-v2-flash:free",
      messages,
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "";
    const parsed = extractJson(content);
    if (!parsed) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      title: String(parsed.title || "").trim(),
      description: String(parsed.description || "").trim(),
      category: String(parsed.category || "").trim(),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
        : [],
    });
  } catch (error) {
    console.error("Generate vibecode details error:", error);
    return NextResponse.json(
      { error: "Failed to generate details" },
      { status: 500 },
    );
  }
}
