"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type * as Monaco from "monaco-editor";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading editor...
    </div>
  ),
});

type Props = {
  path: string;
  value: string;
  language: "typescript" | "javascript" | "css" | "json";
  onChange: (value: string) => void;
  onSave?: () => void;
  onRun?: () => void;
  /** Files available in the project so imports resolve while typing. */
  projectFiles: Record<string, string>;
  /** npm packages already installed in the sandbox. */
  packages: string[];
};

const DARK_THEME = "shadway-dark";
const LIGHT_THEME = "shadway-light";

/**
 * The `monaco-editor` package types mark `languages.typescript` as deprecated
 * and omit the language service, even though the full build that ships to the
 * browser exposes it at runtime. This is exactly the surface we use.
 */
type LanguageServiceDefaults = {
  setDiagnosticsOptions: (options: {
    noSemanticValidation?: boolean;
    noSyntaxValidation?: boolean;
    onlyVisible?: boolean;
  }) => void;
  setCompilerOptions: (options: Record<string, unknown>) => void;
};

type MonacoWithTs = typeof Monaco & {
  languages: typeof Monaco.languages & {
    typescript: {
      typescriptDefaults: LanguageServiceDefaults;
      javascriptDefaults: LanguageServiceDefaults;
      JsxEmit: { ReactJSX: number };
      ScriptTarget: { ESNext: number };
      ModuleResolutionKind: { NodeJs: number };
    };
  };
};

/**
 * Live values for the completion provider below. Monaco providers are
 * registered once per page, so they read the project through this instead of
 * closing over whatever the first render happened to hold.
 */
let completionContext = {
  projectFiles: {} as Record<string, string>,
  packages: [] as string[],
  activePath: "",
};
let completionsRegistered = false;

/**
 * Both editor themes, built from the app's own tokens.
 *
 * The editor is a surface *inside* the studio, not a separate app, so it sits
 * on the same plane as the panel around it: `--background`, the studio shell's
 * own colour, in light and in dark. Monaco needs literal colours and cannot
 * read CSS custom properties, so the values below mirror `app/globals.css` —
 * background, surface, foreground, muted, popover and border — rather than
 * Monaco's stock black and white.
 */
function defineTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme(DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8a8a8a", fontStyle: "italic" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "86efac" },
      { token: "type.identifier", foreground: "67e8f9" },
    ],
    colors: {
      "editor.background": "#202020", // --background
      "editor.foreground": "#f0f0f0", // --foreground
      "editorGutter.background": "#202020", // --background
      "editorLineNumber.foreground": "#5f5f5f",
      "editorLineNumber.activeForeground": "#b0b0b0", // --muted-foreground
      "editor.lineHighlightBackground": "#242424", // --well
      "editor.selectionBackground": "#303030", // --muted
      "editor.inactiveSelectionBackground": "#262626",
      "editorCursor.foreground": "#f0f0f0",
      "editorIndentGuide.background1": "#2b2b2b",
      "editorIndentGuide.activeBackground1": "#3d3d3d",
      "editorBracketMatch.background": "#303030",
      "editorBracketMatch.border": "#4a4a4a",
      "editorWidget.background": "#262626", // --popover
      "editorWidget.border": "#303030",
      "editorSuggestWidget.background": "#262626",
      "editorSuggestWidget.border": "#303030",
      "editorSuggestWidget.selectedBackground": "#303030",
      "editorHoverWidget.background": "#262626",
      "editorHoverWidget.border": "#303030",
      "scrollbarSlider.background": "#3a3a3a80",
      "scrollbarSlider.hoverBackground": "#4a4a4aa0",
      "scrollbarSlider.activeBackground": "#5a5a5ac0",
    },
  });

  monaco.editor.defineTheme(LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "767676", fontStyle: "italic" },
      { token: "keyword", foreground: "8250df" },
      { token: "string", foreground: "0a7f4f" },
      { token: "type.identifier", foreground: "0b7bc9" },
    ],
    colors: {
      "editor.background": "#f3f3f3", // --background
      "editor.foreground": "#141414", // --foreground
      "editorGutter.background": "#f3f3f3", // --background
      "editorLineNumber.foreground": "#b0b0b0",
      "editorLineNumber.activeForeground": "#7c7c7c", // --muted-foreground
      "editor.lineHighlightBackground": "#ffffff", // --surface
      "editor.selectionBackground": "#e5e5e5", // --muted
      "editor.inactiveSelectionBackground": "#ededed",
      "editorCursor.foreground": "#141414",
      "editorIndentGuide.background1": "#e7e7e7",
      "editorIndentGuide.activeBackground1": "#d4d4d4",
      "editorBracketMatch.background": "#e5e5e5",
      "editorBracketMatch.border": "#b4b4b4",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e5e5e5",
      "editorSuggestWidget.background": "#ffffff",
      "editorSuggestWidget.border": "#e5e5e5",
      "editorSuggestWidget.selectedBackground": "#f3f3f3",
      "editorHoverWidget.background": "#ffffff",
      "editorHoverWidget.border": "#e5e5e5",
      "scrollbarSlider.background": "#0000001a",
      "scrollbarSlider.hoverBackground": "#0000002e",
      "scrollbarSlider.activeBackground": "#00000042",
    },
  });
}

/**
 * The studio edits one file at a time with no tsconfig behind it, so semantic
 * checking only ever produces "cannot find module" noise. Both semantic and
 * syntax diagnostics are off — the way the studio's editor works — and real
 * errors surface in the preview's error overlay instead.
 */
function configureLanguageService(monaco: MonacoWithTs) {
  const ts = monaco.languages.typescript;
  if (!ts?.typescriptDefaults || !ts.javascriptDefaults) return;

  const diagnostics = { noSemanticValidation: true, noSyntaxValidation: true };
  const compilerOptions: Record<string, unknown> = {
    jsx: ts.JsxEmit?.ReactJSX,
    target: ts.ScriptTarget?.ESNext,
    moduleResolution: ts.ModuleResolutionKind?.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
    skipLibCheck: true,
  };

  ts.typescriptDefaults.setDiagnosticsOptions(diagnostics);
  ts.javascriptDefaults.setDiagnosticsOptions(diagnostics);
  ts.typescriptDefaults.setCompilerOptions(compilerOptions);
  ts.javascriptDefaults.setCompilerOptions(compilerOptions);
}

/**
 * Project-aware auto-import: typing a quote, slash or @ inside a TS/JS file
 * offers the project's own modules plus installed npm packages.
 */
function registerProjectCompletions(monaco: typeof Monaco) {
  if (completionsRegistered) return;
  completionsRegistered = true;

  monaco.languages.registerCompletionItemProvider(["typescript", "javascript"], {    triggerCharacters: ["@", "/", '"', "'"],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const fileSuggestions = Object.entries(completionContext.projectFiles)
        .filter(([file]) => file !== completionContext.activePath)
        .map(([file]) => {
          const alias =
            "@/" + file.replace(/^\/src\//, "").replace(/\.(tsx?|jsx?)$/, "");
          return {
            label: alias,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: alias,
            detail: file,
            range,
          };
        });

      const packageSuggestions = completionContext.packages.map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Module,
        insertText: name,
        detail: "npm package",
        range,
      }));

      return { suggestions: [...fileSuggestions, ...packageSuggestions] };
    },
  });
}

/**
 * Full Monaco editor wired for the Shadway studio:
 * TS/JSX aware, project-aware auto-imports and a command palette.
 */
export function StudioEditor({
  path,
  value,
  language,
  onChange,
  onSave,
  onRun,
  projectFiles,
  packages,
}: Props) {
  const { resolvedTheme } = useTheme();
  // The editor follows the app theme, exactly like the rest of the studio.
  const isDark = resolvedTheme !== "light";
  const activeTheme = isDark ? DARK_THEME : LIGHT_THEME;
  const uri = useMemo(() => `file:///shadway${path}`, [path]);

  // Keep the shared completion provider pointed at the latest render.
  useEffect(() => {
    completionContext = { projectFiles, packages, activePath: path };
  }, [projectFiles, packages, path]);

  return (
    <MonacoEditor
      path={uri}
      language={language}
      value={value}
      theme={activeTheme}
      beforeMount={(monaco) => {
        // Runs before the editor instance exists, so the theme is already
        // registered on the first paint — no light flash, no fallback theme.
        defineTheme(monaco);
        configureLanguageService(monaco as MonacoWithTs);
        registerProjectCompletions(monaco);
      }}
      onChange={(next) => onChange(next ?? "")}
      onMount={(editor, monaco) => {
        monaco.editor.setTheme(activeTheme);

        // Ctrl/Cmd+S — save. Declared here as well as on the window so the
        // shortcut works with the cursor anywhere in the studio.
        editor.addAction({
          id: "shadway.save",
          label: "Save",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => onSave?.(),
        });

        // Ctrl/Cmd+Enter — rebuild the preview sandbox from scratch.
        editor.addAction({
          id: "shadway.reload-preview",
          label: "Reload preview",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run: () => onRun?.(),
        });

        // Undo/redo. Monaco binds these already, but declaring them makes the
        // set explicit — Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z — and guarantees they
        // survive the controlled `value` round-trip.
        editor.addAction({
          id: "shadway.undo",
          label: "Undo",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ],
          run: (instance) => instance.trigger("keyboard", "undo", null),
        });

        editor.addAction({
          id: "shadway.redo",
          label: "Redo",
          keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
          ],
          run: (instance) => instance.trigger("keyboard", "redo", null),
        });
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 22,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        wordWrap: "on",
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: "line",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        stickyScroll: { enabled: false },
        fontLigatures: true,
        contextmenu: true,
        quickSuggestions: { other: true, comments: false, strings: false },
        suggest: { showWords: true },
      }}
      loading={<div className="p-4 text-xs text-muted-foreground">Loading editor...</div>}
    />
  );
}

export function languageFor(path: string): Props["language"] {
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  return "typescript";
}
