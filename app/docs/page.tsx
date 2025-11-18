const categories = [
  { name: "AI", blocks: 4 },
  { name: "Dialogs", blocks: 12 },
  { name: "File Upload", blocks: 6 },
  { name: "Form Layout", blocks: 5 },
  { name: "Grid List", blocks: 3 },
  { name: "Login & Signup", blocks: 9 },
  { name: "Sidebar", blocks: 6 },
  { name: "Stats", blocks: 12 },
  { name: "Tables", blocks: 2 },
];

export default function Page() {
  return (
    <div className="w-full">
      <section className="pb-4">
        <div className="relative mx-auto max-w-2xl overflow-hidden px-6 py-8 sm:px-8 sm:py-10 text-center">
          <div className="relative space-y-4">
            <h1 className="text-foreground text-[24px] xs:text-[28px] sm:text-[36px] md:text-[42px] lg:text-[48px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] font-serif tracking-tight">
              Explore Pre-Built UI Blocks
            </h1>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-muted-foreground">
              Browse through a variety of pre-built UI blocks to kickstart your
              next project. Each block is designed to be easily customizable and
              integrable into your applications.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <button
            key={category.name}
            className="group relative flex flex-col justify-between rounded-3xl border border-dashed border-border/70 bg-gradient-to-br from-background via-background/80 to-muted/40 px-4 sm:px-6 pt-5 pb-6 text-center transition hover:border-primary/30 hover:bg-gradient-to-tr hover:from-muted/40 hover:via-background hover:to-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <div className="mb-6 flex h-28 sm:h-32 items-center justify-center">
              <div className="relative h-full w-full rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/10 via-background/80 to-primary/5">
                <div className="pointer-events-none absolute inset-[-18px] rounded-[28px] bg-[radial-gradient(circle_at_0%_0%,rgba(0,75,156,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(244,140,180,0.18),transparent_55%)] opacity-70 blur-md transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex h-full w-full items-center justify-center">
                  <div className="h-10 w-20 rounded-2xl border border-white/10 bg-background/70 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium sm:text-base tracking-tight">
                {category.name}
              </div>
              <div className="text-xs text-muted-foreground sm:text-sm">
                {category.blocks} blocks
              </div>
            </div>

            <span className="pointer-events-none absolute inset-0 rounded-3xl border border-white/10 opacity-0 mix-blend-screen transition group-hover:opacity-100" />
          </button>
        ))}
      </section>
    </div>
  );
}
