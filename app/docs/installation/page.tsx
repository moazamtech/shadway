import { Terminal, CheckCircle2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/code-block"

export default function InstallationPage() {
  return (
    <div className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="space-y-4 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Installation</h1>
          <p className="text-xl text-muted-foreground">
            Learn how to get started with Shadcn UI and build your own beautiful interfaces.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Prerequisites</h2>
            <p className="text-muted-foreground mb-4">
              Before you begin, make sure you have the following installed:
            </p>
            <ul className="space-y-2 text-muted-foreground ml-6">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                Node.js 18.17 or later
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                A Next.js project (v13 or later recommended)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                Tailwind CSS configured in your project
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Quick Start</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. Create a new Next.js project</h3>
                <CodeBlock code="npx create-next-app@latest my-app" />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">2. Initialize Shadcn UI</h3>
                <CodeBlock code="npx shadcn@latest init" />
                <p className="text-sm text-muted-foreground mt-2">
                  You'll be asked a few questions to configure your project.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">3. Add components</h3>
                <CodeBlock code="npx shadcn@latest add button" />
                <p className="text-sm text-muted-foreground mt-2">
                  This will add the Button component to your project. You can add any component you need.
                </p>
              </div>
            </div>
          </section>

          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>That's it!</AlertTitle>
            <AlertDescription>
              You can now start using Shadcn UI components in your Next.js application.
              Check out the components documentation to see what's available.
            </AlertDescription>
          </Alert>

          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Learn More</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Button asChild variant="outline" className="justify-start h-auto p-4">
                <Link href="https://ui.shadcn.com" target="_blank" className="flex items-center gap-2">
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Shadcn UI Docs</div>
                    <div className="text-sm text-muted-foreground">Official documentation</div>
                  </div>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start h-auto p-4">
                <Link href="/docs/components" className="flex items-center gap-2">
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Component Examples</div>
                    <div className="text-sm text-muted-foreground">See components in action</div>
                  </div>
                </Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
