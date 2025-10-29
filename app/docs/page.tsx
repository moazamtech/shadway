export default function Page() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen w-full px-4 relative overflow-hidden">
      {/* Animated background gradient */}
     
      {/* Content */}
      <div className="text-center space-y-8 max-w-4xl">
        {/* Main heading */}
        <div className="space-y-6">
          <h1 className="text-6xl sm:text-7xl md:text-6xl lg:text-9xl font-bold tracking-tighter leading-none">
            <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              Shadway UI
            </span>
          </h1>

          <p className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground">
            Coming Soon
          </p>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We're crafting something amazing for you. Explore our growing collection of beautiful UI components and blocks while we prepare the ultimate Shadway UI experience.
          </p>
        </div>
        {/* Progress indicator */}
          <p className="text-sm text-muted-foreground mb-4">Development Progress</p>
          <div className="w-full max-w-sm mx-auto bg-muted rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/60 h-full w-3/4 rounded-full transition-all duration-1000 animate-pulse"></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">75% Complete</p>
        </div>
    </div>
  )
}
