/**
 * Repairs for generated component source.
 *
 * LLM output is usually valid but occasionally broken in small, mechanical
 * ways: a JSX string prop split across lines, a component used without its
 * import, the same import listed twice. These passes fix those before the file
 * reaches the bundler, so the preview shows the design rather than a parse
 * error. Imports keep their `@/...` specifiers — the project resolves them.
 */

export function repairMultilineJsxAttributeStrings(src: string): string {
  const attrs = [
    "className",
    "title",
    "placeholder",
    "aria-label",
    "aria-description",
    "alt",
    "id",
    "htmlFor",
    "href",
    "src",
    "value",
    "name",
  ];

  const escapeRe = (value: string) =>
    value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const attrGroup = attrs.map(escapeRe).join("|");
  const re = new RegExp(`\\b(${attrGroup})\\s*=\\s*"([\\s\\S]*?)"`, "g");

  let out = src.replace(re, (_full, attrName, rawValue) => {
    const repaired = String(rawValue).replace(/\r?\n\s*/g, " ");
    return `${attrName}="${repaired}"`;
  });

  // Another common truncation: a closing tag missing its `>` at end of line.
  out = out.replace(/<\/([A-Za-z][A-Za-z0-9]*)\s*(?=\r?\n|$)/g, "</$1>");
  return out;
}

export function dedupeNamedImports(src: string): string {
  return src.replace(
    /import\s+(type\s+)?{\s*([^}]+)\s*}\s*from\s*["']([^"']+)["']\s*;?/g,
    (_full, typePrefix, names, from) => {
      const seen = new Set<string>();
      const deduped = String(names)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => {
          const key = part.replace(/\s+as\s+.+$/, "");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .join(", ");
      return `import ${typePrefix || ""}{ ${deduped} } from "${from}";`;
    }
  );
}

function hasIdentifierDeclaration(src: string, name: string): boolean {
  const patterns: RegExp[] = [
    new RegExp(String.raw`^\s*import\s+(?!type\b)[^;]*\b${name}\b[^;]*;?`, "m"),
    new RegExp(String.raw`^\s*const\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*let\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*var\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*function\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*class\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*export\s+function\s+${name}\b`, "m"),
    new RegExp(String.raw`^\s*export\s+class\s+${name}\b`, "m"),
  ];
  return patterns.some((pattern) => pattern.test(src));
}

function isJsxTagUsed(src: string, tagName: string): boolean {
  return new RegExp(String.raw`<${tagName}\b`, "m").test(src);
}

/** Adds the shadcn/ui import for a component the code renders but never imported. */
export function injectMissingImports(src: string): string {
  const neededShadcn: Array<{ tag: string; importLine: string }> = [
    { tag: "Input", importLine: `import { Input } from "@/components/ui/input";` },
    { tag: "Textarea", importLine: `import { Textarea } from "@/components/ui/textarea";` },
    { tag: "Separator", importLine: `import { Separator } from "@/components/ui/separator";` },
    { tag: "Badge", importLine: `import { Badge } from "@/components/ui/badge";` },
  ];

  const missingLines: string[] = [];

  for (const entry of neededShadcn) {
    if (isJsxTagUsed(src, entry.tag) && !hasIdentifierDeclaration(src, entry.tag)) {
      missingLines.push(entry.importLine);
    }
  }

  if (!missingLines.length) return src;

  const lines = src.split("\n");
  let insertAt = 0;
  if (lines[0]?.match(/^\s*["']use client["']\s*;?\s*$/)) {
    insertAt = 1;
    while (lines[insertAt] !== undefined && lines[insertAt].trim() === "") {
      insertAt += 1;
    }
  }

  lines.splice(insertAt, 0, ...missingLines);
  return lines.join("\n");
}

/**
 * The project owns the stylesheet (`app/globals.css`), so a component that
 * imports its own CSS would pull in a second copy — or miss the file entirely.
 */
export function stripStyleImports(src: string): string {
  return src.replace(/^\s*import\s+["'][^"']+\.css["']\s*;?\s*$/gm, "");
}

/** Everything a generated file needs before it hits disk. */
export function prepareGeneratedFile(src: string): string {
  let out = src;
  out = stripStyleImports(out);
  out = repairMultilineJsxAttributeStrings(out);
  out = injectMissingImports(out);
  out = dedupeNamedImports(out);
  return out;
}

/** `"/App.tsx"` -> `"@/App"`, the specifier the project resolves. */
export function projectImportSpecifier(path: string): string {
  const withoutSlash = path.replace(/^\/+/, "");
  const withoutExtension = withoutSlash.replace(/\.(tsx|ts|jsx|js)$/i, "");
  return `@/${withoutExtension}`;
}
