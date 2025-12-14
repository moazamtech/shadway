"use client";

import React from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export class SandpackErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Sandpack Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-background">
          <div className="text-center space-y-4 p-6 max-w-md">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangleIcon className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Preview Error</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {this.state.error?.message ||
                  "The preview crashed while rendering."}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onReset?.();
                }}
              >
                <RefreshCwIcon className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button size="sm" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
