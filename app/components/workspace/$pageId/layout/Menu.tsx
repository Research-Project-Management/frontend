import React from "react";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "~/components/ui/menubar";
import { usePageContext } from "./PageContext";
import {
  useEditorSettingsStore,
  type LayoutMode,
} from "~/stores/editor-settings";
import { useCompileStore } from "~/stores/compile";
import { Link, useNavigate } from "react-router";
import { ArrowUpLeft } from "lucide-react";

export default function Menu() {
  const navigate = useNavigate();
  const { editorRef, getEditorContent, compileRef } = usePageContext();
  const { compileStatus, pdfUrl } = useCompileStore();
  const { layout, setLayout } = useEditorSettingsStore();

  const isCompiling = compileStatus !== "idle" && compileStatus !== "done" && compileStatus !== "error";

  // ── Editor helpers ──────────────────────────────────────────────────────

  const editor = () => editorRef.current;

  const insertSnippet = (snippet: string) => {
    const ed = editor();
    if (!ed) return;
    const selection = ed.getSelection();
    const id = { major: 1, minor: 1 };
    ed.executeEdits("menu", [
      {
        range: selection!,
        text: snippet,
        forceMoveMarkers: true,
      },
    ]);
    ed.focus();
  };

  // ── File ───────────────────────────────────────────────────────────────

  const handleDownloadSource = () => {
    const src = getEditorContent.current?.() ?? "";
    const blob = new Blob([src], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "main.tex";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "output.pdf";
    a.click();
  };

  // ── Edit ──────────────────────────────────────────────────────────────

  const handleUndo = () => editor()?.trigger("menu", "undo", null);
  const handleRedo = () => editor()?.trigger("menu", "redo", null);
  const handleFind = () => editor()?.trigger("menu", "actions.find", null);
  const handleReplace = () =>
    editor()?.trigger("menu", "editor.action.startFindReplaceAction", null);
  const handleSelectAll = () =>
    editor()?.trigger("menu", "editor.action.selectAll", null);
  const handleComment = () =>
    editor()?.trigger("menu", "editor.action.commentLine", null);

  // ── View ──────────────────────────────────────────────────────────────

  const handleLayout = (mode: LayoutMode) => setLayout(mode);

  // ── Insert ────────────────────────────────────────────────────────────

  const INSERT_MATH = [
    { label: "Inline math  $…$", snippet: "$${TM_SELECTED_TEXT}$" },
    {
      label: "Display math  \\[…\\]",
      snippet: "\\[\n${TM_SELECTED_TEXT}\n\\]",
    },
    { label: "equation", snippet: "\\begin{equation}\n\t\n\\end{equation}" },
    { label: "align", snippet: "\\begin{align}\n\t &=  \\\\\n\\end{align}" },
  ];

  const INSERT_FIGURE = `\\begin{figure}[h]\n\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{image}\n\t\\caption{Caption}\n\t\\label{fig:label}\n\\end{figure}`;
  const INSERT_TABLE = `\\begin{table}[h]\n\t\\centering\n\t\\begin{tabular}{cc}\n\t\t\\hline\n\t\tCol 1 & Col 2 \\\\\n\t\t\\hline\n\t\t & \\\\\n\t\t\\hline\n\t\\end{tabular}\n\t\\caption{Caption}\n\t\\label{tab:label}\n\\end{table}`;
  const INSERT_ITEMIZE = `\\begin{itemize}\n\t\\item \n\\end{itemize}`;
  const INSERT_ENUMERATE = `\\begin{enumerate}\n\t\\item \n\\end{enumerate}`;

  // ── Format ────────────────────────────────────────────────────────────

  const wrapSel = (before: string, after: string) => {
    const ed = editor();
    if (!ed) return;
    const sel = ed.getSelection()!;
    const text = ed.getModel()?.getValueInRange(sel) ?? "";
    ed.executeEdits("menu", [
      {
        range: sel,
        text: `${before}${text}${after}`,
        forceMoveMarkers: true,
      },
    ]);
    ed.focus();
  };

  return (
    <Menubar className="border-0 shadow-none h-7 p-0">
      <Link
        to="/ws"
        className="relative text-sm font-medium select-none transition-colors text-muted-foreground hover:text-foreground h-7 px-2 flex items-center justify-center group shrink-0"
      >
        <span className="group-hover:opacity-0 transition-opacity duration-200">
          Home
        </span>
        <ArrowUpLeft className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 size-4 text-primary" />
      </Link>

      {/* ── File ── */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm px-2 py-1 h-7">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleDownloadSource}>
            Download source (.tex)
          </MenubarItem>
          <MenubarItem onClick={handleDownloadPdf} disabled={!pdfUrl}>
            Download PDF
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => navigate(-1)}>Close editor</MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ── Edit ── */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm px-2 py-1 h-7">Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleUndo}>
            Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleRedo}>
            Redo <MenubarShortcut>Ctrl+Y</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleFind}>
            Find <MenubarShortcut>Ctrl+F</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleReplace}>
            Find &amp; Replace <MenubarShortcut>Ctrl+H</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={handleSelectAll}>
            Select All <MenubarShortcut>Ctrl+A</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={handleComment}>
            Toggle Comment <MenubarShortcut>Ctrl+/</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ── View ── */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm px-2 py-1 h-7">View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onClick={() => handleLayout("editor-only")}
            className={
              layout === "editor-only" ? "font-semibold text-primary" : ""
            }
          >
            Editor only
          </MenubarItem>
          <MenubarItem
            onClick={() => handleLayout("split")}
            className={layout === "split" ? "font-semibold text-primary" : ""}
          >
            Editor &amp; PDF
          </MenubarItem>
          <MenubarItem
            onClick={() => handleLayout("viewer-only")}
            className={
              layout === "viewer-only" ? "font-semibold text-primary" : ""
            }
          >
            PDF only
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onClick={() => compileRef.current?.()}
            disabled={isCompiling}
          >
            Compile <MenubarShortcut>Ctrl+Enter</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ── Insert ── */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm px-2 py-1 h-7">
          Insert
        </MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>Section</MenubarSubTrigger>
            <MenubarSubContent>
              {[
                ["Part", "\\part{Title}"],
                ["Chapter", "\\chapter{Title}"],
                ["Section", "\\section{Title}"],
                ["Subsection", "\\subsection{Title}"],
                ["Subsubsection", "\\subsubsection{Title}"],
                ["Paragraph", "\\paragraph{Title}"],
              ].map(([label, snippet]) => (
                <MenubarItem
                  key={label}
                  onClick={() => insertSnippet(snippet + "\n")}
                >
                  {label}
                </MenubarItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>Math</MenubarSubTrigger>
            <MenubarSubContent>
              {INSERT_MATH.map(({ label, snippet }) => (
                <MenubarItem
                  key={label}
                  onClick={() =>
                    insertSnippet(snippet.replace("${TM_SELECTED_TEXT}", ""))
                  }
                >
                  {label}
                </MenubarItem>
              ))}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarItem onClick={() => insertSnippet(INSERT_FIGURE)}>
            Figure
          </MenubarItem>
          <MenubarItem onClick={() => insertSnippet(INSERT_TABLE)}>
            Table
          </MenubarItem>
          <MenubarItem onClick={() => insertSnippet(INSERT_ITEMIZE)}>
            Bullet list
          </MenubarItem>
          <MenubarItem onClick={() => insertSnippet(INSERT_ENUMERATE)}>
            Numbered list
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => insertSnippet("\\label{}")}>
            Label
          </MenubarItem>
          <MenubarItem onClick={() => insertSnippet("\\ref{}")}>
            Reference
          </MenubarItem>
          <MenubarItem onClick={() => insertSnippet("\\cite{}")}>
            Citation
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      {/* ── Format ── */}
      <MenubarMenu>
        <MenubarTrigger className="text-sm px-2 py-1 h-7">
          Format
        </MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => wrapSel("\\textbf{", "}")}>
            Bold <MenubarShortcut>Ctrl+B</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={() => wrapSel("\\textit{", "}")}>
            Italic <MenubarShortcut>Ctrl+I</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={() => wrapSel("\\underline{", "}")}>
            Underline <MenubarShortcut>Ctrl+U</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={() => wrapSel("\\texttt{", "}")}>
            Code / Monospace
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            onClick={() => wrapSel("\\begin{center}\n", "\n\\end{center}")}
          >
            Center
          </MenubarItem>
          <MenubarItem
            onClick={() =>
              wrapSel("\\begin{flushleft}\n", "\n\\end{flushleft}")
            }
          >
            Align left
          </MenubarItem>
          <MenubarItem
            onClick={() =>
              wrapSel("\\begin{flushright}\n", "\n\\end{flushright}")
            }
          >
            Align right
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
