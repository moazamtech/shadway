// @ts-expect-error - @babel/core ships no bundled types in this setup.
import { transformAsync } from "@babel/core";

export type PreviewFile = { path: string; content: string };
export type TranspiledModule = { path: string; code: string; isStyle: boolean };

/** An `@/...` import that points at nothing in the project. */
export type UnresolvedImport = { specifier: string; from: string };

/** A file that failed to compile, reported the way a dev server reports it. */
export type BuildError = {
  file: string;
  message: string;
  line?: number;
  column?: number;
  frame?: string;
};

export type TranspileResult = {
  modules: TranspiledModule[];
  entry: string;
  css: string[];
  externalPackages: string[];
  unresolved: UnresolvedImport[];
  errors: BuildError[];
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

/** How a path reads in an error message: `src/components/component.tsx`. */
function displayPath(path: string): string {
  return normalize(path).replace(/^\//, "");
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

    // Alias drift: projects (and pasted code) move between a `ui/` folder and
    // `components/` — try the sibling spelling before giving up.
    if (rest.startsWith("components/ui/")) {
      candidates.push(normalize(`/src/components/${rest.slice("components/ui/".length)}`));
    } else if (rest.startsWith("components/")) {
      candidates.push(normalize(`/src/components/ui/${rest.slice("components/".length)}`));
    } else if (rest.startsWith("ui/")) {
      candidates.push(normalize(`/src/components/ui/${rest.slice("ui/".length)}`));
    }
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

  // Last resort for aliases: match the file by name inside the folders a
  // component project actually uses, so `@/components/ui/component` still
  // finds `src/components/component.tsx`.
  if (specifier.startsWith("@/")) {
    const name = specifier.split("/").pop()?.replace(/\.(tsx?|jsx?)$/, "");
    if (name) {
      for (const dir of ["components", "components/ui", "ui", "hooks", "lib"]) {
        for (const ext of EXTENSIONS) {
          const candidate = `/src/${dir}/${name}${ext}`;
          if (files.includes(candidate)) return candidate;
        }
      }
    }
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

/** The few lines around a failing line, the way a dev server shows them. */
function codeFrame(source: string, line?: number): string | undefined {
  if (!line) return undefined;
  const lines = source.split("\n");
  const start = Math.max(0, line - 3);
  const end = Math.min(lines.length, line + 2);
  const width = String(end).length;
  const out: string[] = [];
  for (let index = start; index < end; index += 1) {
    const marker = index === line - 1 ? ">" : " ";
    out.push(`${marker} ${String(index + 1).padStart(width)}| ${lines[index]}`);
  }
  return out.join("\n");
}

/** Turns whatever Babel threw into the shape the error overlay renders. */
function toBuildError(error: unknown, filePath: string, source: string): BuildError {
  const shaped = error as { message?: string; loc?: { line?: number; column?: number } };
  const message = String(shaped?.message ?? error)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/shadway-preview\.(tsx|ts|jsx|js)/g, displayPath(filePath));
  const line = shaped?.loc?.line;
  const column = shaped?.loc?.column;

  return {
    file: displayPath(filePath),
    message,
    line,
    column,
    frame: codeFrame(source, line),
  };
}

export async function transpilePreview(
  files: PreviewFile[],
  entry: string
): Promise<TranspileResult> {
  const pathList = files.map((file) => normalize(file.path));
  const externalPackages = new Set<string>();
  const unresolved: UnresolvedImport[] = [];
  const errors: BuildError[] = [];
  const unresolvedSeen = new Set<string>();

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

      // An alias that points at nothing is a missing file, not a package.
      // Report it the way a dev server does instead of leaving a specifier
      // the browser cannot resolve.
      if (bare.startsWith("@/")) {
        const key = `${bare}::${filePath}`;
        if (!unresolvedSeen.has(key)) {
          unresolvedSeen.add(key);
          unresolved.push({ specifier: bare, from: displayPath(filePath) });
        }
        return match;
      }

      if (REACT_IMPORT_MAP.has(bare)) {
        return `${prefix}${quote}${bare}${quote}`;
      }

      externalPackages.add(bare.split("/")[0].startsWith("@") ? bare.split("/").slice(0, 2).join("/") : bare.split("/")[0]);
      return `${prefix}${quote}${toEsmUrl(bare)}${quote}`;
    });

    try {
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
    } catch (error) {
      errors.push(toBuildError(error, filePath, file.content));
    }
  }

  const css = resolved.filter((m) => m.isStyle).map((m) => m.code);
  const codeModules = resolved.filter((m) => !m.isStyle);

  const entryPath = normalize(entry);

  return {
    modules: codeModules,
    entry: entryPath,
    css,
    externalPackages: Array.from(externalPackages),
    unresolved,
    errors,
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