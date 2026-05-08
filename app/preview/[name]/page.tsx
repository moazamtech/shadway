"use client";

import React from "react";
import { ComponentPreview } from "@/components/component-preview";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";

export default function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = React.use(params);
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const theme = searchParams.get("theme");
    if (theme) setTheme(theme);
  }, [searchParams, setTheme]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "UPDATE_THEME") setTheme(event.data.theme);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setTheme]);

  // Report natural height to parent so the iframe container sizes itself correctly
  React.useEffect(() => {
    const reportHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "PREVIEW_HEIGHT", height }, "*");
    };

    reportHeight();

    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full bg-background">
      <ComponentPreview name={name} />
    </div>
  );
}
