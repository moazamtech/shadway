"use client";

import React from "react";
import { ComponentPreview } from "@/components/component-preview";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";

export default function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = React.use(params);
  const searchParams = useSearchParams();
  const { setTheme } = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);

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

  // Report natural content height to parent. Measure the wrapper directly —
  // documentElement.scrollHeight is bounded by the iframe's viewport size, so it
  // can't shrink back once the iframe has been forced taller.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reportHeight = () => {
      const height = el.scrollHeight;
      window.parent.postMessage({ type: "PREVIEW_HEIGHT", height }, "*");
    };

    reportHeight();

    const resizeObs = new ResizeObserver(reportHeight);
    resizeObs.observe(el);

    const mutationObs = new MutationObserver(reportHeight);
    mutationObs.observe(el, { childList: true, subtree: true, attributes: true });

    return () => {
      resizeObs.disconnect();
      mutationObs.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} data-preview-root className="w-full bg-background">
      <ComponentPreview name={name} />
    </div>
  );
}
