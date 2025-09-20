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
      <section className="py-20">
        <div className="container max-w-4xl mx-auto px-4">
          <Card className="bg-primary text-primary-foreground border-0 overflow-hidden relative rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
            <CardContent className="relative p-12 md:p-16 text-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">Start Building Today</h2>
                <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto leading-relaxed">
                  Get inspired by these beautiful websites and start building your own amazing interfaces with Shadcn UI.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <Button size="lg" variant="secondary" className="px-8 py-4 text-lg">
                    <Layers className="w-5 h-5 mr-2" />
                    Get Started
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary px-8 py-4 text-lg"
                    asChild
                  >
                    <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">
                      View Documentation
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16 bg-muted/20">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Layers className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="font-bold text-2xl">Shadcn UI Hub</span>
              </div>
              <p className="text-muted-foreground max-w-md leading-relaxed">
                The ultimate collection of Shadcn UI components, websites, and tools.
                Discover, explore, and get inspired by beautiful interfaces.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-lg">Resources</h3>
              <div className="space-y-3">
                <a href="https://ui.shadcn.com" className="block text-muted-foreground hover:text-foreground transition-colors">Documentation</a>
                <a href="https://ui.shadcn.com/docs/components" className="block text-muted-foreground hover:text-foreground transition-colors">Components</a>
                <a href="https://ui.shadcn.com/examples" className="block text-muted-foreground hover:text-foreground transition-colors">Examples</a>
                <a href="https://ui.shadcn.com/themes" className="block text-muted-foreground hover:text-foreground transition-colors">Themes</a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-lg">Community</h3>
              <div className="space-y-3">
                <a href="https://github.com/shadcn-ui/ui" className="block text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
                <a href="https://twitter.com/shadcn" className="block text-muted-foreground hover:text-foreground transition-colors">Twitter</a>
                <a href="https://discord.gg/shadcn" className="block text-muted-foreground hover:text-foreground transition-colors">Discord</a>
                <a href="https://github.com/shadcn-ui/ui/discussions" className="block text-muted-foreground hover:text-foreground transition-colors">Discussions</a>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center">
            <p className="text-muted-foreground">
              Built with ❤️ using Shadcn UI components. Not affiliated with shadcn.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}