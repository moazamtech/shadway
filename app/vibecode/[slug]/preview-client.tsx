"use client";

import React, { useMemo, useRef, useState } from "react";
import { SandpackRuntimePreview } from "@/components/sandpack-preview";
import { MetalButton } from "@/components/ui/MetalButton";
import { Badge } from "@/components/ui/badge";
import { VibecodeComponent } from "@/lib/types";
import { Check, Loader2, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";

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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied">(
    "idle",
  );
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <MetalButton
          variant="primary"
          onClick={() => setIsDarkTheme((prev) => !prev)}
          className="h-9 px-4 text-sm gap-2"
        >
          {isDarkTheme ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          Change Theme
        </MetalButton>
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
        <motion.div
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <MetalButton
            variant="primary"
            onClick={async () => {
              if (copyStatus === "copying") return;
              const codeToCopy =
                item.code ||
                (item.files && item.entryFile
                  ? item.files[item.entryFile]
                  : "");
              if (!codeToCopy) return;
              setCopyStatus("copying");
              try {
                await navigator.clipboard.writeText(codeToCopy);
                setCopyStatus("copied");
                if (resetTimerRef.current) {
                  clearTimeout(resetTimerRef.current);
                }
                resetTimerRef.current = setTimeout(() => {
                  setCopyStatus("idle");
                }, 1500);
              } catch (error) {
                console.error("Failed to copy code:", error);
                setCopyStatus("idle");
              }
            }}
            className="h-9 px-4 text-sm"
            aria-live="polite"
          >
            {copyStatus === "copying" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Copying
              </span>
            ) : copyStatus === "copied" ? (
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" />
                Copied
              </span>
            ) : (
              "Copy Code"
            )}
          </MetalButton>
        </motion.div>
      </div>
    </div>
  );
}
