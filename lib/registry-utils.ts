import fs from "fs";
import path from "path";

const registryDir = path.join(process.cwd(), "registry");

export function ensureDir() {
  if (!fs.existsSync(registryDir)) fs.mkdirSync(registryDir, { recursive: true });
}

export async function saveComponent({ name, title, description, category, code }: {
  name: string;
  title?: string;
  description?: string;
  category: string;
  code: string;
}) {
  ensureDir();

  const compDir = path.join(registryDir, name);
  if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });

  // 1️⃣ Write TSX component file
  const tsxPath = path.join(compDir, `${name}.tsx`);
  fs.writeFileSync(tsxPath, code);

  // 2️⃣ Create individual component JSON (Shadcn Schema)
  const item = {
    name,
    type: category === "ui" ? "registry:ui" : "registry:component",
    title: title || name,
    description: description || "",
    category: category || "general",
    files: [
      {
        path: `registry/${name}/${name}.tsx`,
        content: code,
        type: "registry:component",
      },
    ],
    dependencies: [],
    registryDependencies: [],
  };

  const jsonPath = path.join(registryDir, `${name}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(item, null, 2));

  // 3️⃣ Update global registry.json
  const registryFile = path.join(registryDir, "registry.json");
  const registry = fs.existsSync(registryFile)
    ? JSON.parse(fs.readFileSync(registryFile, "utf8"))
    : { name: "shadway", items: [] };

  if (!registry.items.find((i: any) => i.name === name)) {
    registry.items.push({
      name,
      type: item.type,
      category: item.category
    });
  }

  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2));

  return { name, path: `/r/${name}.json`, category: item.category };
}

export function getComponent(name: string) {
  const jsonPath = path.join(registryDir, `${name}.json`);
  if (!fs.existsSync(jsonPath)) return null;
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

export function getRegistry() {
  const registryFile = path.join(registryDir, "registry.json");
  if (!fs.existsSync(registryFile)) return { items: [] };
  return JSON.parse(fs.readFileSync(registryFile, "utf8"));
}
