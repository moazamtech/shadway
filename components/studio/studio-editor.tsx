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

const THEME = "shadway-dark";

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

function defineTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "86efac" },
      { token: "type.identifier", foreground: "67e8f9" },
    ],
    colors: {
      "editor.background": "#0d0d0d",
      "editor.foreground": "#e4e4e7",
      "editorLineNumber.foreground": "#52525b",
      "editorLineNumber.activeForeground": "#a1a1aa",
      "editor.selectionBackground": "#3f3f46",
      "editor.lineHighlightBackground": "#171717",
      "editorCursor.foreground": "#e4e4e7",
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
  const activeTheme = isDark ? THEME : "vs";
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

        editor.addAction({
          id: "shadway.save",
          label: "Save file",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => onSave?.(),
        });

        editor.addAction({
          id: "shadway.publish",
          label: "Publish component",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyEnter],
          run: () => onRun?.(),
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
