import fs from "fs/promises";
import path from "path";
import { RegistryBlock } from "@/components/registry-block";
import { CategoryPageHeader } from "./_header";
import { CATEGORIES_CONFIG } from "@/lib/docs-config";
import type { ComponentRegistry } from "@/lib/types";

async function getComponents(category: string): Promise<ComponentRegistry[]> {
  const registryPath = path.join(process.cwd(), "registry/registry.json");
  const registry = JSON.parse(await fs.readFile(registryPath, "utf-8"));

  const isAll = category.toLowerCase() === "all";
  const items: any[] = isAll
    ? registry.items
    : registry.items.filter(
        (item: any) =>
          (item.category || "ui").toLowerCase() === category.toLowerCase(),
      );

  const components = await Promise.all(
    items.map(async (item: any) => {
      try {
        const jsonPath = path.join(
          process.cwd(),
          `registry/${item.name}.json`,
        );
        return JSON.parse(await fs.readFile(jsonPath, "utf-8"));
      } catch {
        return null;
      }
    }),
  );

  return components.filter(Boolean);
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const components = await getComponents(category);

  const isAll = category.toLowerCase() === "all";
  const configName = CATEGORIES_CONFIG.find(
    (c) => c.name.toLowerCase() === category.toLowerCase()
  )?.name;
  const categoryName = isAll
    ? "All Blocks"
    : configName || (category.charAt(0).toUpperCase() + category.slice(1));

  return (
    <div className="min-h-screen bg-background relative">
      <div className="max-w-7xl mx-auto px-2 py-4 md:py-6 relative">
        <CategoryPageHeader
          category={category}
          categoryName={categoryName}
          componentCount={components.length}
        />

        <div className="space-y-0">
          {components.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border/40 mx-6 md:mx-12">
              <p className="text-sm text-muted-foreground/60 font-mono uppercase tracking-[0.2em]">
                Empty Module / No items discovered
              </p>
            </div>
          ) : (
            <div className="space-y-16 divide-y divide-border/20">
              {components.map((component, index) => (
                <div key={component.name} className={index === 0 ? "" : "pt-16"}>
                  <RegistryBlock
                    index={index}
                    name={component.name}
                    title={component.title || component.name}
                    description={component.description}
                    category={category}
                    code={component.files[0]?.content || ""}
                    installCommand={`npx shadcn@latest add https://shadway.online/r/${component.name}.json`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-px w-full bg-border/10 mt-20" />
    </div>
  );
}
