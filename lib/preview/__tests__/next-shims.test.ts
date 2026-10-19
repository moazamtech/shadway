import { transformSync } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NEXT_SHIMS as PUBLISHED_SHIMS } from "@/lib/preview/build";
import {
  NEXT_SHIMS as SANDBOX_SHIMS,
  buildSandpackProject,
} from "@/lib/studio/sandpack";

/**
 * A component written for the App Router imports `next/*`, and the studio runs
 * it in two places that each have to answer that import themselves: the
 * sandbox, which is plain React, and the published document, which is a single
 * bundled file with no Next.js at all.
 *
 * The two maps are separate because the shapes are — the sandbox writes real
 * modules into a `node_modules` directory for its bundler to resolve, and the
 * published build hands esbuild a virtual namespace — but the *coverage* has to
 * agree. `next/form` was in neither, so `form-next-demo` resolved `Form` to
 * `undefined` and the whole preview came down with it. That is the failure this
 * holds shut.
 */

/**
 * Every Next.js module the public registry's blocks and examples import.
 *
 * Gathered from the registry rather than guessed: `next/link` comes from
 * `breadcrumb-responsive` and `combobox-responsive`, `next/form` from
 * `form-next-demo` and `form-next-complex`, and the rest are the modules the
 * blocks reach for through shared components.
 */
const REGISTRY_MODULES = [
  "next/image",
  "next/link",
  "next/form",
  "next/navigation",
  "next/router",
  "next/head",
  "next/script",
  "next/dynamic",
  "next/document",
];

/**
 * The rest of the App Router, reachable by pasting a route, an action or a
 * layout rather than by installing a block.
 *
 * The published build answers any `next/*` specifier it does not key to an
 * empty module, so these render. The sandbox has no such fallback — `next` is
 * never installed into `node_modules` — so each one has to be a real file or the
 * compile stops on a "Module not found" the author cannot act on.
 */
const ROUTER_MODULES = [
  "next/server",
  "next/headers",
  "next/cache",
  "next/og",
  "next/error",
  "next/not-found",
  "next/global-error",
  "next/after",
  "next/constants",
];

/** Side-effect-only packages, spelled without the `next/` prefix. */
const SIDE_EFFECT_MODULES = ["client-only", "server-only"];

/**
 * Generated per project from its own imports on both sides, so neither map
 * names them — but a project that imports one still has to resolve it.
 */
const FONT_MODULES = ["next/font", "next/font/google", "next/font/local"];

/**
 * The `next/*` the published build resolves without an entry of its own.
 *
 * `shimPlugin` sends any `next/*` specifier it does not key to an empty module
 * (`lib/preview/build.ts`), which is how a component importing `next/cache`
 * renders in a published document and used to fail to compile in the studio.
 * Written out here so that "the published build covers it" is a claim the test
 * makes and reviews rather than something it assumes, and so that a shim added
 * to one side without a decision about the other cannot pass unnoticed.
 */
const PUBLISHED_EMPTY_FALLBACK = ROUTER_MODULES;

/** How the sandbox spells a shim: a real module under a real `node_modules`. */
function sandboxPath(specifier: string): string {
  if (SIDE_EFFECT_MODULES.includes(specifier)) {
    return `/node_modules/${specifier}/index.js`;
  }
  return `/node_modules/${specifier}.js`;
}

/**
 * Compiles a shim and calls its default export, so a behaviour can be checked
 * rather than a substring of it read.
 *
 * A shim is a string in a record, so nothing else here would ever execute one —
 * and the defects this file exists to hold shut (`fill` laying out wrong, an
 * object `href` dropped) only show up once the module has run.
 */
function renderDefault(path: string, props: Record<string, unknown>): string {
  const jsx = transformSync(SANDBOX_SHIMS[path], {
    loader: "jsx",
    format: "cjs",
    jsx: "automatic",
  }).code;

  const module: { exports: Record<string, unknown> } = { exports: {} };
  const runtime = require("react/jsx-runtime") as Record<string, unknown>;
  const react = require("react") as Record<string, unknown>;
  new Function("exports", "require", "module", jsx)(
    module.exports,
    (id: string) => {
      if (id === "react" || id === "react/jsx-runtime") return runtime;
      if (id.startsWith("react/")) return react;
      throw new Error(`The shim imported something it has no stand-in for: ${id}`);
    },
    module
  );

  const Component = module.exports.default as (props: unknown) => unknown;
  return renderToStaticMarkup(Component(props) as never);
}

/** The specifiers a shim map answers, from its published keys. */
function publishedSurface(shims: Record<string, string>): string[] {
  return Object.keys(shims);
}

/**
 * The specifiers a shim map answers, from the sandbox's `/node_modules` paths.
 *
 * `package.json` is how a package is described rather than a module of its own,
 * `/node_modules/next/index.js` is the bare `next` barrel — a specifier the
 * published build does not answer at all, since its resolver only intercepts
 * `next/*` — and every other `index.js` is just a package's entry point.
 */
function sandboxSurface(shims: Record<string, string>): string[] {
  const specifiers = new Set<string>();

  for (const path of Object.keys(shims)) {
    if (!path.startsWith("/node_modules/") || path.endsWith("package.json")) continue;
    const specifier = path
      .slice("/node_modules/".length)
      .replace(/\.js$/, "")
      .replace(/\/index$/, "");
    if (specifier === "next") continue;
    specifiers.add(specifier);
  }

  return [...specifiers];
}

describe("Next.js stand-ins", () => {
  it("answers every module the registry imports, in the sandbox", () => {
    const missing = REGISTRY_MODULES.filter(
      (specifier) => !(sandboxPath(specifier) in SANDBOX_SHIMS)
    );
    expect(missing).toEqual([]);
  });

  it("answers every module the registry imports, in the published document", () => {
    const missing = REGISTRY_MODULES.filter((specifier) => !(specifier in PUBLISHED_SHIMS));
    expect(missing).toEqual([]);
  });

  it("answers the whole App Router in the sandbox, which has no fallback", () => {
    const missing = [...ROUTER_MODULES, ...SIDE_EFFECT_MODULES].filter(
      (specifier) => !(sandboxPath(specifier) in SANDBOX_SHIMS)
    );
    expect(missing).toEqual([]);
  });

  it("covers the same surface on both sides", () => {
    // The published side also answers the fonts, generated per project, and the
    // `next/*` it degrades to an empty module.
    const published = new Set([
      ...publishedSurface(PUBLISHED_SHIMS),
      ...FONT_MODULES,
      ...PUBLISHED_EMPTY_FALLBACK,
    ]);
    const sandbox = new Set(sandboxSurface(SANDBOX_SHIMS));

    expect([...sandbox].filter((specifier) => !published.has(specifier))).toEqual([]);
    expect([...published].filter((specifier) => !sandbox.has(specifier))).toEqual([]);
  });

  it("does not claim the published build for the modules it degrades", () => {
    for (const specifier of PUBLISHED_EMPTY_FALLBACK) {
      expect(specifier in PUBLISHED_SHIMS, specifier).toBe(false);
    }
  });

  it("keeps next/form a form element on both sides", () => {
    /**
     * A `<form>` whose `action` is a function is what `next/form` is for, and
     * React 19 runs a function action itself — so the stand-in is the element,
     * not a wrapper. Resolving it to an empty module instead is what made
     * `<Form>` render as `undefined`.
     */
    expect(PUBLISHED_SHIMS["next/form"]).toContain('React.createElement("form"');
    expect(SANDBOX_SHIMS[sandboxPath("next/form")]).toContain("<form");
  });

  it("re-exports the stand-ins through the sandbox's next barrel", () => {
    // A component that imports the package rather than a subpath resolves
    // through `/node_modules/next`, whose `main` is this barrel.
    const barrel = SANDBOX_SHIMS["/node_modules/next/index.js"];

    for (const name of ["Image", "Link", "Form", "Head", "Script"]) {
      expect(barrel, name).toContain(name);
    }
  });

  it("answers navigation the way the published document does", () => {
    const navigation = SANDBOX_SHIMS[sandboxPath("next/navigation")];

    for (const name of ["useRouter", "usePathname", "useSearchParams", "useParams"]) {
      expect(navigation, name).toContain(name);
    }

    // `redirect()` and `notFound()` are how a Server Component leaves its
    // render; without them a component calling one crashed the preview.
    expect(navigation).toContain("redirect");
    expect(navigation).toContain("notFound");
  });

  it("lays a filled next/image out the way the published document does", () => {
    /**
     * `fill` means "cover the nearest positioned ancestor". Sizing the `<img>`
     * to a hundred percent without taking it out of the flow pushed everything
     * around it — and every shadcn hero, avatar and cover is a `fill` image, so
     * every one of them broke in the studio while rendering fine published.
     */
    const image = SANDBOX_SHIMS[sandboxPath("next/image")];

    expect(image).toContain('position: "absolute"');
    expect(image).toContain("inset: 0");
    expect(image).toContain('placeholder === "blur"');
    expect(image).toContain("blurDataURL");
  });

  it("follows an object href, as the published document does", () => {
    const link = SANDBOX_SHIMS[sandboxPath("next/link")];
    expect(link).toContain("href?.pathname");
  });

  it("renders a filled image over its ancestor, not inside it", () => {
    /**
     * Every shadcn hero, avatar and cover is a `fill` image. Sized to a hundred
     * percent but left in the flow, each one pushed the content below it down
     * the page — a difference a substring of the shim cannot see.
     */
    const markup = renderDefault(sandboxPath("next/image"), {
      src: "/cover.png",
      alt: "",
      fill: true,
      className: "object-cover",
    });

    expect(markup).toContain("position:absolute");
    expect(markup).toContain("inset:0");
    expect(markup).toContain("width:100%");
    expect(markup).toContain("object-cover");
    // No intrinsic size: `fill` means the box comes from the layout.
    expect(markup).not.toContain("width=\"");
  });

  it("gives a blurred image something to show while it loads", () => {
    const shim = sandboxPath("next/image");
    const blank = renderDefault(shim, { src: "/a.png", alt: "", placeholder: "blur" });
    const supplied = renderDefault(shim, {
      src: "/a.png",
      alt: "",
      placeholder: "blur",
      blurDataURL: "data:image/png;base64,AAA",
    });

    expect(blank).toContain("background-image:url(");
    expect(blank).toContain("data:image/svg+xml");
    expect(supplied).toContain("data:image/png;base64,AAA");
    // And a project that asked for no placeholder is not given one.
    expect(renderDefault(shim, { src: "/a.png", alt: "" })).not.toContain("background-image");
  });

  it("follows an object href to its pathname", () => {
    const markup = renderDefault(sandboxPath("next/link"), {
      href: { pathname: "/pricing", query: { ref: "hero" } },
      children: "Pricing",
    });

    expect(markup).toContain('href="/pricing"');
  });

  it("writes every stand-in as a module that parses", () => {
    /**
     * The font modules are generated per project, so a name that survives
     * collection but is not an identifier is a syntax error in a file the
     * author never wrote and cannot see. Parsing each one is the only check
     * that catches it.
     */
    const files = {
      ...SANDBOX_SHIMS,
      ...buildSandpackProject({
        files: {
          "/app/page.tsx": `import { Anton, Syne as Display } from "next/font/google";
import { type Space_Mono } from "next/font/local";

export default function Page() {
  return <h1 className={Anton().className}>Hi</h1>;
}
`,
        },
      }).files,
    };

    const broken: string[] = [];
    for (const [path, content] of Object.entries(files)) {
      if (!path.startsWith("/node_modules/") || path.endsWith("package.json")) continue;
      try {
        transformSync(content, { loader: "jsx", format: "esm" });
      } catch (error) {
        broken.push(`${path}: ${(error as Error).message}`);
      }
    }

    expect(broken).toEqual([]);
  });
});

describe("the sandbox's next/font stand-ins", () => {
  const fontsOf = (imports: string) =>
    buildSandpackProject({
      files: {
        "/app/page.tsx": `${imports}

export default function Page() {
  return <h1>Hi</h1>;
}
`,
      },
    }).files;

  it("exports a binding for every font the project imports", () => {
    /**
     * `next/font/google` exports one binding per Google font and there are
     * thousands of them, so a fixed list was a hard `export 'Anton' was not
     * found` for everything outside it — a landing page built in the published
     * document and came down in the studio.
     */
    const google = fontsOf(`import { Anton, Syne as Display } from "next/font/google";`)![
      "/node_modules/next/font/google.js"
    ];

    expect(google).toContain("export const Anton = font;");
    expect(google).toContain("export const Syne = font;");
    // The alias is the importing file's business; the module exports the name
    // the font is actually called.
    expect(google).not.toContain("export const Display");
  });

  it("reads the fonts off every next/font entry point", () => {
    const files = fontsOf(`import { Geist } from "next/font";
import { Work_Sans } from "next/font/local";`);

    // `next/font/local`'s default export is `localFont`, so its bindings are
    // bound to that name rather than to `font`.
    const bindings: Record<string, string> = {
      "/node_modules/next/font.js": "font",
      "/node_modules/next/font/google.js": "font",
      "/node_modules/next/font/local.js": "localFont",
    };

    for (const [path, binding] of Object.entries(bindings)) {
      expect(files[path], path).toContain(`export const Geist = ${binding};`);
      expect(files[path], path).toContain(`export const Work_Sans = ${binding};`);
    }
  });

  it("keeps the default fonts resolving for a project that imports none", () => {
    const google = fontsOf(`import { Inter } from "next/font/google";`)[
      "/node_modules/next/font/google.js"
    ];

    for (const name of ["Inter", "Roboto", "Geist", "Noto_Serif"]) {
      expect(google, name).toContain(`export const ${name} = font;`);
    }
  });

  it("hands back the variable the project asked for", () => {
    /**
     * `Inter({ subsets: ["latin"], variable: "--font-inter" })` used to answer
     * `variable: "--font-sans"` no matter what was passed, so the
     * `--font-inter` the author then set on an element did not exist.
     */
    for (const path of FONT_MODULES.map(sandboxPath)) {
      expect(SANDBOX_SHIMS[path], path).toContain('variable: options.variable ?? "--font-sans"');
      expect(SANDBOX_SHIMS[path], path).toContain("options = {}");
    }
  });
});