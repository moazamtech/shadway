"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
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
  const uri = useMemo(() => `file:///shadway${path}`, [path]);

  useEffect(() => {
    let disposed = false;

    /** The full bundle exposes the TS language service; base types do not. */
type MonacoWithLanguages = typeof Monaco & {
  languages: typeof Monaco.languages & {
    typescript?: {
      typescriptDefaults: {
        setCompletionEntryProvider: (
          selector: string,
          provider: {
            triggerCharacters: string[];
            provideCompletionItems: (
              model: Monaco.editor.ITextModel,
              position: Monaco.Position
            ) => { suggestions: unknown[] };
          }
        ) => void;
        setDiagnosticsOptions: (options: Record<string, boolean>) => void;
      };
    };
  };
};

async function configure(monaco: MonacoWithLanguages) {
      if (disposed) return;

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

      const tsDefaults = monaco.languages.typescript?.typescriptDefaults;

      // Project-aware auto-import: suggest sibling files.
      tsDefaults?.setCompletionEntryProvider(
        "/",
        {
          triggerCharacters: ["@", "/", '"', "'"],
          provideCompletionItems: (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const fileSuggestions = Object.keys(projectFiles)
              .filter((file) => file !== path)
              .map((file) => {
                const alias = "@/" + file.replace(/^\/src\//, "").replace(/\.(tsx?|jsx?)$/, "");
                return {
                  label: alias,
                  kind: monaco.languages.CompletionItemKind.Module,
                  insertText: `import Component from "${alias}"`,
                  detail: file,
                  range,
                };
              });

            const packageSuggestions = packages.map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: `import { } from "${name}"`,
              detail: "npm package",
              range,
            }));

            return { suggestions: [...fileSuggestions, ...packageSuggestions] };
          },
        }
      );

      tsDefaults?.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
    }

    void import("monaco-editor").then((mod) =>
      configure(mod as unknown as MonacoWithLanguages)
    );

    return () => {
      disposed = true;
    };
  }, [projectFiles, packages, path]);

  return (
    <MonacoEditor
      path={uri}
      language={language}
      value={value}
      theme={THEME}
      onChange={(next) => onChange(next ?? "")}
      onMount={(editor, monaco) => {
        monaco.editor.setTheme(THEME);

        editor.addAction({
          id: "shadway.save",
          label: "Save file",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => onSave?.(),
        });

        editor.addAction({
          id: "shadway.publish",
          label: "Publish component",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
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