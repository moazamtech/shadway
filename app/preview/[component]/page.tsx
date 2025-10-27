"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, ArrowLeftIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";

export default function ComponentPreviewPage() {
  const { component } = useParams();
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!component) return;

    const loadComponent = async () => {
      try {
        const mod = await import(`@/generated/components/${component}`);
        setComponent(() => mod.default);
      } catch (err: any) {
        console.error(err);
        setError(`Failed to load component: ${component}`);
      }
    };

    loadComponent();
  }, [component]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-xl w-full">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Component Load Error</h3>
                <p className="text-sm text-red-700 font-mono">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link href="/preview">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to List
                </Button>
              </Link>
              <Link href="/component-generator">
                <Button size="sm">Generate New Component</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2Icon className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm">Loading preview...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/preview">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back
                </Button>
              </Link>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Preview: <span className="font-mono text-primary">{component}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">
              generated/components/{component}.tsx
            </p>
          </div>
        </div>

        {/* Preview Container */}
        <div className="bg-white shadow-md rounded-2xl overflow-hidden">
          <div className="border-b bg-gray-50 px-6 py-3">
            <h2 className="text-sm font-medium text-gray-700">Component Preview</h2>
          </div>
          <div className="p-8">
            {/* Error Boundary Wrapper */}
            <ErrorBoundary>
              <Component />
            </ErrorBoundary>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">File Location</h3>
          <code className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
            {process.cwd()}/generated/components/{component}.tsx
          </code>
        </div>
      </div>
    </div>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Component rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Runtime Error</h3>
              <p className="text-sm text-red-700 font-mono">
                {this.state.error?.message || "Component failed to render"}
              </p>
              <details className="mt-3">
                <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-100 p-3 rounded overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add React import for class component
import React from "react";
