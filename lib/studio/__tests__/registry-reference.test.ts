import { describe, expect, it } from "vitest";

import {
  parseRegistryInput,
  RegistryInputError,
  tokenize,
} from "../registry-reference";

/**
 * The text an author pastes.
 *
 * The command is the thing a registry's own page puts on its copy button, so
 * it arrives in every shape a package manager can spell. The parsing is a
 * question about the text, and this is where that question is answered.
 */
describe("parseRegistryInput", () => {
  it("reads a link as the item's own address", () => {
    expect(parseRegistryInput("https://acme.com/r/button.json")).toEqual([
      { kind: "url", value: "https://acme.com/r/button.json" },
    ]);
  });

  it("reads a namespaced name as a name in a registry", () => {
    expect(parseRegistryInput("@acme/button")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("reads a bare name as a name in the default registry", () => {
    expect(parseRegistryInput("button")).toEqual([
      { kind: "item", namespace: null, name: "button" },
    ]);
  });

  it("reads the command out of the npx spelling", () => {
    expect(parseRegistryInput("npx shadcn@latest add @acme/button")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("reads the command out of the pnpm spelling", () => {
    expect(parseRegistryInput("pnpm dlx shadcn@latest add @acme/button")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("reads the command out of the bun spelling", () => {
    expect(parseRegistryInput("bunx --bun shadcn@latest add @acme/button")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("reads the command out of the yarn spelling", () => {
    expect(parseRegistryInput("yarn dlx shadcn@latest add @acme/button")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("reads a command with no runner at all", () => {
    expect(parseRegistryInput("shadcn add @acme/button")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("reads a command that names several items", () => {
    expect(
      parseRegistryInput("npx shadcn@latest add @acme/button @acme/card")
    ).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
      { kind: "item", namespace: "acme", name: "card" },
    ]);
  });

  it("does not read a flag as an item", () => {
    expect(parseRegistryInput("npx shadcn@latest add @acme/button --yes")).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("does not read the path of a flag as an item", () => {
    expect(
      parseRegistryInput("npx shadcn@latest add @acme/button --cwd /tmp/project")
    ).toEqual([{ kind: "item", namespace: "acme", name: "button" }]);
  });

  it("reads a link that is quoted", () => {
    expect(parseRegistryInput('"https://acme.com/r/button.json"')).toEqual([
      { kind: "url", value: "https://acme.com/r/button.json" },
    ]);
  });

  it("reads a command that is quoted whole", () => {
    expect(parseRegistryInput('"npx shadcn@latest add @acme/button"')).toEqual([
      { kind: "item", namespace: "acme", name: "button" },
    ]);
  });

  it("refuses an empty text with a sentence", () => {
    expect(() => parseRegistryInput("   ")).toThrow(RegistryInputError);
  });

  it("refuses a command that names nothing", () => {
    expect(() => parseRegistryInput("npx shadcn@latest add")).toThrow(
      /does not name an item/
    );
  });

  it("refuses a word that is neither a link nor a name", () => {
    expect(() => parseRegistryInput("./components/button.tsx")).toThrow(
      /does not name a registry item/
    );
  });
});

describe("tokenize", () => {
  it("keeps a quoted word whole", () => {
    expect(tokenize('shadcn add "https://acme.com/r/my item.json"')).toEqual([
      "shadcn",
      "add",
      "https://acme.com/r/my item.json",
    ]);
  });

  it("drops the empty words between two spaces", () => {
    expect(tokenize("shadcn   add   button")).toEqual([
      "shadcn",
      "add",
      "button",
    ]);
  });
});
