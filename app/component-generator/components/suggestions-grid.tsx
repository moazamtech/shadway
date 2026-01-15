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
    <div className={cn("mt-10 space-y-6 w-full", className)}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-foreground/40">
            Inspire your next vision
          </h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "group w-full sm:w-auto text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 px-4 py-2 rounded-xl border",
            isRefreshing
              ? "bg-primary/10 text-primary border-primary/20 opacity-70"
              : "text-muted-foreground hover:text-primary bg-muted/20 hover:bg-primary/5 border-border/40"
          )}
          type="button"
        >
          <RefreshCcw className={cn(
            "h-3 w-3 transition-transform duration-500",
            isRefreshing ? "animate-spin" : "group-hover:rotate-180"
          )} />
          {isRefreshing ? "Generating..." : "Refresh Ideas"}
        </button>
      </div>
      <div className={cn(
        "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full transition-opacity duration-300",
        isRefreshing && "opacity-40 pointer-events-none"
      )}>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onPick(suggestion.prompt)}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/40 backdrop-blur-sm p-4 sm:p-5 text-left transition-all duration-300 hover:bg-background/60 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98]"
            type="button"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>

            <div className="relative z-10 flex flex-col h-full uppercase">
              <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-lg mb-4 group-hover:bg-primary/10 transition-colors">
                {suggestion.emoji}
              </div>
              <h4 className="text-xs md:text-sm font-black text-foreground mb-2 group-hover:text-primary transition-colors tracking-tight">
                {suggestion.title}
              </h4>
              <p className="text-[10px] md:text-[11px] text-muted-foreground/70 line-clamp-3 leading-relaxed font-medium lowercase">
                {suggestion.prompt}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
