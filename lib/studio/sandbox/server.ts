import { CodeSandbox } from "@codesandbox/sdk";
import { SANDBOX_HIBERNATION_SECONDS, sandboxTemplateId } from "./config";

/**
 * Server-side CodeSandbox client. The API token never leaves the server —
 * browsers get a one-time `startData` payload from `/api/studio/sandbox`.
 */

let client: CodeSandbox | null = null;

function getClient(): CodeSandbox {
  const apiKey = process.env.CSB_API_KEY;
  if (!apiKey) throw new Error("CSB_API_KEY is not set");
  client ??= new CodeSandbox(apiKey);
  return client;
}

/** Everything the browser needs to open a session against a started VM. */
export type StudioSandboxStartData = Awaited<ReturnType<CodeSandbox["sandbox"]["start"]>>;

/** Creates a VM for a draft and returns its CodeSandbox id. */
export async function createStudioSandbox(title: string): Promise<string> {
  const template = sandboxTemplateId();
  const sandbox = await getClient().sandbox.create({
    ...(template ? { template } : {}),
    title: title || "Shadway component",
    privacy: "unlisted",
    autoConnect: false,
    hibernationTimeoutSeconds: SANDBOX_HIBERNATION_SECONDS,
    tags: ["shadway"],
  });
  return sandbox.id;
}

/** Wakes a sandbox and returns the data the browser connects with. */
export async function startStudioSandbox(id: string): Promise<StudioSandboxStartData> {
  return getClient().sandbox.start(id, {
    hibernationTimeoutSeconds: SANDBOX_HIBERNATION_SECONDS,
  });
}

/** Puts a sandbox to sleep right away. */
export async function hibernateStudioSandbox(id: string): Promise<void> {
  await getClient().sandbox.hibernate(id);
}
