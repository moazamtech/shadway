import { cn } from "@/lib/utils";
import { RefreshCcw, ArrowRight } from "lucide-react";

export type Suggestion = {
  emoji: string;
  title: string;
  prompt: string;
};

export function SuggestionsGrid({
  suggestions,
  onPick,
  onRefresh,
  isRefreshing,
  className,
}: {
  suggestions: Suggestion[];
  onPick: (prompt: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-6 space-y-4 w-full", className)}>
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
          <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/50">
            Design Templates
          </h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40 bg-muted/20 hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground",
            isRefreshing && "opacity-50 cursor-not-allowed"
          )}
          type="button"
        >
          <RefreshCcw className={cn(
            "h-2.5 w-2.5",
            isRefreshing && "animate-spin"
          )} />
          {isRefreshing ? "Architecting..." : "Refresh"}
        </button>
      </div>

      <div className={cn(
        "grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 w-full",
        isRefreshing && "opacity-40 pointer-events-none"
      )}>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onPick(suggestion.prompt)}
            className="group flex flex-col items-start p-3 rounded-xl border border-border/40 bg-background/30 hover:bg-background/80 hover:border-primary/20 text-left"
            type="button"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs grayscale group-hover:grayscale-0">{suggestion.emoji}</span>
              <h4 className="text-[10px] font-black uppercase tracking-tight text-foreground/70 group-hover:text-primary truncate">
                {suggestion.title}
              </h4>
            </div>
            <p className="text-[9px] text-muted-foreground/50 line-clamp-2 leading-snug font-medium lowercase">
              {suggestion.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
