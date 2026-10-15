/**
 * Configuration for the studio's component sandboxes.
 *
 * The studio runs the author's component on a real Next.js dev server inside a
 * CodeSandbox VM — the same stack this site is built on — so the preview is the
 * actual application: the App Router layout, real HMR, real dependencies, the
 * stock Next.js error overlay. When no token is configured the studio quietly
 * falls back to its browser-side preview.
 */

/** Where every sandbox keeps its project. */
export const SANDBOX_ROOT = "/project/sandbox";

/** The port the Next.js dev server listens on inside the VM. */
export const SANDBOX_DEV_PORT = 3000;

/** Idle sandboxes hibernate instead of burning credits. */
export const SANDBOX_HIBERNATION_SECONDS = 300;

/** The named shell that installs dependencies and runs the dev server. */
export const SANDBOX_SHELL_NAME = "shadway install-and-dev";

/** True when a CodeSandbox API token is configured (`CSB_API_KEY`). */
export function isSandboxConfigured(): boolean {
  return Boolean(process.env.CSB_API_KEY);
}

/**
 * An optional sandbox id to fork new sandboxes from. Point `CSB_TEMPLATE_ID`
 * at a warmed-up project (dependencies already installed) and every new
 * draft boots without reinstalling anything.
 */
export function sandboxTemplateId(): string | null {
  return process.env.CSB_TEMPLATE_ID || null;
}
