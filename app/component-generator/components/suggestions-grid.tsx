"use client";

import React from "react";
import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Suggestion = {
  emoji: string;
  title: string;
  prompt: string;
};

export function SuggestionsGrid({
  suggestions,
  onPick,
  onRefresh,
  className,
}: {
  suggestions: Suggestion[];
  onPick: (prompt: string) => void;
  onRefresh: () => void;
  className?: string;
}) {
  return (
    <div className={cn("mt-8 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Try these examples
        </h3>
        <button
          onClick={onRefresh}
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          type="button"
        >
          <SparklesIcon className="h-3 w-3" />
          Refresh
        </button>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onPick(suggestion.prompt)}
            className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30"
            type="button"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {suggestion.emoji}
                </div>
                <div className="text-sm font-semibold leading-tight">
                  {suggestion.title}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                {suggestion.prompt}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
