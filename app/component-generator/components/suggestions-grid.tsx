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
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-foreground">
      <Icon className="h-4 w-4" />
    </span>
  );
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
    <div className={cn("mt-4 w-full max-w-4xl mx-auto px-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground">
          Try a prompt
        </h3>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors",
            isRefreshing && "opacity-50 cursor-not-allowed",
          )}
          type="button"
          aria-label="Refresh suggestions"
        >
          <RefreshCcw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          {isRefreshing ? "Refreshing" : "Refresh"}
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
            className="group rounded-xl border border-border/60 bg-background p-4 text-left transition-colors hover:bg-muted/40 active:scale-[0.99]"
            type="button"
          >
            <div className="mb-2 flex items-center gap-2">
              <SuggestionIcon name={suggestion.icon} />
              <div className="text-sm font-semibold leading-tight">
                {suggestion.title}
              </div>
            </div>
            <div className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
              {suggestion.prompt}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
