"use client";

import React from "react";
import { ComponentPreview } from "@/components/component-preview";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = React.use(params);
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();

  // Handle initial theme from query param
  React.useEffect(() => {
    const theme = searchParams.get("theme");
    if (theme) {
      setTheme(theme);
    }
  }, [searchParams, setTheme]);

  // Handle theme updates from parent window
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: ensure message is from same origin (optional, but good practice)
      // For now, we trust the parent as it's the same domain
      if (event.data?.type === "UPDATE_THEME") {
        setTheme(event.data.theme);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setTheme]);

  const [isIframe, setIsIframe] = React.useState(false);

  React.useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  return (
    <div className="h-full w-full bg-background flex justify-center">
      <div className={cn(
        "transform-gpu origin-top",
        isIframe && "scale-75"
      )}>
        <ComponentPreview name={name} />
      </div>
    </div>
  );
}
