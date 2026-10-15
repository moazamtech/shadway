import fs from "fs/promises";
import os from "os";
import path from "path";

import { SANDBOX_STYLE_PREFIX, sandboxSeedFiles, type SandboxDraft } from "@/lib/studio/sandbox/project";
import { DEFAULT_STYLE_PATH } from "@/lib/studio/starter";

/**
 * The on-disk workspace the local dev server runs from.
 *
 * Each draft owns one directory under the OS temp folder: the Next.js scaffold,
 * the author's files and the vendored shadcn/ui sources. `next dev` watches it,
 * so a studio edit is a file write away from a real hot reload — no emulation,
 * no browser-side transpiler.
 */

export function workspaceRoot(): string {
  const configured = process.env.SHADWAY_WORKSPACE_DIR;
  return configured ? path.resolve(configured) : path.join(os.tmpdir(), "shadway-studio");
}

function safeSlug(slug: string): string {
  const cleaned = slug.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  return cleaned || "draft";
}

export function workspaceDir(slug: string): string {
  return path.join(workspaceRoot(), safeSlug(slug));
}

/** Resolves a project path (`/app/page.tsx`) inside the workspace, refusing escapes. */
function targetPath(dir: string, filePath: string): string {
  const root = path.resolve(dir);
  const target = path.resolve(root, filePath.replace(/^\/+/, ""));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside the workspace: ${filePath}`);
  }
  return target;
}

async function writeFile(dir: string, filePath: string, content: string): Promise<void> {
  const target = targetPath(dir, filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

/** Materializes the whole project for a draft. Returns the workspace directory. */
export async function writeProject(slug: string, draft: SandboxDraft): Promise<string> {
  const dir = workspaceDir(slug);
  await fs.mkdir(dir, { recursive: true });

  for (const file of sandboxSeedFiles(draft)) {
    await writeFile(dir, file.path, file.content);
  }

  return dir;
}

/**
 * Applies a studio sync: writes the changed files, removes the deleted ones.
 * The stylesheet is written with the Tailwind import and theme in front, the
 * same way the VM seed writes it.
 */
export async function writeProjectFiles(
  slug: string,
  files: Record<string, string>,
  remove: string[] = []
): Promise<string[]> {
  const dir = workspaceDir(slug);
  const written: string[] = [];

  for (const [filePath, content] of Object.entries(files)) {
    const final =
      filePath === DEFAULT_STYLE_PATH
        ? `${SANDBOX_STYLE_PREFIX}${content}`
        : content;
    await writeFile(dir, filePath, final);
    written.push(filePath);
  }

  for (const filePath of remove) {
    await fs
      .rm(targetPath(dir, filePath), { force: true, recursive: true })
      .catch(() => undefined);
  }

  return written;
}
