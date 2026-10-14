export type PreviewFileInput = { path: string; content: string };
export type PreviewFiles = Record<string, string>;

/** Minimal shadcn runtime available to every preview: cn() + Button. */
export const SHADCN_UTILS = `export function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}
`;

export const SHADCN_BUTTON = `import { cn } from "@/lib/utils";

export function Button(props) {
  const { className = "", variant = "default", size = "default", ...rest } = props;
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };
  const sizes = { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-11 px-6", icon: "h-10 w-10" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant] || variants.default,
        sizes[size] || sizes.default,
        className,
      )}
      {...rest}
    />
  );
}
`;

/**
 * Accepts either a single component string (published component) or a full
 * file map (studio project) and returns a complete, previewable file set.
 */
export function buildPreviewFiles(input: string | PreviewFiles): PreviewFileInput[] {
  if (typeof input !== "string") {
    return Object.entries(input).map(([path, content]) => ({
      path: path.startsWith("/") ? path : `/${path}`,
      content,
    }));
  }

  const hasDefaultExport = /export\s+default/.test(input);

  const files: PreviewFileInput[] = [
    { path: "/src/index.css", content: ":root{--radius:.5rem}" },
    { path: "/src/lib/utils.ts", content: SHADCN_UTILS },
    { path: "/src/components/ui/button.tsx", content: SHADCN_BUTTON },
  ];

  if (hasDefaultExport) {
    files.push({ path: "/src/components/component.tsx", content: input });
    files.push({
      path: "/src/App.tsx",
      content: `import Component from "./components/component";\nexport default function App() {\n  return <Component />;\n}\n`,
    });
  } else {
    files.push({ path: "/src/components/component.tsx", content: input });
    files.push({
      path: "/src/App.tsx",
      content: `import Component from "./components/component";\nexport default function App() {\n  return <Component />;\n}\n`,
    });
  }

  return files;
}

/**
 * Builds the complete previewable file set for a stored component.
 * Always guarantees a runnable `/src/App.tsx` entry, uses the author's demo
 * when present, and appends any lib/hook support files.
 */
export function componentSourceFiles(component: {
  code: string;
  demoCode?: string;
  files?: { path: string; content: string }[];
}): PreviewFileInput[] {
  const base = buildPreviewFiles(component.code);

  if (component.demoCode?.trim()) {
    const demo: PreviewFileInput = {
      path: "/src/App.tsx",
      content: component.demoCode,
    };
    const existing = base.findIndex((file) => file.path === "/src/App.tsx");
    if (existing >= 0) base[existing] = demo;
    else base.push(demo);
  }

  for (const support of component.files ?? []) {
    if (!support?.content) continue;
    const path = support.path.startsWith("/") ? support.path : `/src/${support.path}`;
    if (base.some((file) => file.path === path)) continue;
    base.push({ path, content: support.content });
  }

  if (!base.some((file) => file.path === "/src/App.tsx")) {
    base.push({
      path: "/src/App.tsx",
      content: `import Component from "./components/component";\nexport default function App() {\n  return <Component />;\n}\n`,
    });
  }

  return base;
}