"use client";

import React, { useMemo, useState } from "react";
import { SandpackRuntimePreview } from "@/components/sandpack-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VibecodeComponent } from "@/lib/types";
import { Moon, Sun } from "lucide-react";

export type SerializedVibecodeComponent = Omit<
  VibecodeComponent,
  "_id" | "createdAt" | "updatedAt" | "publishedAt"
> & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
};

type PreviewClientProps = {
  item: SerializedVibecodeComponent;
};

export default function VibecodePreviewClient({ item }: PreviewClientProps) {
  const files = useMemo(() => item.files || {}, [item.files]);
  const entryFile = item.entryFile;
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {item.category && <Badge variant="secondary">{item.category}</Badge>}
          {item.tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsDarkTheme((prev) => !prev)}
          className="gap-2"
        >
          {isDarkTheme ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          Change Theme
        </Button>
      </div>

      <div className="relative h-[70vh] min-h-[500px] border rounded-2xl overflow-hidden bg-background">
        <div className="absolute inset-0 origin-top-left scale-[0.8] w-[125%] h-[125%]">
          <SandpackRuntimePreview
            code={item.code || ""}
            files={files}
            entryFile={entryFile}
            showConsole={false}
            isDarkTheme={isDarkTheme}
            className="absolute inset-0"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            const codeToCopy =
              item.code ||
              (item.files && item.entryFile ? item.files[item.entryFile] : "");
            if (codeToCopy) {
              navigator.clipboard.writeText(codeToCopy);
            }
          }}
        >
          Copy Code
        </Button>
      </div>
    </div>
  );
}
