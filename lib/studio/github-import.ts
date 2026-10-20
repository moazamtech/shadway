/**
 * Reading a public GitHub repository as importable source.
 *
 * The part of the import that can be reasoned about without a network lives
 * here: what a pasted URL means, which files in a tree are worth offering, and
 * where a file's raw content lives. The route that drives it does the
 * fetching.
 *
 * No `node:` imports and no `fetch` here on purpose. These are the rules a
 * picker reads, so they have to be exercisable without a server and without a
 * token.
 */

/** Where a repository is, and which commit of it the author looked at. */
export type RepoCoordinates = {
  owner: string;
  repo: string;
  /** A branch, a tag or a commit sha. */
  ref: string;
};

/** What a repository's file list contains, split by what it is for. */
export type TreeSummary = {
  /** Files that could be a component. */
  components: string[];
  /** Demo pages that render one. */
  demos: string[];
  /** Stylesheets, which travel with a component more often than not. */
  styles: string[];
  /** Everything else, counted rather than listed. */
  others: number;
};

/** Files that sit in the same folder. */
export type DirectoryGroup = {
  /** Repository-relative folder. The repository root is the empty string. */
  directory: string;
  files: string[];
};

const DEFAULT_REF = "main";

/** Only github.com itself. A self-hosted GitHub is a different API. */
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** GitHub owners are letters, digits and dashes, and never end in a dash. */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

/** Repositories also allow dots and underscores. */
const REPO_RE = /^[A-Za-z0-9._-]+$/;

/** A branch, tag or sha, as it appears in a URL segment. */
const REF_RE = /^[A-Za-z0-9._/-]+$/;

/**
 * Reads a repository URL.
 *
 * The three shapes an author actually pastes are the repository itself, a
 * folder in it and a file in it. Anything else is refused with a sentence the
 * author can act on, because a URL that is merely *about* a repository — an
 * issue page, a pull request, a profile — names no code to import, and
 * guessing at one is how the wrong tree gets listed.
 *
 * A branch whose name contains a slash cannot be recovered from a file URL:
 * `blob/feat/new/button.tsx` is one branch and one path, or a branch and a
 * nested path, and only GitHub can say which. The first segment is read as the
 * ref here, so a slashed branch arrives as a ref that does not exist and the
 * route reports it as a missing branch rather than an empty repository.
 */
export function parseRepoUrl(input: string): RepoCoordinates {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Paste a link to a GitHub repository.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `"${raw}" is not a link. Paste one that looks like https://github.com/owner/repo.`
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https links can be read.");
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(
      `Only repositories on github.com can be imported, and ${url.hostname} is not github.com.`
    );
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("That link does not name a repository. A repository link has an owner and a name.");
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  const kind = segments[2];

  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo)) {
    throw new Error("That link does not name a repository. A repository link has an owner and a name.");
  }

  if (kind === undefined) {
    return { owner, repo, ref: DEFAULT_REF };
  }

  if (kind !== "tree" && kind !== "blob") {
    throw new Error(
      "Paste the repository's own link, not a page inside it. The address bar of a file or a folder also works."
    );
  }

  const rest = segments.slice(3);
  if (!rest.length) {
    throw new Error("That link names a branch but not which one. The default branch is used instead.");
  }

  const ref = rest[0];
  if (!REF_RE.test(ref)) {
    throw new Error("That link names a branch this cannot read.");
  }

  if (kind === "blob" && rest.length < 2) {
    throw new Error("That link points at a branch rather than at a file.");
  }

  return { owner, repo, ref };
}

/**
 * Folders whose contents are components, whatever they are called inside.
 * A repository that puts its sections in `blocks/` is as valid as one that
 * puts them in `components/`, and the author should not have to rename their
 * layout to import from it.
 */
const COMPONENT_FOLDERS = new Set(["blocks", "sections", "examples", "demo"]);

/**
 * Folders that are never source. A repository vendors its dependencies and
 * ships its build output, and offering those to the picker would let an
 * author import a thousand copies of somebody else's component.
 */
const EXCLUDED_FOLDERS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  "public",
  "__tests__",
]);

function segmentsOf(path: string): string[] {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== ".");
}

function fileNameOf(segments: string[]): string {
  return segments[segments.length - 1] ?? "";
}

/**
 * Whether a file in a repository tree is worth offering.
 *
 * A component lives under `components/`, a demo is a page under `app/`, and a
 * repository that keeps its sections in `blocks/` or `demo/` is still doing
 * the same thing. Tests, stories and config files are excluded because they
 * read as source and are not: importing a `*.test.tsx` into the sandbox
 * brings in a test runner's worth of imports that the preview cannot resolve.
 */
export function isCandidateComponentPath(path: string): boolean {
  const segments = segmentsOf(path);
  if (!segments.length) return false;

  const file = fileNameOf(segments);
  const folders = segments.slice(0, -1);

  if (folders.some((folder) => folder === ".." || EXCLUDED_FOLDERS.has(folder))) {
    return false;
  }

  if (/\.d\.ts$/i.test(file)) return false;
  if (/\.(test|stories|config)\./i.test(file)) return false;

  if (/\.(tsx|jsx)$/i.test(file) && folders.includes("components")) return true;
  if (file === "page.tsx" && folders.includes("app")) return true;
  if (folders.some((folder) => COMPONENT_FOLDERS.has(folder))) return true;

  return false;
}

/** A stylesheet, in any of the three forms a repository ships them in. */
function isStylePath(file: string): boolean {
  return /\.(css|scss|postcss)$/i.test(file);
}

/** A demo page: the page an App Router project renders. */
function isDemoPath(segments: string[]): boolean {
  return fileNameOf(segments) === "page.tsx" && segments.slice(0, -1).includes("app");
}

/**
 * What a repository's files are made of.
 *
 * The order matters. A stylesheet under `components/` is a style, not a
 * component, and a page under `app/` is a demo, not a component — reading
 * them the other way round puts a `globals.css` into the component list and
 * offers the author a stylesheet to import as their component.
 */
export function summarizeTree(paths: string[]): TreeSummary {
  const components: string[] = [];
  const demos: string[] = [];
  const styles: string[] = [];
  let others = 0;

  for (const path of paths) {
    const segments = segmentsOf(path);
    if (!segments.length) continue;

    const file = fileNameOf(segments);

    if (isStylePath(file)) {
      styles.push(path);
      continue;
    }

    if (isDemoPath(segments)) {
      demos.push(path);
      continue;
    }

    if (isCandidateComponentPath(path)) {
      components.push(path);
      continue;
    }

    others += 1;
  }

  return { components, demos, styles, others };
}

function depthOf(directory: string): number {
  return directory ? directory.split("/").length : 0;
}

/**
 * Candidate files, grouped by the folder they sit in.
 *
 * Deepest folders come first. A component that owns its folder — `hero/` with
 * a `hero.tsx` and a `use-hero.ts` beside it — has to be offered before the
 * folder that holds it, or the picker reads as though the nested files were
 * loose files in a parent folder.
 */
export function groupByDirectory(paths: string[]): DirectoryGroup[] {
  const byDirectory = new Map<string, string[]>();

  for (const path of paths) {
    if (!isCandidateComponentPath(path)) continue;

    const segments = segmentsOf(path);
    const directory = segments.slice(0, -1).join("/");
    const files = byDirectory.get(directory);

    if (files) files.push(path);
    else byDirectory.set(directory, [path]);
  }

  return [...byDirectory.entries()]
    .map(([directory, files]) => ({ directory, files: [...files].sort() }))
    .sort(
      (a, b) =>
        depthOf(b.directory) - depthOf(a.directory) ||
        a.directory.localeCompare(b.directory)
    );
}

/**
 * Where a file's raw content is served from.
 *
 * The path is encoded a segment at a time so a file name with a space in it
 * does not turn into a 404, while the slashes between segments stay slashes.
 */
export function joinRepoPath(owner: string, repo: string, ref: string, path: string): string {
  const clean = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const encoded = clean
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encoded}`;
}
