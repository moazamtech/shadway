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
    <div className={cn("mt-2 space-y-3 w-full max-w-4xl mx-auto px-4", className)}>
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            Design Templates
          </h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/40 bg-muted/10 hover:bg-primary/5 text-muted-foreground/60 hover:text-primary transition-all duration-300 hover:border-primary/20",
            isRefreshing && "opacity-50 cursor-not-allowed"
          )}
          type="button"
        >
          <RefreshCcw className={cn(
            "h-2.5 w-2.5",
            isRefreshing && "animate-spin"
          )} />
          {isRefreshing ? "Syncing..." : "Refresh"}
        </button>
      </div>

      <div className={cn(
        "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full",
        isRefreshing && "opacity-40 pointer-events-none"
      )}>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onPick(suggestion.prompt)}
            className="group flex flex-col items-start p-4 rounded-2xl border border-border/40 bg-muted/5 hover:bg-muted/10 hover:border-primary/30 text-left transition-all duration-300 relative overflow-hidden active:scale-[0.98]"
            type="button"
          >
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex items-center gap-2.5 mb-2.5 relative z-10">
              <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center border border-border/40 group-hover:border-primary/30 transition-colors shadow-sm">
                <span className="text-sm grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110">{suggestion.emoji}</span>
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-tight text-foreground/80 group-hover:text-primary transition-colors">
                {suggestion.title}
              </h4>
            </div>
            <p className="text-[10px] text-muted-foreground/50 line-clamp-2 leading-relaxed font-medium lowercase relative z-10 transition-colors group-hover:text-muted-foreground/70">
              {suggestion.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
