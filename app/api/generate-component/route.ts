import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { prompt, conversationHistory, projectContext } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://shadway.online",
        "X-Title": "Shadway Component Generator",
      },
    });

    const messages: any[] = [
      {
        role: "system",
        content: `You are VIBE CODE AI - an advanced full-stack React development assistant. You help users build complete Vite + React applications with multiple pages and components.

**CAPABILITIES:**
- Generate complete multi-page Vite React applications.
- Use packages: react-router-dom, axios, zustand, @tanstack/react-query, zod, lucide-react, framer-motion.
- Use **Lucide React** for icons and **Framer Motion** for animations.

**ARCHITECTURE & STYLE:**
- **Tailwind CSS:** Use standard utility classes. DO NOT include @import "tailwindcss" in CSS.
- **Fonts:** Create a /global.css file. Import Google Fonts using @import url().
- **Entry:** The entry file MUST be /App.tsx. You MUST import "import './global.css'" in /App.tsx.
- **Colors:** Use Shadcn semantic tokens (bg-background, text-foreground, bg-primary, etc.).
- **Routing:** ALWAYS use HashRouter.

**OUTPUT FORMAT:**
Every project generation MUST start with <think> planning tags, followed by a <files> block.

<think>
[Planning]
</think>

<files entry="/App.tsx">
  <file path="/global.css">
/* Tailwind CSS is loaded via CDN - DO NOT add @import tailwindcss */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  font-family: 'Inter', system-ui, sans-serif;
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 63.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;
  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
  </file>
  <file path="/App.tsx">
import React from "react";
import "./global.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./app/Home";

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
  </file>
</files>`,
      },
      ...(projectContext
        ? [
          {
            role: "user" as const,
            content: String(projectContext),
          },
        ]
        : []),
      ...(conversationHistory || []),
      {
        role: "user" as const,
        content: prompt,
      },
    ];

    const stream = (await openai.chat.completions.create({
      model: "xiaomi/mimo-v2-flash:free",
      messages: messages as any,
      stream: true,
    } as any)) as any;

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        try {
          for await (const chunk of stream) {
            if (isClosed) break;

            const message = chunk.choices?.[0]?.delta?.content || "";
            if (message) {
              const sseData = `data: ${JSON.stringify({
                choices: [
                  {
                    delta: {
                      content: message,
                    },
                  },
                ],
              })}\n\n`;

              try {
                controller.enqueue(encoder.encode(sseData));
              } catch (e) {
                isClosed = true;
                break;
              }
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
          if (!isClosed) {
            controller.error(error);
          }
        } finally {
          if (!isClosed) {
            controller.close();
            isClosed = true;
          }
        }
      },
      cancel() {
        // User closed the connection
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 },
    );
  }
}
