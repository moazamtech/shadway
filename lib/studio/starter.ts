import type { PreviewFiles } from "@/lib/preview/files";

/**
 * The files a new component project starts from.
 *
 * Only the author's own files live here. The shadcn/ui folder is not part of
 * the project — `import { Button } from "@/components/ui/button"` resolves
 * against the registry files the preview injects, exactly like an installed
 * shadcn project, so the tree stays focused on what the author writes.
 */
export const DEFAULT_COMPONENT_CODE = `import { Button } from "@/components/ui/button";

export default function MyComponent() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center bg-background p-10">
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Your shadcn component</h2>
        <p className="text-sm text-muted-foreground">
          Every component in the shadcn/ui folder is already installed — import
          any of them and the preview resolves it.
        </p>
        <Button>Get started</Button>
      </div>
    </div>
  );
}
`;

export const DEFAULT_DEMO_CODE = `import MyComponent from "./components/component";

export default function App() {
  return <MyComponent />;
}
`;

export const DEFAULT_STYLE_CODE = `/* The preview already runs Tailwind v4 with the shadcn theme.
   Add project-specific styles here — they load after the theme. */
`;

export const STARTER_FILES: PreviewFiles = {
  "/src/components/component.tsx": DEFAULT_COMPONENT_CODE,
  "/src/App.tsx": DEFAULT_DEMO_CODE,
  "/src/index.css": DEFAULT_STYLE_CODE,
};

/** Copy so two drafts never share the same object. */
export function starterFiles(): PreviewFiles {
  return { ...STARTER_FILES };
}

export const DEFAULT_COMPONENT_PATH = "/src/components/component.tsx";
export const DEFAULT_DEMO_PATH = "/src/App.tsx";
