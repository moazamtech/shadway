const categories = [
  {
    name: "AI",
    blocks: 4,
    description: "Chat layouts, assistants, and response panels for AI products.",
  },
  {
    name: "Dialogs",
    blocks: 12,
    description: "Modals, confirmations, and sheets for asking and guiding users.",
  },
  {
    name: "File Upload",
    blocks: 6,
    description: "Dropzones and upload flows for files, images, and media.",
  },
  {
    name: "Form Layout",
    blocks: 5,
    description: "Clean, structured form shells for inputs, settings, and steps.",
  },
  {
    name: "Grid List",
    blocks: 3,
    description: "Responsive card and grid layouts for content-heavy pages.",
  },
  {
    name: "Login & Signup",
    blocks: 9,
    description: "Auth screens with social logins and password flows.",
  },
  {
    name: "Sidebar",
    blocks: 6,
    description: "Navigation shells for dashboards and multi-panel layouts.",
  },
  {
    name: "Stats",
    blocks: 12,
    description: "Metric, KPI, and summary blocks for overviews.",
  },
  {
    name: "Tables",
    blocks: 2,
    description: "Data tables with emphasis on clarity and readability.",
  },
];

export default function Page() {
  return (
    <div className="w-full">
      <section className="pb-2">
        <div className="relative mx-auto max-w-2xl overflow-hidden px-4 py-6 sm:px-6 sm:py-8 text-center">
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

      <section className="grid gap-2 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category, index) => (
          <button
            key={category.name}
            className="group relative flex flex-col justify-between rounded-[10px] border border-dashed border-border/20 bg-card/60 px-4 py-4 sm:px-5 sm:py-5 text-left transition hover:border-primary/50 hover:bg-accent/10 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-medium text-muted-foreground/80">
                #{String(index + 1).padStart(2, "0")}
              </span>
              <span className="inline-flex items-center rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/80">
                {category.blocks} blocks
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium sm:text-base tracking-tight text-foreground">
                {category.name}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {category.description}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/80">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Clicl to see more details
              </span>
              <span className="inline-flex items-center gap-1">
                View blocks
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                  ↗
                </span>
              </span>
            </div>

          </button>
        ))}
      </section>
    </div>
  );
}
