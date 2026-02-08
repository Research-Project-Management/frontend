import React, { useRef, useEffect, useState } from "react";
import MonacoEditor, { loader } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { registerLaTeXLanguage } from "monaco-latex";
import type { editor } from "monaco-editor";
import { useUpdatePageContent } from "~/query/page";
import type { Page } from "~/types/page";
import { useDebounce } from "~/hooks/useDebounce";
import { useEditorContext } from "./EditorLayout";

// Register LaTeX language and custom theme before Monaco loads
loader.init().then((monaco) => {
  registerLaTeXLanguage(monaco);

  // Define custom light theme with darker line number background
  monaco.editor.defineTheme("latex-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a737d", fontStyle: "italic" },
      { token: "keyword", foreground: "d73a49" },
      { token: "string", foreground: "032f62" },
      { token: "number", foreground: "005cc5" },
      { token: "delimiter", foreground: "24292e" },
      { token: "operator", foreground: "d73a49" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292e",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editorLineNumber.foreground": "#5d646c",
      "editorLineNumber.activeForeground": "#24292e",
      "editorGutter.background": "#f0f1f3",
      "editor.selectionBackground": "#0366d625",
      "editor.inactiveSelectionBackground": "#0366d615",
      "editorCursor.foreground": "#24292e",
      "editorWhitespace.foreground": "#d1d5da",
      "editorIndentGuide.background": "#e1e4e8",
      "editorIndentGuide.activeBackground": "#c8c8c8",
    },
  });

  // Define custom dark theme with darker line number background
  monaco.editor.defineTheme("latex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "keyword", foreground: "569cd6" },
      { token: "string", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "delimiter", foreground: "d4d4d4" },
      { token: "operator", foreground: "d4d4d4" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#2a2d2e",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorGutter.background": "#141414",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#3a3d41",
      "editorCursor.foreground": "#aeafad",
      "editorWhitespace.foreground": "#3b3b3b",
      "editorIndentGuide.background": "#404040",
      "editorIndentGuide.activeBackground": "#707070",
    },
  });
});

interface EditorProps {
  page: Page;
}

export default function Editor({ page }: EditorProps) {
  const { editorRef } = useEditorContext();
  const [content, setContent] = useState(page.content || "");
  const debouncedContent = useDebounce(content, 1000);
  const updateMutation = useUpdatePageContent();

  // Auto-save when content changes (debounced)
  useEffect(() => {
    if (debouncedContent && debouncedContent !== page.content) {
      updateMutation.mutate({
        pageId: page._id,
        content: debouncedContent,
      });
    }
  }, [debouncedContent]);

  // Update local content when page changes
  useEffect(() => {
    if (page.content !== content) {
      setContent(page.content || "");
    }
  }, [page._id]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      wordWrap: "on",
      minimap: { enabled: false },
      lineNumbers: "on",
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      scrollBeyondLastLine: false,
      padding: { top: 2, bottom: 2 },
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 6,
      glyphMargin: false,
      folding: true,
      foldingStrategy: "indentation",
    });
  };

  const defaultValue =
    page.content ||
    `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{${page.title}}
\\author{${page.author.name}}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Write your introduction here.

\\section{Methods}
Describe your methods.

\\subsection{Mathematical Formulas}
Here is an example equation:
$$
E = mc^2
$$

And an inline formula: $a^2 + b^2 = c^2$

\\section{Conclusion}
Your conclusions here.

\\end{document}
`;

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        defaultLanguage="latex"
        value={content}
        onChange={(value) => setContent(value || "")}
        theme="latex-light"
        className=""
        onMount={handleEditorMount}
        options={{
          automaticLayout: true,
        }}
      />
    </div>
  );
}
