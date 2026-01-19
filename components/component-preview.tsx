"use client";

import React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Terminal, Package } from "lucide-react";
import { Hero } from "@/components/blocks/hero";
import { Contact } from "@/components/blocks/contact";
import { Footer } from "@/components/blocks/footer";
import { About } from "@/components/blocks/about";

// This is a registry of "Demo" components that will be shown in the preview tab.
// Each key matches a component "name" in the registry.json
const PREVIEW_REGISTRY: Record<string, React.ComponentType> = {
  "alert": () => (
    <div className="w-full max-w-xl mx-auto">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          This is a native preview of the Alert component. It's incredibly fast.
        </AlertDescription>
      </Alert>
    </div>
  ),
  "button": () => (
    <div className="flex flex-wrap items-center justify-center gap-4 py-8">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
  "hero": Hero,
  "contact": Contact,
  "footer": Footer,
  "about": About,
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
    <div className="relative w-full min-h-[300px] flex items-center justify-center p-6 md:p-12 bg-background/50 rounded-xl border-dashed border-2">
      <PreviewComponent />
      <div className="absolute bottom-4 right-4 text-[10px] font-mono text-muted-foreground opacity-50 uppercase tracking-widest">
        Native Preview
      </div>
    </div>
  );
}
