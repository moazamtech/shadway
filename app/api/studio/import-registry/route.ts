import { lookup } from "node:dns/promises";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { toPackageNames } from "@/lib/registry/types";
import {
  parseRegistryInput,
  RegistryInputError,
  type RegistryReference,
} from "@/lib/studio/registry-reference";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Importing a component from another registry.
 *
 * A registry item describes a component completely: its name, the files it is
 * made of, the packages it needs and the variables it sets. An author who
 * has found one on a registry this site does not run should be able to paste
 * the address of it and have it land in the studio, the same way a component
 * found in a repository can.
 *
 * The address is the whole of what the author gives us, and it is a stranger's
 * address. This endpoint fetches whatever it is told to fetch, which is the
 * exact shape of a request that reaches into the deployment's own network and
 * comes back with the answer. So the rules are about the address rather than
 * about the item: a link that is not http(s) is refused, and an address that
 * names this machine or the network around it is never fetched at all.
 *
 * The address is checked twice, and the two checks answer different
 * questions. The first reads the address as it was written: `localhost`,
 * `127.0.0.1`, `10.0.0.5` and `169.254.169.254` are refused by name. The
 * second asks the resolver what a name points at, which is the only way to
 * tell `http://redis:6379` and `http://metadata.internal` from the address of
 * a registry. Neither check is enough alone, and the resolver's answer is
 * asked for again at every redirect, because a public address that redirects
 * into the network is the same request with one more hop.
 *
 *   not a link                     -> 400
 *   not the address of an item     -> 400
 *   an address inside the network  -> 400
 *   no such item                   -> 404
 *   the answer is not an item      -> 422
 *   the answer is too large        -> 413
 *   the registry cannot be reached -> 502
 */

/** A file this large is not a component. */
const MAX_FILE_BYTES = 400 * 1024;

/** A whole item, answered in one document. */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** How many redirects are followed before the address is given up on. */
const MAX_REDIRECTS = 3;

/** How long a registry is given to answer. */
const REQUEST_TIMEOUT_MS = 10_000;

const USER_AGENT = "shadway-registry-import";

/** An upstream failure that already knows what it wants to say. */
export class ImportError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ImportError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ------------------------------------------------------------- the address -- */

/**
 * The network, as the route uses it.
 *
 * The default is the platform's own: a request through the global fetch and
 * the operating system's resolver. The rules that decide whether a request
 * may be made at all live in the route, and the network is the one thing
 * that is replaceable, so those rules can be exercised against a server of
 * the test's own without a deployment to point them at.
 */
export type RegistryNetwork = {
  /** The request itself. */
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** The addresses a name points at. */
  resolve: (hostname: string) => Promise<string[]>;
};

const defaultNetwork: RegistryNetwork = {
  fetch: (url, init) => fetch(url, init),
  resolve: async (hostname) => {
    const found = await lookup(hostname, { all: true, verbatim: true });
    return found.map((entry) => entry.address);
  },
};

/**
 * The names that address this machine, or the network it sits in.
 *
 * They are refused by name because a name is what an author pastes, and
 * `localhost` is the first thing anybody tries. The suffix list is short on
 * purpose: `.local` and `.internal` are the two that keep turning up in
 * container networks, and a name that ends in either is not a registry.
 */
const LOCAL_NAME_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

/**
 * Whether an address is one of the private ranges.
 *
 * The list is the ranges a deployment is actually reachable on, and the
 * link-local one matters as much as the rest: `169.254.169.254` is where the
 * cloud metadata service answers, and an endpoint that fetches a stranger's
 * address is exactly how a caller gets to ask it for the deployment's own
 * credentials.
 */
function isPrivateAddress(address: string): boolean {
  const host = address.toLowerCase().split("%")[0] ?? "";
  if (!host) return false;
  if (host.includes(":")) return isPrivateIpv6(host);
  return isPrivateIpv4(host);
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4) return false;
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  if (address === "::" || address === "::1") return true;

  // An IPv4-mapped or NAT64 address carries an IPv4 address inside it, and
  // the address inside it is the one that decides.
  const embedded = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (embedded && isPrivateIpv4(embedded[1])) return true;

  const first = Number.parseInt(address.split(":")[0] || "0", 16);
  if (Number.isNaN(first)) return false;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xff00) === 0xff00) return true;
  return false;
}

/** The host of a URL, without the brackets an IPv6 literal carries. */
function hostOf(url: URL): string {
  return url.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

/** Whether the address names this machine or the network around it. */
function isLocalName(host: string): boolean {
  if (host === "localhost") return true;
  if (LOCAL_NAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return isPrivateAddress(host);
}

/**
 * The address of a registry item.
 *
 * The shape is the registry's own: `/r/<name>` or `/r/<owner>/<name>`. A
 * link that points anywhere else is refused here rather than fetched and
 * examined, because an address that names no item is an address that names
 * something else, and that something else is the author's business and not
 * ours to go reading.
 */
function parseRegistryUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) {
    throw new ImportError(400, "Paste the address of a registry item.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError(
      400,
      `"${raw}" is not a link. Paste one that looks like https://registry.example/r/name.`
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportError(400, "Only http and https links can be read.");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "r" || segments.length < 2) {
    throw new ImportError(
      400,
      "That link does not point at a registry item. A registry item lives at <registry>/r/<name>."
    );
  }

  return url;
}

/**
 * The check that keeps the request out of the deployment's own network.
 *
 * The name is read first, because an address written as a private range is
 * refused without a round trip. The resolver is asked next, and a name that
 * points inward is refused whatever it is called. A name the resolver cannot
 * answer is not refused: such a name is one the request cannot reach either,
 * so the failure is left to the request, which reports it in the words the
 * author can act on.
 */
async function assertReachable(url: URL, network: RegistryNetwork): Promise<void> {
  const host = hostOf(url);
  if (isLocalName(host)) {
    throw new ImportError(
      400,
      "That address is inside this network, so it cannot be read from here."
    );
  }

  let addresses: string[];
  try {
    addresses = await network.resolve(host);
  } catch {
    return;
  }

  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new ImportError(
      400,
      "That address is inside this network, so it cannot be read from here."
    );
  }
}

/* ------------------------------------------------------------- the address -- */

/**
 * The registry every shadcn project has always installed from.
 *
 * The item's own address is `https://ui.shadcn.com/r/styles/<style>/<name>.json`,
 * and the style is part of the address: the same name is a different file
 * under a different style, and the newest items only exist under the newer
 * one. So a name is looked for under both, in the order the CLI would try
 * them, and the first one that answers with an item is the item.
 */
const DEFAULT_REGISTRY = "https://ui.shadcn.com";

/** The styles a bare name is looked for under, in the order they are tried. */
const DEFAULT_STYLES = ["new-york", "new-york-v4"];

/**
 * The directory of the registries the CLI knows by name.
 *
 * The CLI carries a list of the community registries, so that
 * `npx shadcn add @acme/button` works without the project having configured
 * anything. The list is the same one, and it is the only way a name with a
 * namespace can be turned into an address.
 */
const REGISTRY_DIRECTORY_URL = "https://ui.shadcn.com/r/registries.json";

/** How long the directory is kept before it is read again. */
const DIRECTORY_TTL_MS = 10 * 60 * 1000;

type RegistryDirectoryEntry = {
  name: string;
  url: string;
  homepage?: string;
  description?: string;
};

/**
 * The directory, read once and kept for a while.
 *
 * It is a large document — every community registry, with the health of each
 * — and an author pasting a name is not going to paste many of them in a
 * minute. The copy is kept in memory for ten minutes, which is long enough
 * that a second import does not read it again and short enough that a
 * registry which moves is picked up in the same afternoon.
 */
let directory: { entries: RegistryDirectoryEntry[]; readAt: number } | null = null;

async function readDirectory(
  network: RegistryNetwork
): Promise<RegistryDirectoryEntry[]> {
  if (directory && Date.now() - directory.readAt < DIRECTORY_TTL_MS) {
    return directory.entries;
  }

  const { response } = await fetchItem(new URL(REGISTRY_DIRECTORY_URL), network);
  if (!response.ok) {
    throw new ImportError(
      502,
      "The registry directory could not be read, so the name could not be looked up."
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readAnswer(response));
  } catch {
    throw new ImportError(502, "The registry directory could not be read.");
  }

  if (!Array.isArray(payload)) {
    throw new ImportError(502, "The registry directory could not be read.");
  }

  const entries = payload.filter(
    (entry): entry is RegistryDirectoryEntry =>
      isRecord(entry) &&
      typeof entry.name === "string" &&
      typeof entry.url === "string"
  );

  directory = { entries, readAt: Date.now() };
  return entries;
}

/**
 * The address of a namespaced item.
 *
 * The directory gives a template rather than an address, because one registry
 * holds many items: `https://acme.com/r/{name}.json`. The placeholders are
 * filled in the way the CLI fills them in — the item's name, and the style
 * when the template asks for one.
 */
function fillTemplate(template: string, name: string, style: string): string | null {
  let filled = template.replace(/\{name\}/g, name);
  if (filled.includes("{style}")) {
    filled = filled.replace(/\{style\}/g, style);
  }
  if (filled.includes("{")) return null;

  try {
    return new URL(filled).toString();
  } catch {
    return null;
  }
}

/**
 * The addresses a name can be read from, in the order they are tried.
 *
 * A name is not one address. The same name is a different file under a
 * different style, and the newest items only exist under the newer one, so a
 * name is read from every style the CLI would try until one of them answers
 * with an item. The first answer wins, and the others are not read at all.
 */
async function resolveAddresses(
  reference: RegistryReference,
  network: RegistryNetwork
): Promise<string[]> {
  if (reference.kind === "url") {
    return [reference.value];
  }

  if (reference.namespace) {
    const entries = await readDirectory(network);
    const entry = entries.find((candidate) => candidate.name === `@${reference.namespace}`);

    if (!entry) {
      throw new ImportError(
        404,
        `There is no registry called @${reference.namespace} in the shadcn registry directory.`
      );
    }

    const addresses: string[] = [];
    for (const style of DEFAULT_STYLES) {
      const address = fillTemplate(entry.url, reference.name, style);
      if (address && !addresses.includes(address)) addresses.push(address);
    }
    if (!addresses.length) {
      throw new ImportError(
        502,
        `The registry @${reference.namespace} does not say where its items live.`
      );
    }
    return addresses;
  }

  return DEFAULT_STYLES.map(
    (style) => `${DEFAULT_REGISTRY}/r/styles/${style}/${reference.name}.json`
  );
}

/* --------------------------------------------------------------- the answer -- */
/**
 * The registry's answer, read within a size the deployment can afford.
 *
 * The declared length is checked before the body is read, so an answer that
 * announces itself as enormous is refused without pulling it over the wire.
 * The body is measured as it arrives, because a chunked answer declares no
 * length at all and the only way to know how much of it there is to count.
 */
async function readAnswer(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new ImportError(413, "That registry's answer was larger than 2 MB.");
  }

  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ImportError(413, "That registry's answer was larger than 2 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged);
}

/**
 * The item, fetched with the redirects followed by hand.
 *
 * A redirect is not followed by the platform here, because every hop has to
 * be checked again: a public registry that answers with a redirect into the
 * deployment's own network is the same request one hop further along. The
 * check runs before every hop, so a chain that walks inwards is refused at
 * the hop that walks inwards.
 */
async function fetchItem(
  url: URL,
  network: RegistryNetwork
): Promise<{ response: Response; url: URL }> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertReachable(current, network);

    let response: Response;
    try {
      response = await network.fetch(current.toString(), {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      console.error("Registry request failed:", current.toString(), error);
      throw new ImportError(502, "That registry could not be reached.");
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop === MAX_REDIRECTS) {
        throw new ImportError(502, "That registry kept redirecting.");
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new ImportError(502, "That registry answered with a redirect that could not be followed.");
      }
      current = next;
      continue;
    }

    return { response, url: current };
  }

  throw new ImportError(502, "That registry kept redirecting.");
}

/* ---------------------------------------------------------------- the item -- */

export type RegistryFile = {
  path: string;
  content: string;
  type: string;
  target?: string;
};

export type RegistryCssVars = {
  light: Record<string, unknown>;
  dark: Record<string, unknown>;
};

export type RegistryItem = {
  /** The address the item was finally read from. */
  url: string;
  name: string;
  type: string;
  files: RegistryFile[];
  dependencies: string[];
  registryDependencies: RegistryReference[];
  cssVars?: RegistryCssVars;
  /** The files that were left out, and why. */
  skipped: { path: string; reason: string }[];
};

/** How a reference reads when it is shown to a person. */
export function describeReference(reference: RegistryReference): string {
  if (reference.kind === "url") return reference.value;
  return reference.namespace ? `@${reference.namespace}/${reference.name}` : reference.name;
}

/**
 * A path that stays inside the project.
 *
 * A registry item's paths arrive from a stranger, and one that climbs out of
 * the project with `..` asks for a file the studio does not have.
 */
function safePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/^\/+/, "");
  if (!clean) return null;
  if (clean.includes("\\") || clean.includes("\0")) return null;
  if (/^[a-zA-Z]:/.test(clean)) return null;
  const segments = clean.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return clean;
}

/**
 * The item's own files, and the ones that did not fit.
 *
 * A file that is larger than the studio's own limit is left out and named,
 * rather than refused: the rest of the item is still worth bringing in, and
 * the author is told which file did not come and why. The limit is the same
 * one the repository import uses, because a component is a component however
 * it was published.
 */
function readFiles(files: unknown): {
  files: RegistryFile[];
  skipped: { path: string; reason: string }[];
} {
  const read: RegistryFile[] = [];
  const skipped: { path: string; reason: string }[] = [];

  if (!Array.isArray(files)) {
    throw new ImportError(422, "That address did not answer with a registry item.");
  }

  for (const entry of files) {
    if (!isRecord(entry)) continue;

    const path = safePath(entry.path);
    if (!path) continue;

    const content = typeof entry.content === "string" ? entry.content : "";
    if (!content.trim()) {
      skipped.push({ path, reason: "The file is empty." });
      continue;
    }

    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
      skipped.push({ path, reason: "The file is larger than 400 KB." });
      continue;
    }

    const type = typeof entry.type === "string" && entry.type.trim() ? entry.type.trim() : "registry:component";
    const target = safePath(entry.target);

    read.push(target ? { path, content, type, target } : { path, content, type });
  }

  if (!read.length && skipped.length) {
    throw new ImportError(413, "Every file in that item is larger than 400 KB.");
  }

  return { files: read, skipped };
}

/**
 * The item's registry dependencies, as the things they are.
 *
 * A dependency is another item, and it is named in one of three ways. A link
 * is the item's own address. A name with a namespace belongs to the registry
 * that namespace names. A bare name belongs to the default registry — which is
 * what makes a block that is built out of shadcn's own components work: the
 * block says "button" and the button is the one everybody has.
 *
 * The address is made absolute before it leaves this function, because a
 * relative address is read against whoever serves it, and whoever serves it
 * here is this deployment, whose registry is a different one.
 */
function readRegistryDependencies(
  values: unknown,
  itemUrl: URL
): RegistryReference[] {
  if (!Array.isArray(values)) return [];

  const resolved: RegistryReference[] = [];
  const directory = new URL(".", itemUrl);
  const suffix = itemUrl.pathname.endsWith(".json") ? ".json" : "";

  const add = (reference: RegistryReference) => {
    const key = JSON.stringify(reference);
    if (!resolved.some((candidate) => JSON.stringify(candidate) === key)) {
      resolved.push(reference);
    }
  };

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;

    if (/^https?:\/\//i.test(trimmed)) {
      add({ kind: "url", value: trimmed });
      continue;
    }

    const namespaced = /^@([a-zA-Z0-9][a-zA-Z0-9._-]*)\/([a-zA-Z0-9][a-zA-Z0-9._-]*)$/.exec(
      trimmed
    );
    if (namespaced) {
      add({ kind: "item", namespace: namespaced[1], name: namespaced[2] });
      continue;
    }

    // A plain name is the default registry's.
    if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
      add({ kind: "item", namespace: null, name: trimmed });
      continue;
    }

    let absolute: string;
    try {
      absolute = new URL(trimmed.replace(/^\/+/, ""), directory).toString();
    } catch {
      continue;
    }
    if (suffix && !absolute.endsWith(suffix)) absolute += suffix;
    add({ kind: "url", value: absolute });
  }

  return resolved;
}

/** The variables the item sets, in the shape the schema describes. */
function readCssVars(value: unknown): RegistryCssVars | undefined {
  if (!isRecord(value)) return undefined;
  const light = isRecord(value.light) ? value.light : {};
  const dark = isRecord(value.dark) ? value.dark : {};
  if (!Object.keys(light).length && !Object.keys(dark).length) return undefined;
  return { light, dark };
}

/**
 * The item at an address.
 *
 * Everything the studio needs to bring the component in is decided here: the
 * files with their content, the packages the item declares, the variables it
 * sets, and the registry dependencies it names. A registry that answers with
 * anything else — a page, a 404, a document that is not an item — is
 * refused with a sentence, because an error the author can read is worth more
 * than a stack trace they cannot.
 */
export async function readRegistryItem(
  address: string | string[],
  options: { network?: RegistryNetwork } = {}
): Promise<RegistryItem> {
  const network = options.network ?? defaultNetwork;
  const candidates = Array.isArray(address) ? address : [address];

  let last: ImportError | null = null;
  for (const candidate of candidates) {
    try {
      return await readRegistryItemAt(candidate, network);
    } catch (error) {
      /**
       * Only "there is nothing there" is worth trying the next address for.
       *
       * A registry that answered with an error has answered, and the next
       * address is a different registry's item: reading it would be answering
       * a different question than the author asked.
       */
      if (!(error instanceof ImportError) || error.status !== 404) throw error;
      last = error;
    }
  }

  throw last ?? new ImportError(404, "That registry has no item at that address.");
}

/**
 * The item at one address.
 *
 * Everything the studio needs to bring the component in is decided here: the
 * files with their content, the packages the item declares, the variables it
 * sets, and the registry dependencies it names. A registry that answers with
 * anything else — a page, a 404, a document that is not an item — is
 * refused with a sentence, because an error the author can read is worth more
 * than a stack trace they cannot.
 */
async function readRegistryItemAt(
  address: string,
  network: RegistryNetwork
): Promise<RegistryItem> {
  const url = parseRegistryUrl(address);

  const { response, url: finalUrl } = await fetchItem(url, network);

  if (response.status === 404) {
    throw new ImportError(404, "That registry has no item at that address.");
  }
  if (!response.ok) {
    throw new ImportError(502, `That registry answered with ${response.status}.`);
  }

  const body = await readAnswer(response);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new ImportError(422, "That address did not answer with a registry item.");
  }
  if (!isRecord(payload)) {
    throw new ImportError(422, "That address did not answer with a registry item.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new ImportError(422, "That address did not answer with a registry item.");
  }

  const { files, skipped } = readFiles(payload.files);
  if (!files.length) {
    throw new ImportError(422, "That registry item has no files in it.");
  }

  const type = typeof payload.type === "string" && payload.type.trim() ? payload.type.trim() : "registry:component";
  const dependencies = toPackageNames(
    Array.isArray(payload.dependencies) ? payload.dependencies : []
  );
  const registryDependencies = readRegistryDependencies(payload.registryDependencies, finalUrl);
  const cssVars = readCssVars(payload.cssVars);

  return {
    url: finalUrl.toString(),
    name,
    type,
    files,
    dependencies,
    registryDependencies,
    ...(cssVars ? { cssVars } : {}),
    skipped,
  };
}

/* --------------------------------------------------------------- the route -- */

/**
 * How deep the registry dependencies are followed.
 *
 * A block is built out of other blocks, and those out of others, and the
 * chain is short but it is not flat. Two levels is enough for what the
 * registries actually publish, and the limit is here because the chain is
 * followed into strangers' registries: a cycle would otherwise be followed
 * forever.
 */
const DEPENDENCY_DEPTH = 2;

/** How many items are brought in altogether, dependencies included. */
const MAX_ITEMS = 24;

/**
 * The item, and the items it is built out of.
 *
 * A registry item that says it is built out of a button is describing a
 * component that does not compile without one. The CLI installs the whole
 * chain, and so does this: the dependencies are read and their files are
 * brought in beside the item's own, so what lands in the studio is a
 * component that runs rather than a component that is missing half of
 * itself.
 *
 * A dependency that cannot be read is reported rather than fatal. The author
 * gets the item they asked for and a list of what is missing, which is a
 * better answer than nothing at all, and the list says what to look for.
 */
async function readItemWithDependencies(
  reference: RegistryReference,
  network: RegistryNetwork,
  depth = 0,
  seen: Set<string> = new Set(),
  read: RegistryItem[] = []
): Promise<{ item: RegistryItem; files: RegistryFile[]; unresolved: string[] }> {
  const addresses = await resolveAddresses(reference, network);
  const item = await readRegistryItem(addresses, { network });

  if (seen.has(item.url) || read.length >= MAX_ITEMS) {
    return { item, files: [], unresolved: [] };
  }
  seen.add(item.url);
  read.push(item);

  const files: RegistryFile[] = [];
  const unresolved: string[] = [];

  if (depth >= DEPENDENCY_DEPTH) {
    for (const dependency of item.registryDependencies) {
      unresolved.push(describeReference(dependency));
    }
    return { item, files, unresolved };
  }

  for (const dependency of item.registryDependencies) {
    try {
      const nested = await readItemWithDependencies(
        dependency,
        network,
        depth + 1,
        seen,
        read
      );
      /**
       * The dependency's own files, and the files of what it is built out of.
       *
       * A dependency is a component like any other, and it is made of files
       * that have to land in the project as well — otherwise the item the
       * author asked for arrives with a hole where its own building blocks
       * should be.
       */
      files.push(...nested.item.files, ...nested.files);
      unresolved.push(...nested.unresolved);
    } catch (error) {
      const label = describeReference(dependency);
      unresolved.push(
        error instanceof ImportError ? `${label} (${error.message})` : label
      );
    }
  }

  return { item, files, unresolved };
}

/**
 * The import, as the studio needs it.
 *
 * Everything the studio has to land in the project, in one answer: the items
 * that were named, every file they are made of, the files of the registry
 * dependencies that came with them, the packages the sandbox will have to
 * install, and the dependencies that could not be read.
 */
export type RegistryImport = {
  items: RegistryItem[];
  files: RegistryFile[];
  registryFiles: RegistryFile[];
  dependencies: string[];
  unresolved: string[];
};

export async function importReferences(
  references: RegistryReference[],
  network: RegistryNetwork = defaultNetwork
): Promise<RegistryImport> {  const items: RegistryItem[] = [];
  const files: RegistryFile[] = [];
  const registryFiles: RegistryFile[] = [];
  const dependencies: string[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();
  const read: RegistryItem[] = [];

  for (const reference of references) {
    const result = await readItemWithDependencies(
      reference,
      network,
      0,
      seen,
      read
    );
    items.push(result.item);
    files.push(...result.item.files);
    registryFiles.push(...result.files);
    unresolved.push(...result.unresolved);
  }

  /**
   * The packages, from every item that was read.
   *
   * A dependency has packages of its own, and the sandbox has to install them
   * too: a button that needs a slot is not a button that runs.
   */
  for (const item of read) {
    for (const dependency of item.dependencies) {
      if (!dependencies.includes(dependency)) dependencies.push(dependency);
    }
  }

  /**
   * The files, one per path.
   *
   * A block and the primitives it is built out of often agree on a file: the
   * button the block uses is the button the block's own dependency asks for,
   * and the styles the two registries are published under may differ. The
   * first file for a path is the one that stays, and the first is the item's
   * own — the thing the author asked for wins over the thing it is built out
   * of.
   */
  const own = new Map<string, RegistryFile>();
  for (const file of files) {
    if (!own.has(file.path)) own.set(file.path, file);
  }

  const dependenciesFiles = new Map<string, RegistryFile>();
  for (const file of registryFiles) {
    if (own.has(file.path)) continue;
    if (!dependenciesFiles.has(file.path)) dependenciesFiles.set(file.path, file);
  }

  return {
    items,
    files: [...own.values()],
    registryFiles: [...dependenciesFiles.values()],
    dependencies,
    unresolved,
  };
}

async function handle(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ImportError(400, "The request body was not JSON.");
  }

  if (!isRecord(body)) {
    throw new ImportError(400, "The request body was not a JSON object.");
  }

  /**
   * What the author pasted.
   *
   * The link is the old name of this and it still works, because a link is
   * what the route was built for. The command and the name are the newer
   * ones: the command is what a registry's page puts on its copy button, and
   * the name is what that command is carrying.
   */
  const pasted =
    typeof body.input === "string" && body.input.trim()
      ? body.input
      : typeof body.url === "string"
        ? body.url
        : "";

  if (!pasted.trim()) {
    throw new ImportError(
      400,
      "Paste the address of a registry item, or the command that installs it."
    );
  }

  let references: RegistryReference[];
  try {
    references = parseRegistryInput(pasted);
  } catch (error) {
    if (error instanceof RegistryInputError) {
      throw new ImportError(400, error.message);
    }
    throw error;
  }

  const imported = await importReferences(references, defaultNetwork);

  return NextResponse.json({ ok: true, ...imported });
}

export async function POST(request: Request): Promise<NextResponse> {
  /**
   * A session is required. The route reads an address the caller names and
   * fetches it, and an endpoint that fetches whatever it is told to fetch is
   * a way to spend the deployment's network on somebody else's behalf. The
   * studio is behind a login, and this is the studio's import.
   */
  const { response } = await requireSession();
  if (response) return response;

  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("Registry import failed:", error);
    return NextResponse.json(
      { ok: false, error: "The import failed unexpectedly." },
      { status: 500 }
    );
  }
}
