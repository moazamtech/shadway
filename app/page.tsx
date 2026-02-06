import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto w-full max-w-7xl">
        {/* Continuous vertical rails — header to footer */}
        <div className="absolute inset-y-0 left-0 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 left-2 w-[2px] bg-border/40" />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 right-2 w-[2px] bg-border/40" />

        <LandingHeader />
        <LandingHero />
        <LandingFooter />
      </div>
    </div>
  );
}
