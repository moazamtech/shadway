import { Package, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const componentCategories = [
  {
    title: "Form Components",
    description: "Input fields, selects, checkboxes, and more",
    components: ["Button", "Input", "Select", "Checkbox", "Radio Group", "Textarea", "Form"],
  },
  {
    title: "Layout Components",
    description: "Structure your pages with these components",
    components: ["Card", "Separator", "Tabs", "Accordion", "Collapsible", "Sidebar"],
  },
  {
    title: "Feedback Components",
    description: "Provide feedback to users",
    components: ["Alert", "Toast", "Dialog", "Alert Dialog", "Tooltip", "Popover"],
  },
  {
    title: "Data Display",
    description: "Display data in beautiful ways",
    components: ["Table", "Badge", "Avatar", "Skeleton", "Progress", "Calendar"],
  },
  {
    title: "Navigation",
    description: "Help users navigate your application",
    components: ["Navigation Menu", "Breadcrumb", "Dropdown Menu", "Command", "Context Menu"],
  },
]

export default function ComponentsPage() {
  return (
    <div className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="space-y-4 mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Components</h1>
          <p className="text-xl text-muted-foreground">
            Explore the full collection of Shadcn UI components used across the showcased websites.
          </p>
        </div>

        <div className="space-y-6 mb-12">
          {componentCategories.map((category) => (
            <Card key={category.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {category.title}
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {category.components.map((component) => (
                    <span
                      key={component}
                      className="inline-flex items-center rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20"
                    >
                      {component}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-lg border-2 border-dashed bg-muted/50 p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            View All Components
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Visit the official Shadcn UI documentation to see all available components with
            live examples and code snippets.
          </p>
          <Button asChild size="lg">
            <Link href="https://ui.shadcn.com/docs/components" target="_blank">
              Browse Components
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
