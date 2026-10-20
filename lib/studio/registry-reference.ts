/**
 * What an author pasted.
 *
 * The install command on another registry's page is the thing people copy, and
 * it comes in every shape a package manager can spell: `npx shadcn@latest add
 * @acme/button`, `pnpm dlx shadcn@latest add @acme/button`, `bunx --bun
 * shadcn@latest add @acme/button`, and the plain link underneath it,
 * `https://acme.com/r/button.json`. All of them name the same thing, so the
 * studio takes all of them and asks the same question of each: which item is
 * this?
 *
 * The parsing is here rather than in the route because it is a question about
 * the text, not about the network, and a question about text can be answered
 * without a deployment to answer it in.
 */

/**
 * A thing an item can be named by.
 *
 * A link is the item's own address. A name is the item's name, and the
 * namespace — the `@acme` in `@acme/button` — says whose registry it belongs
 * to. A name with no namespace belongs to the default registry, which is the
 * one every shadcn project has always installed from.
 */
export type RegistryReference =
  | { kind: "url"; value: string }
  | { kind: "item"; namespace: string | null; name: string };

/** The text did not name an item, and this is why. */
export class RegistryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryInputError";
  }
}

/** A namespace and a name, as the registry writes them. */
const NAMESPACED_ITEM = /^@([a-zA-Z0-9][a-zA-Z0-9._-]*)\/([a-zA-Z0-9][a-zA-Z0-9._-]*)$/;

/** A bare name, as the default registry writes them. */
const BARE_ITEM = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** The verbs the CLI spells an install with. */
const INSTALL_VERBS = new Set(["add", "install"]);

/**
 * The text, split into the words a shell would give it.
 *
 * Quoted words stay whole, because a link is the one thing people paste with
 * a space in it — `https://acme.com/r/my item.json` — and a split that broke
 * that would break the only form that cannot be guessed back.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;

  for (const character of input) {
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      started = true;
      continue;
    }

    if (/\s/.test(character)) {
      if (started || current) tokens.push(current);
      current = "";
      started = false;
      continue;
    }

    current += character;
  }

  if (started || current) tokens.push(current);
  return tokens;
}

/** Whether a word is the address of something. */
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Whether a word can be the name of an item.
 *
 * The rule is deliberately narrow. A path (`./components/button.tsx`), a
 * flag (`--yes`) and a directory are not item names, and treating them as
 * such would send the studio looking for a component called `--cwd`.
 */
function isItemName(value: string): boolean {
  if (isUrl(value)) return true;
  if (NAMESPACED_ITEM.test(value)) return true;
  return BARE_ITEM.test(value);
}

/**
 * The items a command names.
 *
 * The command is read from the verb onwards, because everything before it is
 * the package manager's business: `npx`, `pnpm dlx`, `bunx --bun`, `yarn dlx`
 * and `npm exec` all mean the same thing to the person who copied them.
 */
function itemsFromCommand(tokens: string[]): string[] {
  const verbAt = tokens.findIndex((token) => INSTALL_VERBS.has(token.toLowerCase()));
  if (verbAt === -1) return [];

  return tokens
    .slice(verbAt + 1)
    .filter((token) => !token.startsWith("-") && isItemName(token));
}

/**
 * What the text names.
 *
 * Four things can be pasted, and all four are accepted:
 *
 * - the address of an item — `https://acme.com/r/button.json`
 * - the name of an item in a namespace — `@acme/button`
 * - the name of an item in the default registry — `button`
 * - the command that installs one — `npx shadcn@latest add @acme/button`
 *
 * A command may name several items, and all of them are brought in: the CLI
 * installs every one it is given, and a person who pasted two of them meant
 * two.
 */
export function parseRegistryInput(input: string): RegistryReference[] {
  const raw = input.trim().replace(/^`+|`+$/g, "").trim();
  if (!raw) {
    throw new RegistryInputError(
      "Paste the address of a registry item, or the command that installs it."
    );
  }

  if (isUrl(raw)) {
    return [{ kind: "url", value: raw }];
  }

  const tokens = tokenize(raw);

  /**
   * A command that was quoted whole.
   *
   * Copy buttons quote what they copy, and a quote around a whole command
   * makes it one word. The word is a command all the same, so it is read
   * again as one.
   */
  const words =
    tokens.length === 1 && /\s/.test(tokens[0]) ? tokenize(tokens[0]) : tokens;

  /**
   * A command is a command when it says what to install.
   *
   * The verb is what makes it a command rather than a name, so the check is
   * the verb's presence and not the presence of the word `shadcn` — a person
   * may have pasted a command from a registry that has its own installer.
   */
  if (words.some((token) => INSTALL_VERBS.has(token.toLowerCase()))) {
    const named = itemsFromCommand(words);
    if (!named.length) {
      throw new RegistryInputError(
        "That command does not name an item. It should end with something like @acme/button."
      );
    }
    return named.map(toReference);
  }

  const single = words[0];
  if (!single) {
    throw new RegistryInputError(
      "Paste the address of a registry item, or the command that installs it."
    );
  }

  return [toReference(single)];
}

/**
 * A word, as the thing it names.
 *
 * The link is kept whole, and a name is split into its namespace and its
 * name. Anything else is refused here rather than further in, where the
 * refusal would be about the network instead of about the text.
 */
function toReference(value: string): RegistryReference {
  if (isUrl(value)) {
    return { kind: "url", value };
  }

  const namespaced = NAMESPACED_ITEM.exec(value);
  if (namespaced) {
    return { kind: "item", namespace: namespaced[1], name: namespaced[2] };
  }

  if (BARE_ITEM.test(value)) {
    return { kind: "item", namespace: null, name: value };
  }

  throw new RegistryInputError(
    `"${value}" does not name a registry item. Use a link, or a name like @acme/button.`
  );
}
