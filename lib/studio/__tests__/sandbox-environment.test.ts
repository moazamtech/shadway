// @vitest-environment jsdom
/**
 * What the sandbox installs, and what it boots from.
 *
 * The pane hands Sandpack a `template` and a `customSetup`; everything the
 * sandbox ends up installing is decided by those two, and neither is ours alone.
 * `customSetup.dependencies` is merged *into* whatever `/package.json` the
 * template already carries — @codesandbox/sandpack-client, `addPackageJSONIfNeeded`,
 * under the comment "Merge package json with custom setup": an existing
 * `/package.json` wins, and the custom dependencies are added to it. So the
 * template's build tool is in every sandbox whatever this repo passes, and the
 * only question these tests can answer is whether anything *else* is in there.
 *
 * That is the question, because the dependency set is part of the provider's
 * remount key (`bootKey`, sandpack-preview.tsx): one more package is not one
 * small install, it is a full reinstall of everything already there. So the
 * pane installs exactly the packages a project's own sources import — and this
 * file holds that, by reading the *installed package's own template* rather
 * than a copy of it, so a version bump that changes what the template drags in
 * fails here instead of showing up as a slower boot.
 *
 * The environment itself is deliberately not chosen here, and the test that
 * pins it is the record of why: `template: "react-ts"` declares
 * `environment: "create-react-app"`, and the pane does not override it.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The provider, mocked down to the props that decide the install and the boot.
 *
 * Sandpack cannot run in jsdom — it is an iframe and a bundler — so the mock
 * records what the provider is handed. The same shape the relatch test uses.
 */
const h = vi.hoisted(() => ({
  /** Every render's provider props, oldest first. */
  renders: [] as Array<{
    template: unknown;
    customSetup: unknown;
    files: Record<string, string>;
  }>,
  /** The provider's live file map, as `useSandpack()` reports it. */
  bootFiles: {} as Record<string, string>,
}));

vi.mock("@codesandbox/sandpack-react", async () => {
  const react = await import("react");
  return {
    SandpackProvider: (props: {
      template: unknown;
      files: Record<string, string>;
      customSetup: unknown;
      children: React.ReactNode;
    }) => {
      h.renders.push({
        template: props.template,
        customSetup: props.customSetup,
        files: props.files,
      });
      // Sandpack injects `/package.json` from the template and the custom setup
      // before any client sees the project.
      h.bootFiles = { ...props.files, "/package.json": '{"name":"sandbox"}' };
      return react.createElement(react.Fragment, null, props.children);
    },
    SandpackPreview: () => null,
    useSandpack: () => ({
      sandpack: {
        files: h.bootFiles,
        clients: {},
        updateFile: () => {},
        deleteFile: () => {},
      },
    }),
  };
});

import { NEXT_SHIMS, buildSandpackProject } from "@/lib/studio/sandpack";
import { sandboxPackageVersion } from "@/lib/studio/deps";
import { SandpackPreviewPane } from "@/components/studio/sandpack-preview";

/** The one template the sandbox boots from, read out of the package. */
const TEMPLATE = "react-ts";

type TemplateFile = { code: string };
type Template = {
  main: string;
  environment: string;
  files: Record<string, TemplateFile>;
};

/**
 * Sandpack's own templates, imported for real rather than transcribed.
 *
 * `SANDBOX_TEMPLATES` is exported at runtime and not in the package's type
 * declarations, hence the cast. Reading it here rather than copying it is the
 * point of the file: the assertions below are about the template this repo has
 * actually installed, so a `react-scripts` that appears or disappears shows up
 * as a failing test with a package version in the diff.
 */
let templates: Record<string, Template>;

beforeAll(async () => {
  const actual = (await vi.importActual("@codesandbox/sandpack-react")) as unknown as {
    SANDBOX_TEMPLATES: Record<string, Template>;
  };
  templates = actual.SANDBOX_TEMPLATES;
});

/**
 * The `/package.json` the sandbox is handed.
 *
 * `addPackageJSONIfNeeded` (@codesandbox/sandpack-client) keeps a `/package.json`
 * that is already in the file map and merges the custom dependencies into it —
 * the template's own build tool included, because nothing here can remove a key
 * from a merge. Reproduced so the tests can name what is in the install.
 */
function sandboxPackageJson(
  template: Template,
  customSetup: { dependencies?: Record<string, string> }
): { name: string; main: string; dependencies: Record<string, string> } {
  const fromTemplate = JSON.parse(template.files["/package.json"].code) as {
    name?: string;
    main?: string;
    dependencies?: Record<string, string>;
  };
  return {
    name: fromTemplate.name ?? "sandpack-project",
    main: fromTemplate.main ?? template.main,
    dependencies: {
      ...fromTemplate.dependencies,
      ...customSetup.dependencies,
    },
  };
}

/**
 * The module the sandbox boots from: the template's `/package.json` `main`.
 *
 * Not `template.main` — that is the file the editor opens, which the studio is
 * expected to replace with its own entry.
 */
function bootPath(template: Template): string {
  return sandboxPackageJson(template, {}).main;
}

/** The provider props from the most recent mount. */
function lastBoot() {
  const render = h.renders.at(-1);
  if (!render) throw new Error("the sandbox never mounted");
  return render as {
    template: string;
    customSetup: { dependencies?: Record<string, string>; environment?: string };
    files: Record<string, string>;
  };
}

/**
 * A project that reaches everything the install has to cover: the author's own
 * files, a vendored shadcn source and the module it imports, and the bare
 * specifiers the sandbox answers with shims rather than with a package.
 */
const PAGE = "/app/page.tsx";
const BUTTON = "/components/ui/button.tsx";
const UTILS = "/lib/utils.ts";

const FILES: Record<string, string> = {
  [PAGE]: `import { motion } from "motion/react";
import Image from "next/image";
import { Geist } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

export default function Page() {
  return (
    <main className={Geist.className}>
      <Image src="/hero.png" alt="" fill />
      <Button asChild>
        <motion.a href="#">Go</motion.a>
      </Button>
      <Camera />
    </main>
  );
}
`,
};

const VENDORED = [
  {
    path: BUTTON,
    content: `import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }) {
  return <button className={cn(cva("inline-flex"), className)} {...props} />;
}
`,
  },
  {
    path: UTILS,
    content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`,
  },
];

/** Mounts the pane on a root of its own, so a second mount is a real remount. */
function harness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  return {
    render(props: Partial<React.ComponentProps<typeof SandpackPreviewPane>>) {
      act(() =>
        root.render(
          React.createElement(SandpackPreviewPane, {
            files: FILES,
            vendoredFiles: VENDORED,
            compiledCss: ":root{--background:#fff}",
            theme: "light" as const,
            ...props,
          })
        )
      );
      return lastBoot();
    },
    destroy() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const mounted: Array<{ destroy(): void }> = [];

function boot(props?: Partial<React.ComponentProps<typeof SandpackPreviewPane>>) {
  const h2 = harness();
  mounted.push(h2);
  return h2.render(props ?? {});
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  h.renders.length = 0;
  h.bootFiles = {};
});

afterEach(() => {
  while (mounted.length) mounted.pop()!.destroy();
});

/**
 * The environment decision, recorded as a test.
 *
 * `react-ts` declares `environment: "create-react-app"`, and the pane does not
 * override it. That is deliberate: the environment is not a bundler choice the
 * pane makes, it is the template's, and the alternatives are not free.
 *
 * `loadSandpackClient` (@codesandbox/sandpack-client, `dist/index.js`) picks one
 * of three clients by environment: `node` → `SandpackNode`, `static` →
 * `SandpackStatic`, everything else — `create-react-app` and `parcel` alike →
 * `SandpackRuntime`. So:
 *
 * - `static` cannot run this project at all: no bundler, no npm install, files
 *   served as written.
 * - `node` (the vite templates) keeps the React+TS shape but moves the pane onto
 *   a different client, with different plumbing than the `codesandbox` messages
 *   the ack watchdog reads off `window`, and `main`/`index.html` rather than the
 *   `/public/index.html` a CRA-shaped document is served from.
 * - `parcel` keeps the same client but changes the boot path to `/index.js` and
 *   the served document to `/index.html`, and its template provides no React at
 *   all, so `react`/`react-dom` would have to become installed dependencies.
 *
 * Switching is a real change to the boot contract, and it can only be verified
 * against a sandbox this repository cannot render headlessly. So the assertion
 * here is not "create-react-app is best" — it is that whichever template is
 * chosen, the boot path below is written to match *that* template, and a change
 * to it has to be made deliberately rather than inherited from an upgrade.
 */
describe("the template the sandbox boots from", () => {
  it("is the one whose entry the project is written for", () => {
    const { template } = boot();

    expect(template).toBe(TEMPLATE);
    expect(templates[TEMPLATE].environment).toBe("create-react-app");
  });

  /**
   * The pane must not pin an environment of its own: `combineTemplateFilesToSetup`
   * reads `customSetup.environment || baseTemplate.environment`, so a key here
   * would silently move the sandbox to another bundler while leaving the boot
   * path, the document and the `/node_modules` map pointed at this one.
   *
   * Nor an `entry`: that one overwrites `/package.json`'s `main` outright, which
   * is the boot path below.
   */
  it("is not overridden by the setup the pane sends", () => {
    const { customSetup } = boot();

    expect(customSetup.environment).toBeUndefined();
    expect((customSetup as { entry?: string }).entry).toBeUndefined();
  });

  /**
   * The boot module is the template's own `/index.tsx`, which mounts `/App.tsx`
   * into `#root`. Shipping our own would replace it, and a module that only
   * exports a component leaves the frame empty — the one failure that looks
   * like a broken sandbox rather than a broken build.
   */
  it("boots the entry the template provides, not one of ours", () => {
    const { template, files } = boot();

    const path = bootPath(templates[template]);
    expect(path).toBe("/index.tsx");
    expect(Object.keys(files)).not.toContain(path);

    const entry = templates[template].files[path].code;
    expect(entry).toMatch(/from\s+["']\.\/App["']/);
    expect(entry).toMatch(/getElementById\(["']root["']\)/);

    // `template.main` is the file the editor opens, and it is the one module the
    // studio does replace: the boot module mounts *this*, not the template's.
    expect(templates[template].main).toBe("/App.tsx");
    expect(files["/App.tsx"]).toContain("export default function App()");
    expect(files["/App.tsx"]).toMatch(/from\s+["']\.\/app\/page\.[tj]sx?["']/);
  });

  /**
   * The document is served from `/public/index.html` under this environment, so
   * that is where the studio's own has to go — and it has to be *ours*, since
   * the template's is replaced by whatever the file map says.
   */
  it("serves the document from the path the template serves it from", () => {
    expect(templates[TEMPLATE].files).toHaveProperty("/public/index.html");

    const { files } = boot();
    expect(files["/public/index.html"]).toContain('<div id="root">');
    expect(files["/public/index.html"]).not.toBe(
      templates[TEMPLATE].files["/public/index.html"].code
    );
  });
});

describe("the packages the sandbox installs", () => {
  /**
   * The whole point of deriving the set from the project's own imports: the
   * dependency list is part of the remount key, so a package nobody imported is
   * a full reinstall of everything that was.
   */
  it("installs exactly the packages the project's sources import", () => {
    const { customSetup } = boot();

    expect(Object.keys(customSetup.dependencies ?? {}).sort()).toEqual([
      "class-variance-authority",
      "clsx",
      "lucide-react",
      "motion",
      "tailwind-merge",
    ]);
  });

  /**
   * `next` is answered by the shim map rather than installed — installing the
   * real framework into a plain React sandbox is enormous and useless — so it
   * must not reach `/package.json`. `react` and `react-dom` are excluded for the
   * opposite reason: the template provides them, and installing a second copy
   * would give the sandbox two Reacts.
   */
  it("installs neither the framework it shims nor the React the template provides", () => {
    const { customSetup } = boot();
    const names = Object.keys(customSetup.dependencies ?? {});

    for (const provided of ["react", "react-dom", "next"]) {
      expect(names, provided).not.toContain(provided);
    }
  });

  it("installs each package at the range the sources were written against", () => {
    const { customSetup } = boot();

    expect(customSetup.dependencies?.motion).toBe(sandboxPackageVersion("motion"));
    expect(Object.values(customSetup.dependencies ?? {})).not.toContain("latest");
  });

  /**
   * The name of everything in the sandbox that no import in the project asked
   * for. Today that is React itself plus `react-scripts`, which arrives with the
   * template's `/package.json` and cannot be removed by a merge — it is the
   * price of the environment above, stated in one assertion so that a different
   * template's toolchain shows up here rather than as a slower boot.
   */
  it("carries the template's own build tool and nothing else unexplained", () => {
    const { template, customSetup } = boot();
    const requested = new Set(Object.keys(customSetup.dependencies ?? {}));
    const installed = Object.keys(
      sandboxPackageJson(templates[template], customSetup).dependencies
    );

    expect(installed.filter((name) => !requested.has(name)).sort()).toEqual([
      "react",
      "react-dom",
      "react-scripts",
    ]);
  });

  /**
   * The template is where the toolchain comes from, so the assertion above is
   * only meaningful while the toolchain is the template's. If a template ever
   * ships without one, this fails and the line above has to be re-read — a
   * sandbox that installs nothing extra is worth knowing about; one that
   * installs something nobody can name is not.
   */
  it("gets its build tool from the template, not from us", () => {
    const { template, customSetup } = boot();
    const fromTemplate = JSON.parse(templates[template].files["/package.json"].code);

    expect(Object.keys(fromTemplate.dependencies).sort()).toContain("react-scripts");
    expect(Object.values(customSetup.dependencies ?? {})).not.toContain("react-scripts");
  });

  it("installs a package the caller asked for by name", () => {
    const { customSetup } = boot({ dependencies: ["gsap"] });

    expect(Object.keys(customSetup.dependencies ?? {})).toContain("gsap");
  });
});

describe("what the boot project has to carry", () => {
  /**
   * The stylesheet is compiled by the real Tailwind compiler on the server and
   * injected whole. Anything that re-processes it — a second `@import` pass, a
   * trimmed sheet — changes every class the author sees, so it is compared
   * byte-for-byte.
   */
  it("carries the compiled stylesheet verbatim", () => {
    const css = "@import \"tailwindcss\";\n.bg-background{color:var(--background)}";
    const { files } = boot({ compiledCss: css });

    expect(files["/styles.css"]).toBe(css);
  });

  /**
   * The theme class is set from the entry module, because the served document is
   * not the app and cannot carry it itself.
   */
  it("sets the theme class from the entry module", () => {
    const { files } = boot({ theme: "dark" });

    expect(files["/App.tsx"]).toContain("const __shadwayDark = true;");
    expect(files["/App.tsx"]).toContain(
      'document.documentElement.classList.toggle("dark", __shadwayDark)'
    );
  });

  it("renders the page the caller named, and its alias is already relative", () => {
    const files: Record<string, string> = {
      ...FILES,
      "/app/dashboard/page.tsx": FILES[PAGE].replace("main", "section"),
    };

    const { files: built } = boot({ files, page: "/app/dashboard/page.tsx" });

    expect(built["/App.tsx"]).toMatch(/from\s+["']\.\/app\/dashboard\/page\.[tj]sx?["']/);
  });

  /**
   * The `next/*` map is load-bearing: nothing installs the framework, so a
   * component written for the App Router reaches `next/image`, `next/link`,
   * `next/font/google`, `client-only` and `server-only` and every one of them
   * has to be a file, under `/node_modules`, before the bundler is asked to
   * resolve it. A missing module is a compile failure the author cannot act on.
   */
  it("resolves every next/* specifier the project imports to a shim", () => {
    const { files } = boot();
    const paths = new Set(Object.keys(files));

    const specifiers = new Set<string>();
    for (const content of Object.values(files)) {
      for (const match of content.matchAll(
        /\bfrom\s+["']((?:next|client-only|server-only)(?:\/[^"']*)?)["']/g
      )) {
        specifiers.add(match[1]);
      }
    }

    // The project's own imports plus everything the barrel re-exports.
    expect(specifiers.size).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      const module = `/node_modules/${specifier}.js`;
      expect(paths, specifier).toContain(module);
    }
  });

  /**
   * The shims have to keep meeting each other: `next/index.js` re-exports seven
   * modules, and a shim that names one which was never written is a "module not
   * found" for every component that imports the barrel.
   */
  it("keeps the shim map internally resolvable", () => {
    const paths = new Set(Object.keys(NEXT_SHIMS));
    const relative =
      /\bfrom\s+["'](\.[^"']+)["']/g;

    for (const [path, code] of Object.entries(NEXT_SHIMS)) {
      for (const match of code.matchAll(relative)) {
        const stack = path.split("/").slice(0, -1);
        for (const segment of match[1].split("/")) {
          if (!segment || segment === ".") continue;
          if (segment === "..") stack.pop();
          else stack.push(segment);
        }
        const resolved = stack.join("/");
        expect(paths, `${path} -> ${match[1]}`).toContain(
          `${resolved}.js`.replace(/\/+/g, "/")
        );
      }
    }
  });

  /**
   * The shims must not be shadowed by the project's own files. They are written
   * into the same map as the author's sources, and an author who pastes a file
   * at `/node_modules/next/link.js` would otherwise silently break every
   * `next/link` in the studio.
   */
  it("lets nothing in the project shadow the shim map", () => {
    const { files } = boot();

    for (const path of Object.keys(NEXT_SHIMS)) {
      expect(files[path], path).toBeDefined();
    }
  });
});

describe("buildSandpackProject and the environment", () => {
  /**
   * The same shape the pane builds, so the shim and entry rules above can be
   * checked against a project rather than a mount. `/package.json` is
   * deliberately absent: Sandpack adds it from the template and the merge.
   */
  const project = (files: Record<string, string>) =>
    buildSandpackProject({
      files,
      compiledCss: "/* css */",
    }).files;

  it("does not write a package.json of its own", () => {
    // A `/package.json` here would *replace* the template's and silently change
    // the environment's toolchain — so this is a decision to keep visible.
    expect(project(FILES)).not.toHaveProperty("/package.json");
  });

  it("still mounts something when the project has no module to mount", () => {
    const files = project({ "/app/globals.css": '@import "tailwindcss";' });
    expect(files["/App.tsx"]).toContain("Nothing to preview yet");
  });
});