import { cn } from "@/lib/utils";
import type React from "react";
import {
  BarChart3,
  Component as ComponentIcon,
  CreditCard,
  LayoutTemplate,
  Mail,
  MessageSquareQuote,
  Navigation,
  PanelsTopLeft,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type Suggestion = {
  icon?: string;
  title: string;
  prompt: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  layout: LayoutTemplate,
  landing: PanelsTopLeft,
  component: ComponentIcon,
  pricing: CreditCard,
  auth: ShieldCheck,
  stats: BarChart3,
  testimonials: MessageSquareQuote,
  nav: Navigation,
  contact: Mail,
};

function SuggestionIcon({ name }: { name?: string }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />;
}

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
    <div className={cn("w-full max-w-[860px] mx-auto", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
          Fresh Prompts
        </span>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground/60 hover:text-foreground hover:border-foreground/20 transition-colors",
            isRefreshing && "opacity-50 cursor-not-allowed",
          )}
          type="button"
          aria-label="Refresh suggestions"
        >
          <RefreshCcw
            className={cn("h-3 w-3", isRefreshing && "animate-spin")}
          />
          {isRefreshing ? "..." : "Refresh"}
        </button>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
          isRefreshing && "opacity-50 pointer-events-none",
        )}
      >
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.title}-${index}`}
            onClick={() => onPick(suggestion.prompt)}
            className="group relative overflow-hidden border border-border/60 bg-background/80 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/20 active:scale-[0.99]"
            type="button"
          >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/30">
                <SuggestionIcon name={suggestion.icon} />
              </div>
              <span className="text-xs font-semibold leading-tight text-foreground/90">
                {suggestion.title}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground/60 line-clamp-3">
              {suggestion.prompt}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
