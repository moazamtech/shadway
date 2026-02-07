import { Navbar } from "@/components/navbar";
import { TextHoverEffect } from "@/components/site-components/text-hover-effect";

export default function VibecodeSlugLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 left-2 w-[2px] bg-border/40" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 right-2 w-[2px] bg-border/40" />

        <main className="pt-28 pb-20 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto space-y-10 animate-pulse">
            <div className="h-9 w-44 rounded-full bg-muted" />
            <div className="space-y-4">
              <div className="h-3 w-40 rounded bg-muted" />
              <div className="h-12 w-full max-w-3xl rounded bg-muted" />
              <div className="h-5 w-full max-w-2xl rounded bg-muted" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 h-[420px] rounded-xl bg-muted" />
              <div className="lg:col-span-4 space-y-4">
                <div className="h-12 rounded bg-muted" />
                <div className="h-12 rounded bg-muted" />
                <div className="h-28 rounded bg-muted" />
              </div>
            </div>
          </div>
        </main>

        <div className="flex flex-col">
          <div className="w-full border-b border-dashed border-border" />
          <div className="w-full h-4 bg-[image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)] opacity-20" />
          <div className="w-full border-b border-dashed border-border" />
        </div>
        <div className="items-center justify-start mx-auto max-w-[1300px] overflow-x-hidden">
          <TextHoverEffect text="SHADWAY" />
        </div>
      </div>
    </div>
  );
}
