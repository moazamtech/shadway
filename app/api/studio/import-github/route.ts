import { NextResponse } from "next/server";

import {
  groupByDirectory,
  joinRepoPath,
  parseRepoUrl,
  summarizeTree,
  type RepoCoordinates,
} from "@/lib/studio/github-import";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Importing a component from a public GitHub repository.
 *
 * Two steps, told apart by what the body carries. A body with only a URL
 * answers with the repository's tree, filtered down to the files worth
 * offering. A body with a URL and a list of paths answers with those files'
 * content, read from GitHub's raw endpoint.
 *
 * The listing does not download anything. A repository tree is cheap to fetch
 * and expensive to read file by file, so the author picks first and the
 * contents are pulled only for the files they chose.
 *
 *   not a GitHub link       -> 400
 *   repository not found    -> 404
 *   GitHub's rate limit     -> 429, naming the token that lifts it
 *   GitHub unreachable      -> 502
 *   anything unexpected     -> 500
 */

const USER_AGENT = "shadway-github-import";

/** A file this large is not a component. */
const MAX_FILE_BYTES = 400 * 1024;

/** Enough for a component and its neighbours, and not enough to be a payload. */
const MAX_SELECTED_FILES = 200;

/** An upstream failure that already knows what it wants to say. */
class ImportError extends Error {
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

/**
 * Headers for a call to the GitHub API.
 *
 * A token lifts the rate limit from sixty unauthenticated requests an hour to
 * five thousand, so it is used whenever the deployment has one. The
 * `User-Agent` is not optional: GitHub rejects a request that does not name
 * itself, and the rejection reads as a bare 403 with nothing to act on.
 */
function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

/**
 * Headers for a call to the raw endpoint.
 *
 * The API's `Accept` header describes a JSON media type, and the raw host
 * serves text. The two are kept apart so the raw answer is never negotiated
 * into something else.
 */
function rawHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };

  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

/**
 * A fetch that turns a broken connection into an answer.
 *
 * Without this the network failure escapes as a thrown TypeError and reaches
 * the author as a 500 with no explanation, which reads as a broken import
 * button rather than as an unreachable host.
 */
async function githubFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    console.error("GitHub request failed:", url, error);
    throw new ImportError(502, "GitHub could not be reached. Try again in a moment.");
  }
}

/**
 * The answer to give when GitHub says no.
 *
 * The rate limit is the one failure the author can fix, so it says so and
 * names the token that lifts it. The other statuses are reported as they
 * arrived rather than flattened, because "404" and "500" point at different
 * mistakes and a single "GitHub error" hides which one happened.
 */
async function upstreamError(response: Response, context: string): Promise<ImportError> {
  const body = await response.text().catch(() => "");
  const remaining = response.headers.get("x-ratelimit-remaining");
  const limited =
    response.status === 429 ||
    (response.status === 403 && (remaining === "0" || /rate limit/i.test(body)));

  if (limited) {
    return new ImportError(
      429,
      "GitHub's rate limit was reached. Set GITHUB_TOKEN in the environment and try again — an authenticated request has a quota of its own."
    );
  }

  if (response.status === 404) {
    return new ImportError(
      404,
      "That repository or branch was not found on GitHub. A private repository needs a token with access to it."
    );
  }

  return new ImportError(
    502,
    `GitHub answered the ${context} request with ${response.status}.`
  );
}

/** The blob paths out of a tree response, with everything else dropped. */
function readTreePaths(payload: unknown): string[] {
  if (!isRecord(payload)) return [];

  const tree = payload.tree;
  if (!Array.isArray(tree)) return [];

  const paths: string[] = [];
  for (const entry of tree) {
    if (!isRecord(entry)) continue;
    const path = entry.path;
    if (typeof path !== "string" || !path) continue;
    if (entry.type !== "blob") continue;
    paths.push(path);
  }

  return paths;
}

/**
 * A path that stays inside the repository.
 *
 * The paths arrive from the client, and a path that climbs out of the
 * repository with `..` would ask GitHub for a file that is not part of the
 * tree the author picked.
 */
function sanitizeRepoPath(path: string): string | null {
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean) return null;

  const segments = clean.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  return segments.join("/");
}

/** The repository's file tree, filtered down to what the picker offers. */
async function listFiles(coordinates: RepoCoordinates): Promise<NextResponse> {
  const { owner, repo, ref } = coordinates;
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
    ref
  )}?recursive=1`;

  const response = await githubFetch(url, {
    headers: apiHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw await upstreamError(response, "tree");
  }

  const payload: unknown = await response.json().catch(() => null);
  const paths = readTreePaths(payload);
  const summary = summarizeTree(paths);

  // A truncated tree is GitHub refusing to list everything, and it means the
  // list the author is looking at is missing files that exist.
  if (isRecord(payload) && payload.truncated === true) {
    console.error(`GitHub truncated the tree for ${owner}/${repo} at ${ref}`);
  }

  return NextResponse.json({
    ok: true,
    owner,
    repo,
    ref,
    tree: {
      components: summary.components,
      demos: summary.demos,
      styles: summary.styles,
      others: summary.others,
    },
    groups: groupByDirectory(paths),
  });
}

/** The chosen files, with their content. */
async function readFiles(
  coordinates: RepoCoordinates,
  paths: string[]
): Promise<NextResponse> {
  const { owner, repo, ref } = coordinates;
  const files: { path: string; content: string }[] = [];
  const skipped: { path: string; reason: string }[] = [];

  const chosen = paths.slice(0, MAX_SELECTED_FILES);
  for (const path of paths.slice(MAX_SELECTED_FILES)) {
    skipped.push({
      path,
      reason: `Only ${MAX_SELECTED_FILES} files can be imported in one go.`,
    });
  }

  for (const path of chosen) {
    const clean = sanitizeRepoPath(path);
    if (!clean) {
      skipped.push({ path, reason: "That path points outside the repository." });
      continue;
    }

    const url = joinRepoPath(owner, repo, ref, clean);
    const response = await githubFetch(url, { headers: rawHeaders(), cache: "no-store" });

    if (!response.ok) {
      skipped.push({
        path: clean,
        reason:
          response.status === 404
            ? "That file was not found in the repository."
            : `GitHub answered with ${response.status}.`,
      });
      continue;
    }

    // The declared length is checked before the body is read, so a large file
    // is refused without pulling it over the wire. The body is measured as
    // well, because a chunked answer declares no length at all.
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
      skipped.push({ path: clean, reason: "The file is larger than 400 KB." });
      continue;
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      skipped.push({ path: clean, reason: "The file is larger than 400 KB." });
      continue;
    }

    files.push({ path: clean, content: new TextDecoder("utf-8").decode(bytes) });
  }

  return NextResponse.json({ ok: true, owner, repo, ref, files, skipped });
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

  const rawUrl = typeof body.url === "string" ? body.url : "";
  if (!rawUrl.trim()) {
    throw new ImportError(400, "A link to a GitHub repository is required.");
  }

  let coordinates: RepoCoordinates;
  try {
    coordinates = parseRepoUrl(rawUrl);
  } catch (error) {
    throw new ImportError(
      400,
      error instanceof Error ? error.message : "That is not a link to a GitHub repository."
    );
  }

  const selected = Array.isArray(body.paths)
    ? body.paths.filter((entry): entry is string => typeof entry === "string")
    : [];

  // An empty selection means the author has not picked yet, so the tree is
  // what they are asking for.
  if (!selected.length) {
    return listFiles(coordinates);
  }

  return readFiles(coordinates, selected);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("GitHub import failed:", error);
    return NextResponse.json(
      { ok: false, error: "The import failed unexpectedly." },
      { status: 500 }
    );
  }
}
