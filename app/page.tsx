import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";
import Image from "next/image";
import { Website } from "@/lib/types";
import { WebsiteCards } from "@/components/website-cards";

async function getWebsites(): Promise<Website[]> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/websites`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch websites');
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching websites:', error);
    return [];
  }
}

export default async function Home() {
  // Get websites already sorted by sequence from API
  const featuredWebsites = await getWebsites();


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Website Cards Section */}
      <WebsiteCards websites={featuredWebsites} />

      {/* CTA Section */}
      <section className="relative bg-background overflow-x-hidden">
        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Left vertical line */}
            <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0"></div>
            {/* Right vertical line */}
            <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0"></div>

            <div className="self-stretch pt-[9px] overflow-hidden border-b border-border flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
              <div className="py-16 sm:py-20 md:py-24 lg:py-32 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full">
                <div className="w-full max-w-[800px] text-center space-y-8">
                  <h2 className="text-[32px] sm:text-[42px] md:text-[48px] lg:text-[56px] font-normal leading-[1.1] font-serif text-foreground">
                    Start Building Today
                  </h2>
                  <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto leading-relaxed font-medium">
                    Get inspired by these beautiful websites and start building your own amazing interfaces with Shadcn UI.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
                    <Button
                      size="lg"
                      className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-sm transition-all duration-200"
                    >
                      <Layers className="w-5 h-5 mr-2" />
                      Get Started
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 px-8 border-border/50 hover:bg-background/80 rounded-full transition-all duration-200"
                      asChild
                    >
                      <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">
                        View Documentation
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-background overflow-x-hidden">
        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Left vertical line */}
            <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0"></div>
            {/* Right vertical line */}
            <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0"></div>

            <div className="self-stretch pt-[9px] overflow-hidden flex flex-col justify-center items-start relative z-10 w-full">
              <div className="py-16 sm:py-20 md:py-24 px-2 sm:px-4 md:px-8 lg:px-12 w-full">
                {/* Top separator line */}
                <div className="w-full border-t border-dashed border-border/60 mb-16"></div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-16">
                  <div className="md:col-span-2">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                        <Layers className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <span className="font-bold text-2xl text-foreground">Shadway</span>
                    </div>
                    <p className="text-muted-foreground max-w-md leading-relaxed text-base">
                      The ultimate collection of Shadcn UI websites and components.
                      Discover, explore, and get inspired by beautiful interfaces.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-6 text-lg text-foreground">Resources</h3>
                    <div className="space-y-4">
                      <a href="https://ui.shadcn.com" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Documentation</a>
                      <a href="https://ui.shadcn.com/docs/components" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Components</a>
                      <a href="https://ui.shadcn.com/examples" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Examples</a>
                      <a href="https://ui.shadcn.com/themes" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Themes</a>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-6 text-lg text-foreground">Community</h3>
                    <div className="space-y-4">
                      <a href="https://github.com/shadcn-ui/ui" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">GitHub</a>
                      <a href="https://twitter.com/shadcn" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Twitter</a>
                      <a href="https://discord.gg/shadcn" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Discord</a>
                      <a href="https://github.com/shadcn-ui/ui/discussions" className="block text-muted-foreground hover:text-foreground transition-colors text-sm">Discussions</a>
                    </div>
                  </div>
                </div>

                {/* Bottom separator line */}
                <div className="w-full border-t border-dashed border-border/60 mt-16 pt-8">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">
                      Built with ❤️ using Shadcn UI components by Shadway.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}