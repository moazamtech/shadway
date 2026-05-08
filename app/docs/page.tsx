import fs from "fs/promises";
import path from "path";
import { CATEGORIES_CONFIG } from "@/lib/docs-config";
import { BlocksGrid } from "./_grid";

async function getRegistryCategories() {
  const registryPath = path.join(process.cwd(), "registry/registry.json");
  const registry = JSON.parse(await fs.readFile(registryPath, "utf-8"));
  return registry.items as any[];
}

export default async function BlocksPage() {
  const items = await getRegistryCategories();

  const registryCategoriesMap = items.reduce((acc: any, item: any) => {
    const cat = item.category || "other";
    if (!acc[cat]) {
      const configName = CATEGORIES_CONFIG.find(
        (c) => c.name.toLowerCase() === cat.toLowerCase()
      )?.name;
      acc[cat] = { name: configName || (cat.charAt(0).toUpperCase() + cat.slice(1)), count: 0, originalCategory: cat.toLowerCase() };
    }
    acc[cat].count++;
    return acc;
  }, {});

  const dynamicCategories = Object.values(registryCategoriesMap).map((cat: any) => {
    const config = CATEGORIES_CONFIG.find(
      (c) => c.name.toLowerCase() === cat.name.toLowerCase(),
    ) || { description: `Collection of ${cat.name} blocks and components.` };

    return {
      name: cat.name,
      description: config.description,
      blocks: cat.count,
      originalCategory: cat.originalCategory,
      isDynamic: true,
    };
  });

  const dynamicNames = new Set(dynamicCategories.map((c) => c.name.toLowerCase()));
  const staticCategories = CATEGORIES_CONFIG.filter(
    (cat) => !dynamicNames.has(cat.name.toLowerCase()),
  ).map((cat) => ({
    name: cat.name,
    description: cat.description,
    blocks: 0,
    originalCategory: cat.name.toLowerCase(),
    isDynamic: false,
  }));

  const totalItems = dynamicCategories.reduce((sum, c) => sum + (c.blocks || 0), 0);

  return (
    <div className="w-full min-h-screen bg-background text-foreground relative">
      <div className="max-w-7xl mx-auto px-[10px] py-6 md:py-12 relative">
        {/* Header Section */}
        <section className="mb-12 space-y-8 relative px-6 md:px-12">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] uppercase text-primary/80 mb-2">
              <div className="w-8 h-px bg-primary/40" />
              Components Library
            </div>

            <h1 className="text-5xl md:text-8xl font-medium tracking-tight leading-[0.9]">
              Premium UI
              <br />
              <span className="text-muted-foreground/40 font-serif italic">
                Blocks
              </span>
            </h1>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-8 border-t border-border/40">
            <p className="max-w-xl text-lg text-muted-foreground/80 font-light leading-relaxed">
              Curated collection of high-end Shadcn UI components, templates,
              and inspiration. Built for speed, aesthetics, and modern
              workflows.
            </p>

            <div className="flex items-center gap-6 text-[11px] font-mono text-muted-foreground/60">
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
                  Total Items
                </span>
                <span className="text-foreground">{totalItems} BRICKs</span>
              </div>
              <div className="w-px h-8 bg-border/40" />
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-foreground/40 text-[9px]">
                  Status
                </span>
                <span className="text-primary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Live Registry
                </span>
              </div>
            </div>
          </div>
        </section>

        <BlocksGrid
          dynamicCategories={dynamicCategories}
          staticCategories={staticCategories}
        />
      </div>

      <div className="h-px w-full bg-border/20 mt-20" />
    </div>
  );
}
