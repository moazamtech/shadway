"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Sandpack = dynamic(() => import("@codesandbox/sandpack-react").then((m) => m.Sandpack), {
  ssr: false,
  loading: () => (
    <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
      Loading preview...
    </div>
  ),
});

export function ComponentSandpackPreview({
  code,
  title,
  dependencies = [],
}: {
  code: string;
  title: string;
  dependencies?: string[];
}) {
  const dependencyMap = dependencies.reduce<Record<string, string>>((acc, dep) => {
    const name = dep.split("@")[0]?.trim();
    if (name) acc[name] = "latest";
    return acc;
  }, {});
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="overflow-hidden rounded-lg border bg-background">
      {visible ? (
        <Sandpack
          template="react-ts"
          customSetup={{
            dependencies: {
              "lucide-react": "0.544.0",
              ...dependencyMap,
            },
          }}
          options={{
            showTabs: false,
            showLineNumbers: false,
            externalResources: ["https://cdn.tailwindcss.com"],
            editorHeight: 0,
            previewHeight: 180,
            showConsole: false,
          }}
          files={{
            "/App.tsx": code,
          }}
          theme="dark"
        />
      ) : (
        <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
          {title} preview will load when visible
        </div>
      )}
    </div>
  );
}
