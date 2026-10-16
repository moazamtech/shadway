import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

/**
 * The blocks the sandbox can insert — every `registry:block` item the repo
 * ships statically. The studio's Blocks panel reads this; the contents come
 * straight from the registry JSON, so the marketplace page, the CLI and the
 * sandbox can never drift apart.
 */

type RegistryItemJson = {
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  files?: { path?: string; content?: string; type?: string }[];
  dependencies?: string[];
  registryDependencies?: string[];
};

type StudioBlock = {
  name: string;
  title: string;
  description: string;
  category: string;
  /** Primary exported component, e.g. `Hero`. */
  component: string;
  /** Project paths, ready to write into the workspace. */
  files: { path: string; content: string }[];
  /** The demo page that renders the block. */
  demo: string;
};

function registryDir(): string {
  return path.join(process.cwd(), "registry");
}

function firstExport(content: string): string | null {
  const patterns = [
    /export\s+default\s+(?:function\s+)?([A-Za-z0-9_$]+)/,
    /export\s+function\s+([A-Za-z0-9_$]+)/,
    /export\s+const\s+([A-Za-z0-9_$]+)/,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function blockProjectPath(name: string): string {
  return `/components/blocks/${name}.tsx`;
}

export async function GET() {
  try {
    const dir = registryDir();
    const index = JSON.parse(
      await fs.readFile(path.join(dir, "registry.json"), "utf8")
    ) as { items?: { name?: string; type?: string; category?: string }[] };

    const items = (index.items ?? []).filter(
      (item) => item.type === "registry:block" && item.name
    );

    const blocks: StudioBlock[] = [];
    for (const item of items) {
      const name = item.name as string;
      try {
        const raw = JSON.parse(
          await fs.readFile(path.join(dir, `${name}.json`), "utf8")
        ) as RegistryItemJson;

        const sources = (raw.files ?? []).filter(
          (file) => file.content && typeof file.path === "string"
        );
        if (!sources.length) continue;

        // A block ships two kinds of files: the block itself and (sometimes)
        // the pieces it uses. Everything hangs off /components/blocks/, so
        // block code can never collide with the author's own components.
        const files = sources.map((file, position) => {
          if (position === 0) {
            return { path: blockProjectPath(name), content: file.content as string };
          }
          const base = (file.path as string).split("/").pop();
          return {
            path: `/components/blocks/${name}/${base}`,
            content: file.content as string,
          };
        });

        const component = firstExport(files[0].content) ?? name;
        blocks.push({
          name,
          title: raw.title || name,
          description: raw.description || "",
          category: raw.category || item.category || "block",
          component,
          files,
          demo: `import { ${component} } from "@/components/blocks/${name}";\n\nexport default function Page() {\n  return (\n    <main className="min-h-screen w-full bg-background">\n      <${component} />\n    </main>\n  );\n}\n`,
        });
      } catch {
        // A malformed block JSON is skipped, not fatal.
      }
    }

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("Failed to load studio blocks:", error);
    return NextResponse.json({ blocks: [] }, { status: 200 });
  }
}
