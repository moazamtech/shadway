"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Terminal, Package } from "lucide-react";

const PREVIEW_REGISTRY: Record<string, React.ComponentType> = {
  "hero": dynamic(() => import("@/registry/hero/hero").then(m => ({ default: m.Hero }))),
  "contact": dynamic(() => import("@/registry/contact/contact").then(m => ({ default: m.Contact }))),
  "footer": dynamic(() => import("@/registry/footer/footer").then(m => ({ default: m.Footer }))),
  "about": dynamic(() => import("@/registry/about/about").then(m => ({ default: m.About }))),
  "features-bento": dynamic(() => import("@/registry/features-bento/features-bento").then(m => ({ default: m.FeaturesBento }))),
  "cta-particles": dynamic(() => import("@/registry/cta-particles/cta-particles").then(m => ({ default: m.CtaParticles }))),
};

interface ComponentPreviewProps {
  name: string;
}

export function ComponentPreview({ name }: ComponentPreviewProps) {
  const PreviewComponent = PREVIEW_REGISTRY[name.toLowerCase()];

  if (!PreviewComponent) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 border-2 border-dashed rounded-xl bg-muted/30">
        <Package className="w-10 h-10 text-muted-foreground/40" />
        <div>
          <h3 className="text-lg font-semibold">No Native Preview Available</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            A native demo hasn't been implemented for "{name}" yet. 
            Check the code tab for implementation details.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-background border rounded-full text-[10px] font-mono shadow-sm">
          <Terminal className="w-3 h-3" />
          registry:{name}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PreviewComponent />
    </div>
  );
}
