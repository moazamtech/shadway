import { Palette, Moon, Sun } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ThemingPage() {
  return (
    <div className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="space-y-4 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Theming</h1>
          <p className="text-xl text-muted-foreground">
            Customize your Shadcn UI components with themes and color schemes.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Color System</h2>
            <p className="text-muted-foreground mb-6">
              Shadcn UI uses CSS variables for theming, making it easy to customize colors across
              your entire application. All components inherit from these variables.
            </p>
            <Card>
              <CardHeader>
                <CardTitle>CSS Variables</CardTitle>
                <CardDescription>
                  Define your theme colors in your global CSS file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
                  <pre>{`@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --border: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
  }
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Dark Mode</h2>
            <div className="grid gap-6 sm:grid-cols-2 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="h-5 w-5 text-primary" />
                    Light Theme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Default light color scheme optimized for daytime viewing with high contrast
                    and clarity.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Moon className="h-5 w-5 text-primary" />
                    Dark Theme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Carefully crafted dark mode that reduces eye strain in low-light environments.
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Dark Mode Variables</CardTitle>
                <CardDescription>
                  Override colors for dark mode using the .dark selector
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 font-mono text-sm overflow-x-auto">
                  <pre>{`@layer base {
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4">Customization Tips</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    Use Theme Generator
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3">
                    Shadcn UI provides a theme generator to help you create custom color schemes quickly.
                    Simply choose your primary color and the generator will create a complete theme.
                  </p>
                  <a
                    href="https://ui.shadcn.com/themes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Visit Theme Generator →
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Consistent Spacing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Use Tailwind's spacing scale consistently across your components for a cohesive
                    design. Shadcn UI components follow this pattern by default.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
