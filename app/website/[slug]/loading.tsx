export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        {/* Breadcrumb Skeleton */}
        <div className="flex items-center space-x-2 mb-8 animate-pulse">
          <div className="h-4 w-12 bg-muted rounded"></div>
          <div className="h-4 w-1 bg-muted rounded"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>

        {/* Header Skeleton */}
        <div className="mb-8 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-24 bg-muted rounded-full"></div>
            <div className="h-6 w-20 bg-muted rounded-full"></div>
          </div>
          <div className="h-12 w-3/4 bg-muted rounded mb-4"></div>
          <div className="h-6 w-full bg-muted rounded mb-2"></div>
          <div className="h-6 w-2/3 bg-muted rounded"></div>
        </div>

        {/* Image Skeleton with card border */}
        <div className="relative mb-12 animate-pulse">
          <div className="relative p-1">
            {/* SVG Border */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                rx="2"
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                strokeDasharray="2 2"
                fill="none"
                className="opacity-40"
              />
            </svg>

            {/* Image container */}
            <div className="relative aspect-video w-full bg-muted rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/50 to-muted"></div>
            </div>
          </div>
        </div>

        {/* Meta Info Skeleton */}
        <div className="flex items-center gap-6 mb-8 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-32 bg-muted rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-24 bg-muted rounded"></div>
          </div>
        </div>

        {/* Tags Skeleton */}
        <div className="flex items-center gap-2 mb-8 animate-pulse">
          <div className="h-4 w-4 bg-muted rounded"></div>
          <div className="h-6 w-16 bg-muted rounded-full"></div>
          <div className="h-6 w-20 bg-muted rounded-full"></div>
          <div className="h-6 w-24 bg-muted rounded-full"></div>
        </div>

        {/* CTA Button Skeleton */}
        <div className="mb-12 animate-pulse">
          <div className="h-12 w-48 bg-primary/20 rounded-lg"></div>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-8 animate-pulse">
          <div>
            <div className="h-8 w-48 bg-muted rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded"></div>
              <div className="h-4 w-full bg-muted rounded"></div>
              <div className="h-4 w-3/4 bg-muted rounded"></div>
            </div>
          </div>

          <div>
            <div className="h-7 w-64 bg-muted rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded"></div>
              <div className="h-4 w-5/6 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
