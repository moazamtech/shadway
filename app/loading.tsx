import { Skeleton } from "@/components/ui/skeleton"
import { Navbar } from "@/components/navbar"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="w-full min-h-screen relative bg-background overflow-x-hidden">
        {/* Background geometric pattern */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="background-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#background-grid)" />
          </svg>
        </div>

        <div className="relative flex flex-col justify-start items-center w-full">
          <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
            {/* Left and right vertical lines */}
            <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0"></div>
            <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0"></div>

            <div className="self-stretch pt-[9px] overflow-hidden border-b border-border flex flex-col justify-center items-center gap-8 lg:gap-[66px] relative z-10">
              <div className="pt-24 sm:pt-28 md:pt-32 lg:pt-32 pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-12 w-full">

                {/* Header Section Skeleton */}
                <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-6 mb-12 relative">
                  <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Skeleton className="h-[54px] w-[250px]" />
                    <Skeleton className="h-[72px] w-[200px]" />
                  </div>
                  <Skeleton className="h-12 w-[600px] max-w-full" />
                  <Skeleton className="h-6 w-[480px] max-w-full" />
                </div>

                {/* Search Section Skeleton */}
                <div className="w-full max-w-[540px] mb-16 relative">
                  <Skeleton className="h-12 w-full rounded-full" />
                </div>

                {/* Separator */}
                <div className="w-full border-t border-dashed border-border/60 mb-12"></div>

                {/* Cards Grid Skeleton */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="relative h-[340px] w-full">
                      <div className="relative h-full w-full p-1">
                        <div className="h-full w-full bg-muted/50 backdrop-blur-sm rounded-xl overflow-hidden flex flex-col">
                          {/* Image skeleton */}
                          <Skeleton className="h-44 w-full rounded-none" />

                          {/* Content skeleton */}
                          <div className="flex-1 p-4 flex flex-col">
                            <div className="flex items-start gap-2 mb-3">
                              <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-10 w-full mb-4" />
                            <Skeleton className="h-8 w-full mt-auto" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom separator */}
                <div className="w-full border-t border-dashed border-border/60 mt-16"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}