import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MonacoEditor, { loader } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { registerLaTeXLanguage } from "monaco-latex";
import type { editor } from "monaco-editor";
import {
  Bold,
  BookOpen,
  Braces,
  ChevronRight,
  Clipboard,
  Code,
  Copy,
  Hash,
  Italic,
  List,
  MessageSquarePlus,
  Scissors,
  Search,
  Sigma,
  Sparkles,
  Strikethrough,
  Subscript,
  Superscript,
  Tag,
  Underline,
  Zap,
} from "lucide-react";
import { useParams } from "react-router";
import { useUpdatePageContent } from "~/query/page";
import { usePageComments } from "~/query/comment";
import type { Page } from "~/types/page";
import { useWorkspaceActionsStore } from "~/stores/workspace-actions";
import { useDebounce } from "~/hooks/useDebounce";
import { useEditorContext } from "./EditorLayout";
import { usePageContext } from "../PageContext";
import { useEditorSettingsStore } from "~/stores/editor-settings";
import { cn } from "~/lib/utils";
import { useSocket } from "~/contexts/SocketProvider";
import { usePagePresence } from "~/hooks/usePagePresence";
import { useRemoteCursors } from "~/hooks/useRemoteCursors";

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

/** Deterministic HSL colour from an arbitrary string (e.g. user._id). */
function stringToColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360},65%,42%)`;
}

interface EditorProps {
  page: Page;
}

type CtxPos = { x: number; y: number };
type SelFloating = {
  x: number;
  y: number;
  startLine: number;
  endLine: number;
  text: string;
};

interface MenuAction {
  icon?: React.ElementType;
  label: string;
  kbd?: string;
  action: () => void;
  disabled?: boolean;
}

export default function Editor({ page }: EditorProps) {
  const { editorRef } = useEditorContext();
  const { compileRef, isCompiling } = usePageContext();
  const { editorTheme, autoCompile } = useEditorSettingsStore();
  const [content, setContent] = useState(page.content || "");
  const debouncedContent = useDebounce(content, 1000);
  const autoCompileDebounced = useDebounce(content, 3000);
  const updateMutation = useUpdatePageContent();
  const { pageId: pageIdParam } = useParams<{ pageId: string }>();
  const { setPendingComment, setPendingAiText } = useWorkspaceActionsStore();
  const { data: comments = [] } = usePageComments(pageIdParam ?? null);
  const [ctxMenu, setCtxMenu] = useState<CtxPos | null>(null);
  const [ctxStartLine, setCtxStartLine] = useState<number | null>(null);
  const [ctxEndLine, setCtxEndLine] = useState<number | null>(null);
  const [ctxSelText, setCtxSelText] = useState("");
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const decorationCollRef = useRef<any>(null);
  const [selFloating, setSelFloating] = useState<SelFloating | null>(null);
  const selFloatingRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();
  // Tracks the last content received via socket to avoid re-saving/re-emitting remote changes.
  const lastRemoteContentRef = useRef<string | null>(null);
  // Remote cursor widgets
  const presenceUsers = usePagePresence(pageIdParam);
  const remoteCursors = useRemoteCursors(pageIdParam);
  const [editorMounted, setEditorMounted] = useState(false);
  const cursorWidgetsRef = useRef<Map<string, editor.IContentWidget>>(new Map());

  // Realtime: receive content changes from other collaborators
  useEffect(() => {
    if (!socket || !page._id) return;
    const handleRemote = ({
      pageId,
      content: remote,
    }: {
      pageId: string;
      content: string;
    }) => {
      if (pageId !== page._id) return;
      const ed = editorRef.current;
      if (ed && ed.getValue() === remote) return;
      lastRemoteContentRef.current = remote;
      setContent(remote);
    };
    socket.on("page:content", handleRemote);
    return () => {
      socket.off("page:content", handleRemote);
    };
  }, [socket, page._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save when content changes (debounced) — skip if it originated from socket
  useEffect(() => {
    if (debouncedContent === lastRemoteContentRef.current) return;
    if (debouncedContent && debouncedContent !== page.content) {
      updateMutation.mutate({ pageId: page._id, content: debouncedContent });
    }
  }, [debouncedContent]);

  // Realtime: broadcast local content changes to other collaborators (debounced)
  useEffect(() => {
    if (!socket || !page._id || !debouncedContent) return;
    if (debouncedContent === lastRemoteContentRef.current) return;
    socket.emit("page:content", {
      pageId: page._id,
      content: debouncedContent,
    });
  }, [debouncedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update local content when page changes
  useEffect(() => {
    if (page.content !== content) setContent(page.content || "");
  }, [page._id]);

  // Auto-compile on content change (3 s debounce, only when enabled and not compiling)
  useEffect(() => {
    if (!autoCompile || isCompiling || !autoCompileDebounced.trim()) return;
    compileRef.current?.();
  }, [autoCompileDebounced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close context menu when clicking outside
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (!ctxMenuRef.current?.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  // Close selection floating bar when clicking outside
  useEffect(() => {
    if (!selFloating) return;
    const handler = (e: MouseEvent) => {
      if (!selFloatingRef.current?.contains(e.target as Node))
        setSelFloating(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selFloating]);

  // Update comment glyph decorations when comments change
  useEffect(() => {
    const coll = decorationCollRef.current;
    if (!coll) return;
    const lineSet = new Set<number>();
    comments.forEach((c) => {
      if (c.line != null) {
        const from = c.line;
        const to = (c as any).lineEnd ?? c.line;
        for (let l = from; l <= to; l++) lineSet.add(l);
      }
    });
    coll.set(
      Array.from(lineSet).map((line) => ({
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: { glyphMarginClassName: "flux-comment-glyph" },
      })),
    );
  }, [comments]);

  // ── Context menu helpers ────────────────────────────────────────────────────
  const closeMenu = () => setCtxMenu(null);

  const trigger = (action: string) => {
    editorRef.current?.trigger("ctx-menu", action, null);
    editorRef.current?.focus();
    closeMenu();
  };

  const wrapSel = (before: string, after: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const text = ed.getModel()?.getValueInRange(sel) ?? "";
    ed.executeEdits("ctx-menu", [
      { range: sel, text: `${before}${text}${after}`, forceMoveMarkers: true },
    ]);
    ed.focus();
    closeMenu();
  };

  const insertAt = (text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    ed.executeEdits("ctx-menu", [{ range: sel, text, forceMoveMarkers: true }]);
    ed.focus();
    closeMenu();
  };

  // ── Menu definition ─────────────────────────────────────────────────────────
  const menuGroups: MenuAction[][] = [
    [
      {
        icon: Scissors,
        label: "Cut",
        kbd: "Ctrl+X",
        action: () => trigger("editor.action.clipboardCutAction"),
      },
      {
        icon: Copy,
        label: "Copy",
        kbd: "Ctrl+C",
        action: () => trigger("editor.action.clipboardCopyAction"),
      },
      {
        icon: Clipboard,
        label: "Paste",
        kbd: "Ctrl+V",
        action: () => trigger("editor.action.clipboardPasteAction"),
      },
    ],
    [
      { label: "Undo", kbd: "Ctrl+Z", action: () => trigger("undo") },
      { label: "Redo", kbd: "Ctrl+Y", action: () => trigger("redo") },
    ],
    [
      { icon: Bold, label: "Bold", action: () => wrapSel("\\textbf{", "}") },
      {
        icon: Italic,
        label: "Italic",
        action: () => wrapSel("\\textit{", "}"),
      },
      {
        icon: Underline,
        label: "Underline",
        action: () => wrapSel("\\underline{", "}"),
      },
      {
        icon: Code,
        label: "Typewriter",
        action: () => wrapSel("\\texttt{", "}"),
      },
      {
        icon: Strikethrough,
        label: "Strikethrough",
        action: () => wrapSel("\\sout{", "}"),
      },
      {
        icon: Superscript,
        label: "Superscript",
        action: () => wrapSel("^{", "}"),
      },
      { icon: Subscript, label: "Subscript", action: () => wrapSel("_{", "}") },
    ],
    [
      {
        icon: Sigma,
        label: "Inline Math",
        kbd: "$…$",
        action: () => wrapSel("$", "$"),
      },
      {
        icon: Braces,
        label: "Display Math",
        action: () => wrapSel("\\[\n  ", "\n\\]"),
      },
      {
        label: "Equation env",
        action: () => wrapSel("\\begin{equation}\n  ", "\n\\end{equation}"),
      },
      {
        label: "Align env",
        action: () => wrapSel("\\begin{align}\n  ", "\n\\end{align}"),
      },
    ],
    [
      { icon: Hash, label: "Section", action: () => insertAt("\\section{}") },
      {
        icon: ChevronRight,
        label: "Subsection",
        action: () => insertAt("\\subsection{}"),
      },
      { icon: List, label: "List item", action: () => insertAt("\\item ") },
      { icon: Tag, label: "Label", action: () => insertAt("\\label{}") },
      { icon: BookOpen, label: "Citation", action: () => insertAt("\\cite{}") },
    ],
    [
      {
        icon: Search,
        label: "Find / Replace",
        kbd: "Ctrl+F",
        action: () => trigger("actions.find"),
      },
      {
        icon: Zap,
        label: "Compile",
        kbd: "Ctrl+↵",
        action: () => {
          compileRef.current?.();
          closeMenu();
        },
      },
    ],
    [
      {
        icon: MessageSquarePlus,
        label: "Add Comment",
        action: () => {
          setPendingComment({
            startLine: ctxStartLine ?? 1,
            endLine: ctxEndLine ?? ctxStartLine ?? 1,
            selectedText: ctxSelText,
          });
          document.dispatchEvent(
            new CustomEvent("flux:open-panel", { detail: "Review" }),
          );
          closeMenu();
        },
      },
      {
        icon: Sparkles,
        label: "Ask AI about this",
        action: () => {
          if (ctxSelText) setPendingAiText(ctxSelText);
          document.dispatchEvent(
            new CustomEvent("flux:open-panel", { detail: "Ask AI" }),
          );
          closeMenu();
        },
      },
    ],
  ];

  // Draw / update remote cursor content widgets whenever cursors or presence changes
  useEffect(() => {
    const ed = editorRef.current;
    if (!editorMounted || !ed) return;

    // Remove stale widgets first
    cursorWidgetsRef.current.forEach((w) => ed.removeContentWidget(w));
    cursorWidgetsRef.current.clear();

    // Add a widget for each remote cursor we know about
    remoteCursors.forEach((cursor, socketId) => {
      const user = presenceUsers.find((u) => u.socketId === socketId);
      if (!user) return;

      const color = stringToColor(user._id);

      const outer = document.createElement("div");
      outer.style.cssText = "position:relative;pointer-events:none;";

      const label = document.createElement("div");
      label.style.cssText = [
        "position:absolute",
        "bottom:100%",
        "left:0",
        `background:${color}`,
        "color:#fff",
        "font-size:10px",
        "padding:1px 5px",
        "border-radius:3px 3px 3px 0",
        "white-space:nowrap",
        "font-family:system-ui,sans-serif",
        "line-height:1.5",
        "user-select:none",
      ].join(";");
      label.textContent = user.name;

      const bar = document.createElement("div");
      bar.style.cssText = `width:2px;height:1.3em;background:${color};margin-top:-1px;`;

      outer.appendChild(label);
      outer.appendChild(bar);

      const capturedCursor = cursor;
      const widget: editor.IContentWidget = {
        getId: () => `rc:${socketId}`,
        getDomNode: () => outer,
        getPosition: () => ({
          position: {
            lineNumber: capturedCursor.line,
            column: capturedCursor.column,
          },
          preference: [0 as editor.ContentWidgetPositionPreference],
        }),
      };
      ed.addContentWidget(widget);
      cursorWidgetsRef.current.set(socketId, widget);
    });

    return () => {
      cursorWidgetsRef.current.forEach((w) => ed.removeContentWidget(w));
      cursorWidgetsRef.current.clear();
    };
  }, [editorMounted, remoteCursors, presenceUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorMounted(true);

    // Intercept right-clicks to show our custom menu
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener("contextmenu", (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const ed = editorRef.current;
        const sel = ed?.getSelection();
        const curLine = ed?.getPosition()?.lineNumber ?? null;
        setCtxStartLine(sel?.startLineNumber ?? curLine);
        setCtxEndLine(sel?.endLineNumber ?? curLine);
        setCtxSelText(sel ? (ed?.getModel()?.getValueInRange(sel) ?? "") : "");
        setCtxMenu({
          x: Math.min(e.clientX + 2, window.innerWidth - 230),
          y: Math.min(e.clientY + 2, window.innerHeight - 540),
        });
      });
    }

    // Ctrl+Enter → compile
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      compileRef.current?.();
    });

    // Emit cursor position to collaborators on every cursor move
    editor.onDidChangeCursorPosition((e) => {
      socket?.emit("page:cursor", {
        pageId: page._id,
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Show floating bar on non-empty selection
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      const isEmpty =
        sel.startLineNumber === sel.endLineNumber &&
        sel.startColumn === sel.endColumn;
      if (isEmpty) {
        setSelFloating(null);
        return;
      }
      const text = editor.getModel()?.getValueInRange(sel) ?? "";
      if (!text.trim()) {
        setSelFloating(null);
        return;
      }

      // Position the bar just above the selection using Monaco's scroll/layout
      const domNode = editor.getDomNode();
      if (!domNode) return;
      const rect = domNode.getBoundingClientRect();
      const lineHeight = editor.getOption(
        monaco.editor.EditorOption.lineHeight,
      );
      const scrollTop = editor.getScrollTop();
      const scrollLeft = editor.getScrollLeft();
      const layoutInfo = editor.getLayoutInfo();
      // pixel y of selection start line (top)
      const lineTop =
        rect.top +
        layoutInfo.lineNumbersLeft +
        (sel.startLineNumber - 1) * lineHeight -
        scrollTop;
      const TOOLBAR_H = 36;
      const rawY = lineTop - TOOLBAR_H - 6;
      const clampedY = Math.max(rect.top + 4, rawY);
      // x: centre over selection, clamped to viewport
      const contentLeft = rect.left + layoutInfo.contentLeft - scrollLeft;
      const midX = contentLeft + ((sel.startColumn + sel.endColumn) / 2) * 7.8;
      const TOOLBAR_W = 152;
      const clampedX = Math.min(
        Math.max(midX - TOOLBAR_W / 2, rect.left + 4),
        rect.right - TOOLBAR_W - 4,
      );
      setSelFloating({
        x: clampedX,
        y: clampedY,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        text,
      });
    });

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
      glyphMargin: true,
      folding: true,
      foldingStrategy: "indentation",
      contextmenu: false,
    });

    // Decoration collection for inline comment glyph indicators
    decorationCollRef.current = editor.createDecorationsCollection([]);

    // Click on glyph margin → open Review panel
    editor.onMouseDown((e) => {
      if (e.target.type === 2 /* GUTTER_GLYPH_MARGIN */) {
        document.dispatchEvent(
          new CustomEvent("flux:open-panel", { detail: "Review" }),
        );
      }
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
        theme={editorTheme === "dark" ? "latex-dark" : "latex-light"}
        className=""
        onMount={handleEditorMount}
        options={{ automaticLayout: true }}
      />

      {/* Selection floating action bar */}
      {selFloating &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={selFloatingRef}
            className="fixed z-9998 flex items-center gap-px rounded-lg border border-border bg-popover shadow-lg px-1 py-1"
            style={{ left: selFloating.x, top: selFloating.y }}
          >
            <button
              onClick={() => {
                setPendingComment({
                  startLine: selFloating.startLine,
                  endLine: selFloating.endLine,
                  selectedText: selFloating.text,
                });
                document.dispatchEvent(
                  new CustomEvent("flux:open-panel", { detail: "Review" }),
                );
                setSelFloating(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-primary/80 hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Add Comment"
            >
              <MessageSquarePlus className="size-3.5" />
              <span>Comment</span>
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={() => {
                if (selFloating.text) setPendingAiText(selFloating.text);
                document.dispatchEvent(
                  new CustomEvent("flux:open-panel", { detail: "Ask AI" }),
                );
                setSelFloating(null);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-primary/80 hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Ask Flux AI"
            >
              <img src="/Chat.svg" alt="Flux AI Comment" className="size-3.5" />
              <span>Ask Flux AI</span>
            </button>
          </div>,
          document.body,
        )}

      {/* Custom context menu portal */}
      {ctxMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={ctxMenuRef}
            className="fixed z-9999 w-52 rounded-lg border border-border bg-popover shadow-xl py-1 overflow-hidden"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {menuGroups.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div className="my-1 mx-2 h-px bg-border" />}
                {group.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      disabled={item.disabled}
                      onClick={item.action}
                      className={cn(
                        "group w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs",
                        "hover:bg-accent hover:text-accent-foreground transition-colors",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                    >
                      {Icon ? (
                        <Icon className="size-3.5 shrink-0 text-muted-foreground group-hover:text-accent-foreground" />
                      ) : (
                        <span className="size-3.5 shrink-0" />
                      )}
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.kbd && (
                        <kbd className="text-[9px] text-muted-foreground font-mono tracking-tight">
                          {item.kbd}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
