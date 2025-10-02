import { ExternalLink, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const examples = [
  {
    title: "Landing Pages",
    description: "Beautiful landing pages built with Shadcn UI",
    count: "20+",
    href: "/category/portfolio",
  },
  {
    title: "Dashboards",
    description: "Admin panels and analytics dashboards",
    count: "15+",
    href: "/category/app",
  },
  {
    title: "SaaS Applications",
    description: "Complete SaaS platforms and tools",
    count: "25+",
    href: "/category/saas",
  },
  {
    title: "Component Libraries",
    description: "Reusable component collections",
    count: "10+",
    href: "/category/components",
  },
  {
    title: "Documentation Sites",
    description: "Beautiful documentation websites",
    count: "8+",
    href: "/category/documentation",
  },
  {
    title: "Developer Tools",
    description: "Tools for developers and designers",
    count: "12+",
    href: "/category/dev-tools",
  },
]

export default function ExamplesPage() {
  return (
    <div className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="space-y-4 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Examples</h1>
          <p className="text-xl text-muted-foreground">
            Explore real-world examples of websites and applications built with Shadcn UI.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Browse by Category</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {examples.map((example) => (
                <Card key={example.title} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {example.title}
                      <span className="text-sm font-normal text-muted-foreground">
                        {example.count}
                      </span>
                    </CardTitle>
                    <CardDescription>{example.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="ghost" className="w-full justify-between">
                      <Link href={example.href}>
                        View Examples
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Featured Examples</h2>
            <div className="space-y-4">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Modern Portfolio Template</CardTitle>
                  <CardDescription>
                    A stunning portfolio template with smooth animations and dark mode support
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href="/">
                        View Demo
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Analytics Dashboard</CardTitle>
                  <CardDescription>
                    Comprehensive dashboard with charts, tables, and real-time data visualization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href="/">
                        View Demo
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="rounded-lg border-2 border-dashed bg-muted/50 p-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-3">
              Want to See More?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Browse our full collection of websites to discover more examples and find
              inspiration for your next project.
            </p>
            <Button asChild size="lg">
              <Link href="/">
                Browse All Examples
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
