"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2Icon, AlertCircleIcon, EyeIcon, PlusIcon, FolderIcon } from "lucide-react";
import Link from "next/link";

export default function PreviewListPage() {
  const [components, setComponents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComponents = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/list-components");
        if (!response.ok) {
          throw new Error("Failed to fetch components");
        }
        const data = await response.json();
        setComponents(data.components || []);
      } catch (err: any) {
        console.error("Failed to load components:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadComponents();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading components...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto max-w-4xl">
          <Alert variant="destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription className="font-mono text-sm">
              {error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-10">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">
              Component Previews
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse and preview all your generated components
            </p>
          </div>
          <Link href="/component-generator">
            <Button size="lg" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Generate New
            </Button>
          </Link>
        </div>

        {/* Components Grid */}
        {components.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FolderIcon className="h-16 w-16 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium text-muted-foreground">
                No components yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate your first component to get started
              </p>
              <Link href="/component-generator" className="mt-6">
                <Button className="gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Create Component
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((component) => (
              <Card key={component} className="group transition-all hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{component}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    generated/components/{component}.tsx
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/preview/${component}`}>
                    <Button className="w-full gap-2" variant="outline">
                      <EyeIcon className="h-4 w-4" />
                      View Preview
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
