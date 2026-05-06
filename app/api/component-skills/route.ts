import { readFile } from "fs/promises";
import { join } from "path";

const SKILLS_DIR = join(process.cwd(), "skills");

interface SkillMeta {
  name: string;
  description: string;
  folder: string;
}

const CODE_SKILLS_ONLY = [
  "taste-skill",
  "gpt-tasteskill",
  "minimalist-skill",
  "soft-skill",
  "brutalist-skill",
  "stitch-skill",
  "redesign-skill",
  "output-skill",
];

const IMAGE_GEN_SKILLS = new Set([
  "imagegen-frontend-web",
  "imagegen-frontend-mobile",
  "brandkit",
  "image-to-code-skill",
]);

const KEYWORD_MAP: Record<string, string[]> = {
  "taste-skill": [
    "premium",
    "clean",
    "modern",
    "professional",
    "elegant",
    "tasteful",
    "refined",
    "polished",
    "high-end",
    "landing page",
    "website",
    "dashboard",
    "saas",
    "component",
  ],
  "gpt-tasteskill": [
    "awwwards",
    "animation",
    "gsap",
    "scroll",
    "cinematic",
    "award",
    "motion",
    "parallax",
    "interactive",
    "wow",
  ],
  "minimalist-skill": [
    "minimal",
    "minimalist",
    "notion",
    "linear",
    "editorial",
    "monochrome",
    "simple",
    "zen",
    "clean",
  ],
  "soft-skill": [
    "soft",
    "luxury",
    "expensive",
    "depth",
    "glass",
    "glassmorphism",
    "ambient",
    "ethereal",
    "velvet",
    "smooth",
  ],
  "brutalist-skill": [
    "brutal",
    "brutalist",
    "industrial",
    "raw",
    "swiss",
    "terminal",
    "tactical",
    "mechanical",
    "harsh",
  ],
  "stitch-skill": ["stitch", "google stitch", "semantic design"],
  "redesign-skill": [
    "redesign",
    "improve",
    "upgrade",
    "fix",
    "audit",
    "refresh",
    "overhaul",
    "modernize",
    "update",
    "change",
  ],
};

const SANDBOX_OVERRIDE = `
---

## CRITICAL SANDBOX CODE RULES (OVERRIDES ANY SKILL CONFLICTS):

1. **NEVER generate images.** You do NOT have image generation capabilities. Do NOT attempt to create, render, or output any image files. You can ONLY write code (React/TSX/CSS).

2. **IMAGES IN CODE:** For any images needed in your UI code, use ONLY these URL patterns:
   - Hero/background images: https://images.unsplash.com/photo-{id}?w=1920&q=80
   - Avatars: https://i.pravatar.cc/200?img={1-70}
   - Generic placeholders: https://picsum.photos/seed/{keyword}/{width}/{height}
   Do NOT use any other image sources.

3. **OUTPUT FORMAT:** You MUST output code using the <files> XML format only. Your entire response must be conversational text followed by <files> blocks. No image outputs, no markdown image blocks, no DALL-E calls.

4. **YOUR CAPABILITIES:** You are a code-generation AI in a Sandpack sandbox. You write React + TypeScript + Tailwind CSS code. That is ALL you do. You do NOT generate images, create mockups, or produce visual assets.

5. **WHEN A USER ASKS FOR IMAGES/DESIGNS:** Convert their request into CODE. If they want a "design mockup", build it as a live React component. If they want a "brand kit", build a React component that DISPLAYS brand elements. Always respond with runnable code.
`;

function selectSkills(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [skill, keywords] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > 0) scores[skill] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const selected: string[] = [];

  for (const [skill] of sorted.slice(0, 2)) {
    selected.push(skill);
  }

  if (selected.length === 0) {
    selected.push("taste-skill");
  }

  if (!selected.includes("output-skill")) {
    selected.push("output-skill");
  }

  return selected;
}

function sanitizeSkillContent(content: string): string {
  let clean = content;

  clean = clean.replace(
    /generate[^.]*image[^.]*\./gi,
    "Use https://picsum.photos/seed/{keyword}/{width}/{height} for placeholder images in code.",
  );

  return clean;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const selectedNames = selectSkills(prompt);
    const skills: SkillMeta[] = [];
    const contentParts: string[] = [];

    for (const folder of selectedNames) {
      if (IMAGE_GEN_SKILLS.has(folder)) continue;
      if (!CODE_SKILLS_ONLY.includes(folder)) continue;

      const skillPath = join(SKILLS_DIR, folder, "SKILL.md");
      try {
        const rawContent = await readFile(skillPath, "utf-8");
        const content = sanitizeSkillContent(rawContent);
        const nameMatch = content.match(/^---\nname:\s*(.+)$/m);
        const descMatch = content.match(
          /^---[\s\S]*?description:\s*(.+)$/m,
        );

        const name = nameMatch?.[1]?.trim() || folder;
        const desc = descMatch?.[1]?.trim() || "";

        skills.push({ name, description: desc, folder });
        contentParts.push(content);
      } catch {
        // skip missing skill files
      }
    }

    contentParts.push(SANDBOX_OVERRIDE);

    return Response.json({
      selected: selectedNames.filter(
        (s) => !IMAGE_GEN_SKILLS.has(s),
      ),
      skills,
      combinedPrompt: contentParts.join("\n\n---\n\n"),
    });
  } catch (error) {
    console.error("Skills selection error:", error);
    return Response.json(
      { error: "Failed to select skills" },
      { status: 500 },
    );
  }
}
