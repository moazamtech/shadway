export const BASE_SANDBOX_DEPENDENCIES: Record<string, string> = {
  react: "latest",
  "react-dom": "latest",
  "react-is": "latest",
  "prop-types": "latest",
  clsx: "latest",
  "class-variance-authority": "latest",
  "tailwind-merge": "latest",
  tailwindcss: "^4.0.0",
  "@tailwindcss/vite": "^4.0.0",
  vite: "^5.4.0",
  "@vitejs/plugin-react": "^4.3.0",
  "@radix-ui/react-slot": "latest",
  "@radix-ui/react-separator": "latest",
  "@radix-ui/react-avatar": "latest",
  "@radix-ui/react-label": "latest",
  "@radix-ui/react-switch": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-checkbox": "latest",
  "@radix-ui/react-slider": "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-select": "latest",
  "react-router-dom": "^7.8.2",
  axios: "^1.12.2",
  zustand: "^5.0.8",
  "@tanstack/react-query": "^5.87.4",
  "react-hook-form": "^7.65.0",
  zod: "^3.25.76",
  "lucide-react": "^0.544.0",
  "framer-motion": "^12.23.16",
  motion: "^12.23.24",
  recharts: "^2.15.4",
  d3: "^7.9.0",
};

function normalizePackageName(specifier: string) {
  if (!specifier) return null;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@/")) return null;

  const cleaned = specifier.replace(/^node:/, "");
  const parts = cleaned.split("/");

  if (cleaned.startsWith("@")) {
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    return cleaned;
  }

  return parts[0];
}

function extractPackageJsonDependencies(source: string) {
  try {
    const parsed = JSON.parse(source) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return {
      ...(parsed.dependencies || {}),
      ...(parsed.devDependencies || {}),
    };
  } catch {
    return {};
  }
}

export function extractPackageDependencies(
  sources: Array<string | undefined | null>,
  baseDeps: Record<string, string> = BASE_SANDBOX_DEPENDENCIES,
) {
  const importRegex =
    /import\s+(?:[^"']+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
  const deps: Record<string, string> = {};

  for (const src of sources) {
    if (!src) continue;

    const packageJsonDeps = extractPackageJsonDependencies(src);
    for (const [name, version] of Object.entries(packageJsonDeps)) {
      if (baseDeps[name]) continue;
      deps[name] = version || "latest";
    }

    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(src)) !== null) {
      const spec = match[1] || match[2];
      const name = normalizePackageName(spec);
      if (!name || baseDeps[name]) continue;
      if (!deps[name]) deps[name] = "latest";
    }
  }

  return deps;
}

export function listAddedPackages(
  sources: Array<string | undefined | null>,
  baseDeps: Record<string, string> = BASE_SANDBOX_DEPENDENCIES,
) {
  return Object.keys(extractPackageDependencies(sources, baseDeps)).sort();
}
