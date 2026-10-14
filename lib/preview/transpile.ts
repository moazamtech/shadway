// @ts-expect-error - @babel/core ships no bundled types in this setup.
import { transformAsync } from "@babel/core";

export type PreviewFile = { path: string; content: string };
export type TranspiledModule = { path: string; code: string; isStyle: boolean };

export type TranspileResult = {
  modules: TranspiledModule[];
  entry: string;
  css: string[];
  externalPackages: string[];
};

const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json"];
const CSS_EXTENSIONS = [".css"];

const REACT_IMPORT_MAP = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/client",
]);

function normalize(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function baseName(path: string): string {
  const name = path.split("/").pop() || "";
  return name.replace(/\.(tsx|ts|jsx|js)$/, "");
}

/** Turn `@/lib/utils` or `./utils` into a concrete `/src/lib/utils.tsx` path. */
function resolveLocalPath(
  specifier: string,
  fromPath: string,
  files: string[]
): string | null {
  const candidates: string[] = [];

  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    candidates.push(normalize(`/src/${rest}`));
  } else if (specifier.startsWith(".")) {
    const fromDir = normalize(fromPath).split("/").slice(0, -1).join("/");
    const stack = [fromDir];
    const segments = specifier.split("/");
    for (const segment of segments) {
      if (segment === "." || segment === "") continue;
      if (segment === "..") {
        stack.pop();
        continue;
      }
      stack.push(segment);
    }
    candidates.push(normalize(stack.join("/")));
  } else {
    return null;
  }

  for (const candidate of candidates) {
    if (files.includes(candidate)) return candidate;

    for (const ext of EXTENSIONS) {
      if (files.includes(`${candidate}${ext}`)) return `${candidate}${ext}`;
    }
    for (const ext of EXTENSIONS) {
      if (files.includes(`${candidate}/index${ext}`)) return `${candidate}/index${ext}`;
    }
    // "./utils" -> "./utils.tsx" style import without extension already handled.
    const dirMatches = files.filter((file) =>
      file.startsWith(`${candidate}/`) && CSS_EXTENSIONS.some((ext) => file.endsWith(ext))
    );
    if (dirMatches.length) return dirMatches[0];
  }

  return null;
}

function extnameOf(path: string): string {
  const match = path.match(/\.(tsx|ts|jsx|js)$/);
  return match ? `.${match[1]}` : ".tsx";
}

function toEsmUrl(specifier: string): string {
  const [scopeOrName, scopedTail] = specifier.split("/");
  const pkg = specifier.startsWith("@")
    ? `${scopeOrName}/${scopedTail.split("/")[0]}`
    : scopeOrName;

  const rest = specifier.slice(pkg.length).replace(/^\//, "");
  const suffix = rest ? `/${rest}` : "";
  return `https://esm.sh/${pkg}${suffix}?external=react,react-dom`;
}

const IMPORT_RE =
  /(\bimport\s+(?:[\s\S]*?\sfrom\s*)?|\bexport\s+(?:[\s\S]*?\sfrom\s*)|\bimport\s*\(\s*)(["'])([^"']+)\2/g;

export async function transpilePreview(
  files: PreviewFile[],
  entry: string
): Promise<TranspileResult> {
  const pathList = files.map((file) => normalize(file.path));
  const externalPackages = new Set<string>();

  const resolved: TranspiledModule[] = [];

  for (const file of files) {
    const filePath = normalize(file.path);

    if (CSS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      resolved.push({ path: filePath, code: file.content, isStyle: true });
      continue;
    }

    const code = file.content
      // Drop shadcn CLI style path aliases that we cannot resolve before rewriting.
      .replace(/\/\*\s*eslint-disable[^*]*\*\/\s*/g, "");

    const rewritten = code.replace(IMPORT_RE, (match, prefix, quote, specifier) => {
      const bare = specifier.trim();

      if (bare.startsWith("@vfs/")) return match;

      const local = resolveLocalPath(bare, filePath, pathList);
      if (local) {
        return `${prefix}${quote}@vfs${local}${quote}`;
      }

      if (REACT_IMPORT_MAP.has(bare)) {
        return `${prefix}${quote}${bare}${quote}`;
      }

      externalPackages.add(bare.split("/")[0].startsWith("@") ? bare.split("/").slice(0, 2).join("/") : bare.split("/")[0]);
      return `${prefix}${quote}${toEsmUrl(bare)}${quote}`;
    });

    const result = await transformAsync(rewritten, {
      // Babel only uses the filename for language/syntax heuristics, so keep it
      // relative and POSIX-free to stay valid on every platform.
      filename: `shadway-preview${extnameOf(filePath)}`,
      cwd: process.cwd(),
      root: process.cwd(),
      babelrc: false,
      configFile: false,
      sourceFileName: filePath,
      sourceMaps: false,
      compact: false,
      presets: [
        ["@babel/preset-typescript", { isTSX: true, allExtensions: true, onlyRemoveTypeImports: true }],
        ["@babel/preset-react", { runtime: "automatic" }],
      ],
    });

    resolved.push({
      path: filePath,
      code: result?.code ?? rewritten,
      isStyle: false,
    });
  }

  const css = resolved.filter((m) => m.isStyle).map((m) => m.code);
  const codeModules = resolved.filter((m) => !m.isStyle);

  const entryPath = normalize(entry);

  return {
    modules: codeModules,
    entry: entryPath,
    css,
    externalPackages: Array.from(externalPackages),
  };
}

/**
 * Build a dependency-ordered plan so blob URLs can be created safely.
 * Circular imports fall back to the original specifier order.
 */
export function orderModules(modules: TranspiledModule[]): TranspiledModule[] {
  const byPath = new Map(modules.map((module) => [module.path, module]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: TranspiledModule[] = [];

  const visit = (module: TranspiledModule) => {
    if (visited.has(module.path)) return;
    if (visiting.has(module.path)) return;
    visiting.add(module.path);

    for (const match of module.code.matchAll(IMPORT_RE)) {
      const specifier = match[3];
      if (!specifier?.startsWith("@vfs/")) continue;
      const dep = byPath.get(specifier.slice(4));
      if (dep) visit(dep);
    }

    visiting.delete(module.path);
    visited.add(module.path);
    ordered.push(module);
  };

  modules.forEach(visit);
  return ordered;
}

export const previewEntryFor = (files: PreviewFile[]): string => {
  const has = (p: string) => files.some((f) => normalize(f.path) === p);
  if (has("/src/App.tsx")) return "/src/App.tsx";
  if (has("/App.tsx")) return "/App.tsx";
  const first = files.find((f) => f.path.endsWith(".tsx"));
  return first ? normalize(first.path) : "/src/index.tsx";
};

export { baseName };