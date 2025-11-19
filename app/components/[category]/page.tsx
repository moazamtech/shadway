"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ComponentRegistry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowLeft, ArrowUp } from "lucide-react";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const category = params.category as string;
  const [components, setComponents] = useState<ComponentRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch("/registry");
        if (response.ok) {
          const data = await response.json();

          const detailedComponents = await Promise.all(
            data.items.map(async (item: any) => {
              try {
                const detailResponse = await fetch(`/r/${item.name}.json`);
                if (detailResponse.ok) {
                  return await detailResponse.json();
                }
              } catch (error) {
                console.error(`Error fetching ${item.name}:`, error);
              }
              return null;
            })
          );

          setComponents(detailedComponents.filter(Boolean));
        }
      } catch (error) {
        console.error("Error fetching components:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComponents();
  }, [category]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const copyToClipboard = (text: string, componentName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [componentName]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [componentName]: false }));
    }, 2000);
  };

  const openInV0 = (content: string) => {
    const v0Url = `https://v0.dev/chat?q=${encodeURIComponent(content)}`;
    window.open(v0Url, "_blank");
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <div className="space-y-4 mb-8">
          <div className="h-10 bg-muted rounded w-1/3 animate-pulse"></div>
          <div className="h-6 bg-muted rounded w-2/3 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto relative">
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={scrollToTop}
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg backdrop-blur-md bg-primary hover:bg-primary/90"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Header with Back Button */}
      <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-12">
        <Button
          onClick={() => router.push("/components")}
          variant="ghost"
          size="sm"
          className="gap-2 mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Components
        </Button>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight capitalize">
          {category.replace(/-/g, " ")}
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground">
          Browse through all components. Copy the code or open in v0 to
          customize.
        </p>
      </div>

      {/* Components List - Vertical Stack */}
      <div className="space-y-12 sm:space-y-16">
        {components.map((component, index) => {
          const installCommand = `npx shadcn@latest add https://shadway.online/r/${component.name}.json`;
          const isCopied = copiedStates[component.name] || false;

          return (
            <div
              key={component.name}
              id={component.name}
              className="scroll-mt-20"
            >
              {/* Component Header */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
                  <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                    {component.title}
                  </h2>
                </div>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
                  {component.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Button
                  onClick={() =>
                    copyToClipboard(installCommand, component.name)
                  }
                  size="sm"
                  className="gap-2 text-xs sm:text-sm"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                  {isCopied ? "Copied!" : "Copy Install"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openInV0(component.files[0]?.content || "")}
                  className="gap-2 text-xs sm:text-sm"
                >
                  <svg
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                    height="16"
                    strokeLinejoin="round"
                    style={{ color: "currentColor" }}
                    viewBox="0 0 16 16"
                    width="16"
                  >
                    <path
                      d="M6.0952 9.4643V5.5238H7.6190V10.5476C7.6190 11.1394 7.1394 11.6190 6.5476 11.6190C6.2651 11.6190 5.9862 11.5101 5.7857 11.3096L0 5.5238H2.1548L6.0952 9.4643Z M16 10.0952H14.4762V6.6071L10.9881 10.0952H14.4762V11.6190H10.5238C9.3403 11.6190 8.3810 10.6597 8.3810 9.4762V5.5238H9.9048V9.0238L13.4047 5.5238H9.9048V4H13.8571C15.0407 4 16 4.9594 16 6.1429V10.0952Z"
                      fill="currentColor"
                    />
                  </svg>
                  Open in v0
                </Button>
              </div>

              {/* Installation Command */}
              <div className="mb-4 sm:mb-6">
                <div className="relative">
                  <pre className="bg-muted/50 p-3 sm:p-4 rounded-lg overflow-x-auto border border-border/50 text-xs sm:text-sm">
                    <code className="text-foreground/80">{installCommand}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 h-6 sm:h-7 w-6 sm:w-7 p-0"
                    onClick={() =>
                      copyToClipboard(
                        installCommand,
                        `${component.name}-install`
                      )
                    }
                  >
                    {copiedStates[`${component.name}-install`] ? (
                      <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    ) : (
                      <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Preview Area */}
              <div className="mb-4 sm:mb-6">
                <div className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/30 p-6 sm:p-8 md:p-12 min-h-[180px] sm:min-h-[240px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p className="text-xs sm:text-sm">Component preview</p>
                    <code className="text-xs mt-2 inline-block bg-muted px-2 py-1 rounded">
                      {component.name}
                    </code>
                  </div>
                </div>
              </div>

              {/* Code Files */}
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                {component.files.map((file, fileIndex) => (
                  <div key={fileIndex}>
                    <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-muted/50 rounded-t-lg border border-border/50 border-b-0 gap-2">
                      <span className="text-[10px] sm:text-xs font-mono text-muted-foreground truncate">
                        {file.path}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          copyToClipboard(
                            file.content,
                            `${component.name}-file-${fileIndex}`
                          )
                        }
                        className="h-6 sm:h-7 gap-1 sm:gap-2 text-[10px] sm:text-xs shrink-0"
                      >
                        <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden sm:inline">
                          {copiedStates[`${component.name}-file-${fileIndex}`]
                            ? "Copied!"
                            : "Copy"}
                        </span>
                      </Button>
                    </div>
                    <div className="bg-muted/30 rounded-b-lg p-3 sm:p-4 font-mono text-[10px] sm:text-xs overflow-x-auto border border-border/50 border-t-0 max-h-64 sm:max-h-96">
                      <pre className="text-foreground/80 whitespace-pre-wrap break-words leading-4 sm:leading-5">
                        {file.content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dependencies */}
              {(component.dependencies.length > 0 ||
                component.registryDependencies.length > 0) && (
                <div className="space-y-2 sm:space-y-3">
                  {component.dependencies.length > 0 && (
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold mb-2 text-muted-foreground">
                        Dependencies
                      </h3>
                      <div className="bg-muted/30 p-2 sm:p-3 rounded-lg border border-border/50">
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {component.dependencies.map((dep, depIndex) => (
                            <code
                              key={depIndex}
                              className="text-[10px] sm:text-xs bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                            >
                              {dep}
                            </code>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {component.registryDependencies.length > 0 && (
                    <div>
                      <h3 className="text-xs sm:text-sm font-semibold mb-2 text-muted-foreground">
                        Registry Dependencies
                      </h3>
                      <div className="bg-muted/30 p-2 sm:p-3 rounded-lg border border-border/50">
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {component.registryDependencies.map(
                            (dep, depIndex) => (
                              <code
                                key={depIndex}
                                className="text-[10px] sm:text-xs bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded"
                              >
                                {dep}
                              </code>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              {index < components.length - 1 && (
                <div className="mt-12 sm:mt-16 border-t border-dashed border-border/30"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
