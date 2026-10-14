"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const SandpackProvider = dynamic(() => import("@codesandbox/sandpack-react").then((m) => m.SandpackProvider), {
  ssr: false,
});
const SandpackPreview = dynamic(() => import("@codesandbox/sandpack-react").then((m) => m.SandpackPreview), {
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
        <SandpackProvider
          template="react-ts"
          customSetup={{
            dependencies: {
              "lucide-react": "0.544.0",
              ...dependencyMap,
            },
          }}
          options={{
            externalResources: ["https://cdn.tailwindcss.com"],
          }}
          files={{
            "/App.tsx": code,
          }}
          theme="dark"
        >
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            showOpenNewtab={false}
            showRestartButton={false}
            style={{ minHeight: 180, height: 180 }}
          />
        </SandpackProvider>
      ) : (
        <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
          {title} preview will load when visible
        </div>
      )}
    </div>
  );
}
