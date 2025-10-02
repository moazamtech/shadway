import { Sparkles, Zap, Code, Heart } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DocsIntroduction() {
  return (
    <div className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Hero Section */}
        <div className="space-y-4 mb-12">
          <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
            Documentation
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Welcome to Shadway UI
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            A curated collection of beautifully designed websites and UI projects built with Shadcn UI.
            Discover inspiration, explore components, and build amazing interfaces.
          </p>
          <div className="flex gap-4 pt-4">
            <Button asChild size="lg">
              <Link href="/">
                Browse Collection
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/submit">
                Submit Your Project
              </Link>
            </Button>
          </div>
        </div>

        {/* What is Shadway UI */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            What is Shadway UI?
          </h2>
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Shadway UI is a comprehensive showcase platform dedicated to highlighting exceptional websites
              and user interfaces built with Shadcn UI. We believe in the power of community-driven design
              and aim to provide developers and designers with a centralized place to discover, learn from,
              and share beautiful UI implementations.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-4">
              Whether you're looking for inspiration for your next project, exploring modern design patterns,
              or wanting to showcase your own work, Shadway UI serves as your go-to resource for all things
              Shadcn UI.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-6">
            Key Features
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Curated Collection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Every website in our collection is carefully reviewed and curated to ensure
                  high-quality design and implementation standards.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Fast & Responsive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Built with modern web technologies for lightning-fast performance
                  across all devices and screen sizes.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Developer Friendly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Easy navigation, detailed categorization, and direct links to live demos
                  and source code when available.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Community Driven
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Submit your own projects and contribute to a growing community of
                  designers and developers passionate about great UI.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Getting Started */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Getting Started
          </h2>
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">1. Browse the Collection</h3>
              <p className="text-muted-foreground">
                Explore our curated collection of websites organized by categories like Components,
                Dev Tools, Themes, Portfolios, SaaS apps, and more.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">2. Find Inspiration</h3>
              <p className="text-muted-foreground">
                Use the search and filter features to find exactly what you're looking for.
                Each listing includes a preview, description, and links to visit the live site.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">3. Submit Your Work</h3>
              <p className="text-muted-foreground">
                Have you built something amazing with Shadcn UI? Share it with the community!
                Use our submission form to get your project featured on Shadway UI.
              </p>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Built With
          </h2>
          <div className="rounded-lg border bg-card p-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Next.js 15 - React Framework</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Shadcn UI - Component Library</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Tailwind CSS - Styling</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">TypeScript - Type Safety</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Airtable - Database</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Vercel - Deployment</span>
              </li>
            </ul>
          </div>
        </section>

        {/* CTA Section */}
        <section className="rounded-lg border-2 border-dashed bg-muted/50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Ready to Explore?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Dive into our collection of beautiful Shadcn UI websites and start building
            something amazing today.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild size="lg">
              <Link href="/">
                <Sparkles className="mr-2 h-4 w-4" />
                View Collection
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/docs/installation">
                Get Started
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
