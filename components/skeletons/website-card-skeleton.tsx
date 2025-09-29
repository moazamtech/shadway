import { Skeleton } from "@/components/ui/skeleton"

export function WebsiteCardSkeleton() {
  return (
    <div className="group cursor-pointer">
      {/* Enhanced SVG border container - matching original design */}
      <div className="relative h-[340px] w-full">
        {/* Main SVG Border with geometric elements */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Main border rectangle */}
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            rx="3"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            strokeDasharray="2 2"
            fill="none"
            className="opacity-60"
          />

          {/* Corner geometric elements */}
          <g className="opacity-40">
            {/* Top-left corner */}
            <line x1="0" y1="8" x2="8" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />
            <line x1="8" y1="0" x2="8" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />

            {/* Top-right corner */}
            <line x1="92" y1="0" x2="92" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />
            <line x1="92" y1="8" x2="100" y2="8" stroke="hsl(var(--border))" strokeWidth="0.3" />

            {/* Bottom-left corner */}
            <line x1="0" y1="92" x2="8" y2="92" stroke="hsl(var(--border))" strokeWidth="0.3" />
            <line x1="8" y1="92" x2="8" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />

            {/* Bottom-right corner */}
            <line x1="92" y1="92" x2="100" y2="92" stroke="hsl(var(--border))" strokeWidth="0.3" />
            <line x1="92" y1="92" x2="92" y2="100" stroke="hsl(var(--border))" strokeWidth="0.3" />
          </g>

          {/* Grid pattern overlay */}
          <defs>
            <pattern id="skeleton-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="hsl(var(--border))" strokeWidth="0.2" className="opacity-20"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#skeleton-grid)" className="opacity-30" />
        </svg>

        {/* Card Content */}
        <div className="relative h-full w-full p-1">
          <div className="h-full w-full bg-muted/50 backdrop-blur-sm rounded-xl overflow-hidden flex flex-col">
            {/* Image Section Skeleton */}
            <div className="relative h-44 bg-muted/50 overflow-hidden">
              <Skeleton className="w-full h-full" />
            </div>

            {/* Content Section Skeleton */}
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex items-start gap-2 mb-3">
                <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4 flex-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>

              {/* Action Button Skeleton */}
              <div className="mt-auto">
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WebsiteGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <WebsiteCardSkeleton key={index} />
      ))}
    </div>
  )
}